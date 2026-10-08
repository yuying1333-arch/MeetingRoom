@echo off
setlocal enabledelayedexpansion
title MeetingRoom 一键编译与启动

REM ============================================================
REM  MeetingRoom 一键编译与启动脚本
REM  用法：把本文件放在项目根目录，双击运行即可（或在 cmd 中：
REM        "build&run.bat"  —— 文件名含 & 号，cmd 里请加引号）
REM  说明：需要在服务器/电脑上安装 HBuilderX（提供 cli.exe）
REM        H5 预览需要 node（推荐）或 python（任一即可，脚本自动探测）
REM  注意：本文件必须保存为 ANSI/GBK 编码 + CRLF 换行，否则中文会乱码
REM        （项目内 .workbuddy/fix-bat-encoding.py 可自动转换）
REM ============================================================

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

REM ---------- 可修改配置 ----------
REM 静态服务端口
set "PORT=8901"
REM 二维码里使用的地址主机名。留空 = 自动取本机局域网 IP；
REM 若服务器有公网 IP 或域名（如 1.2.3.4、meeting.example.com），填在这里
set "PUBLIC_HOST="
REM HBuilderX cli.exe 路径（默认自动探测）
set "HBX_CLI="
if defined HBX_CLI_PATH set "HBX_CLI=%HBX_CLI_PATH%"
if not defined HBX_CLI if exist "D:\HBuilderX\cli.exe" set "HBX_CLI=D:\HBuilderX\cli.exe"
if not defined HBX_CLI if exist "C:\Program Files\HBuilderX\cli.exe" set "HBX_CLI=C:\Program Files\HBuilderX\cli.exe"
if not defined HBX_CLI if exist "C:\Program Files (x86)\HBuilderX\cli.exe" set "HBX_CLI=C:\Program Files (x86)\HBuilderX\cli.exe"
if not defined HBX_CLI if exist "%LOCALAPPDATA%\Programs\HBuilderX\cli.exe" set "HBX_CLI=%LOCALAPPDATA%\Programs\HBuilderX\cli.exe"
REM --------------------------------

if not defined HBX_CLI (
	echo.
	echo [错误] 未找到 HBuilderX CLI ^(cli.exe^)。
	echo        请确认已安装 HBuilderX，并在本脚本顶部手动指定路径，
	echo        或设置环境变量 HBX_CLI_PATH 指向 cli.exe。
	echo.
	pause
	exit /b 1
)

:menu
cls
echo ============================================================
echo   MeetingRoom 一键编译与启动
echo ------------------------------------------------------------
echo   项目目录 : %PROJECT_DIR%
echo   cli.exe  : %HBX_CLI%
echo   服务端口 : %PORT%
echo ============================================================
echo   [1] H5 发行编译 + 启动本地服务    服务器部署 / 浏览器访问（推荐）
echo   [2] 微信小程序 发行编译           产物 build/mp-weixin，上传体验版用
echo   [3] 微信小程序 开发编译           产物 dev/mp-weixin，开发者工具用
echo   [4] H5 开发模式运行               HBuilderX 自带服务，改代码热更新
echo   [5] 生成访问二维码                只生成 qrcode.png，不启动服务
echo   [6] 退出
echo ------------------------------------------------------------
set "CHOICE="
set /p "CHOICE=请输入选项（默认 1）: "
if not defined CHOICE set "CHOICE=1"
if "%CHOICE%"=="1" goto h5_release
if "%CHOICE%"=="2" goto mp_release
if "%CHOICE%"=="3" goto mp_dev
if "%CHOICE%"=="4" goto h5_dev
if "%CHOICE%"=="5" goto only_qr
if "%CHOICE%"=="6" exit /b 0
echo 输入无效，请重新选择...
ping -n 2 127.0.0.1 >nul
goto menu

REM ========== 1. H5 发行编译 + 静态服务 ==========
:h5_release
echo.
echo [1/3] 正在编译 H5 发行版，请稍候...
call "%HBX_CLI%" publish --platform h5 --project "!PROJECT_DIR!"
if errorlevel 1 (
	echo.
	echo [错误] H5 编译失败，请查看上方 HBuilderX 日志。
	pause
	goto menu
)
set "WEB_DIR=!PROJECT_DIR!\unpackage\dist\build\web"
if not exist "!WEB_DIR!\index.html" (
	echo.
	echo [错误] 未找到编译产物：!WEB_DIR!
	pause
	goto menu
)
echo [2/3] 编译完成：!WEB_DIR!
call :detect_host
call :make_qr
echo [3/3] 正在启动静态服务，按 Ctrl+C 可停止服务。
echo.
start "" "http://localhost:!PORT!"
call :serve "!WEB_DIR!"
goto end

REM ========== 2. 微信小程序 发行编译 ==========
:mp_release
echo.
echo 正在编译微信小程序发行版，请稍候...
call "%HBX_CLI%" publish --platform mp-weixin --project "!PROJECT_DIR!"
if errorlevel 1 (
	echo.
	echo [错误] 编译失败，请查看上方 HBuilderX 日志。
	pause
	goto menu
)
echo.
echo 编译完成，产物目录：
echo   !PROJECT_DIR!\unpackage\dist\build\mp-weixin
echo.
echo 后续：用微信开发者工具打开该目录上传。
pause
goto menu

REM ========== 3. 微信小程序 开发编译 ==========
:mp_dev
echo.
echo 正在编译微信小程序开发版（不启动开发者工具）...
call "%HBX_CLI%" launch mp-weixin --project "!PROJECT_DIR!" --compile true
echo.
echo 编译完成，产物目录：
echo   !PROJECT_DIR!\unpackage\dist\dev\mp-weixin
echo 可用微信开发者工具直接打开该目录预览。
pause
goto menu

REM ========== 4. H5 开发模式运行 ==========
:h5_dev
echo.
echo 正在以开发模式运行 H5（HBuilderX 将自动打开浏览器，Ctrl+C 停止）...
echo 注意：开发模式端口由 HBuilderX 分配，不受本脚本 PORT 设置控制。
call "%HBX_CLI%" launch h5 --project "!PROJECT_DIR!"
pause
goto menu

REM ========== 5. 只生成二维码 ==========
:only_qr
echo.
call :detect_host
call :make_qr
pause
goto menu

REM ========== 探测访问主机（局域网 IP / 公网域名）==========
:detect_host
set "LAN_IP="
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
	set "TMP_IP=%%i"
	set "TMP_IP=!TMP_IP: =!"
	if not defined LAN_IP set "LAN_IP=!TMP_IP!"
)
if defined PUBLIC_HOST set "LAN_IP=!PUBLIC_HOST!"
set "ACCESS_URL=http://!LAN_IP!:!PORT!"
exit /b 0

REM ========== 生成二维码并打印访问地址 ==========
:make_qr
echo.
echo 访问地址：
echo   本机      http://localhost:!PORT!
if not defined LAN_IP (
	echo   局域网    [未探测到网络地址]
	echo             可手动生成：node qrcode.js "http://你的IP:!PORT!"
	exit /b 0
)
echo   局域网    http://!LAN_IP!:!PORT!
echo   手机扫码  http://!LAN_IP!:!PORT!         ^(手机需与服务器同一局域网/WiFi^)
echo   网页看码  http://!LAN_IP!:!PORT!/__qr    ^(启动服务后可在任意设备打开^)
echo.
where node >nul 2>nul
if errorlevel 1 (
	echo [提示] 未检测到 node，跳过二维码生成。
	echo        可安装 Node.js 后重试，或让手机浏览器手动输入上面的地址。
	exit /b 0
)
echo 正在生成访问二维码...
node "!PROJECT_DIR!\qrcode.js" "!ACCESS_URL!" "!PROJECT_DIR!\qrcode.png" --scale 8 --quiet
if exist "!PROJECT_DIR!\qrcode.png" (
	echo.
	echo 二维码图片：!PROJECT_DIR!\qrcode.png
	echo 用手机扫描该图片即可打开上面的地址。
	start "" "!PROJECT_DIR!\qrcode.png" 2>nul
)
exit /b 0

REM ========== 静态服务（node 优先：带 /__qr 二维码页；python 兜底）==========
:serve
where node >nul 2>nul
if not errorlevel 1 (
	node "!PROJECT_DIR!\server.js" %1 !PORT!
	goto :eof
)
where python >nul 2>nul
if not errorlevel 1 (
	python -m http.server !PORT! --directory %1
	goto :eof
)
where py >nul 2>nul
if not errorlevel 1 (
	py -m http.server !PORT! --directory %1
	goto :eof
)
echo.
echo [提示] 未检测到 node / python，无法自动启动静态服务。
echo        请用 Nginx 或其它静态服务器托管目录：
echo        %1
echo.
pause
goto :eof

:end
echo.
echo 服务已停止。
pause
exit /b 0
