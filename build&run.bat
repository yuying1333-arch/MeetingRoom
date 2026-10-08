@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title MeetingRoom 一键编译与启动

REM ============================================================
REM  MeetingRoom 一键编译与启动脚本
REM  用法：把本文件放在项目根目录，双击运行即可（或在 cmd 中：
REM        "build&run.bat"  —— 文件名含 & 号，cmd 里请加引号）
REM  说明：需要在服务器/电脑上安装 HBuilderX（提供 cli.exe）
REM        H5 预览需要 python 或 node（任一即可，脚本自动探测）
REM ============================================================

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

REM ---------- 可修改配置 ----------
set "PORT=8080"
set "HBX_CLI="
REM 已设置环境变量 HBX_CLI 时优先使用
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
echo   [5] 退出
echo ------------------------------------------------------------
set "CHOICE="
set /p "CHOICE=请输入选项（默认 1）: "
if not defined CHOICE set "CHOICE=1"
if "%CHOICE%"=="1" goto h5_release
if "%CHOICE%"=="2" goto mp_release
if "%CHOICE%"=="3" goto mp_dev
if "%CHOICE%"=="4" goto h5_dev
if "%CHOICE%"=="5" exit /b 0
echo 输入无效，请重新选择...
ping -n 2 127.0.0.1 >nul
goto menu

REM ========== 1. H5 发行编译 + 静态服务 ==========
:h5_release
echo.
echo [1/2] 正在编译 H5 发行版，请稍候...
call "%HBX_CLI%" publish --platform h5 --project "%PROJECT_DIR%"
if errorlevel 1 (
	echo.
	echo [错误] H5 编译失败，请查看上方 HBuilderX 日志。
	pause
	goto menu
)
set "WEB_DIR=%PROJECT_DIR%\unpackage\dist\build\web"
if not exist "%WEB_DIR%\index.html" (
	echo.
	echo [错误] 未找到编译产物：%WEB_DIR%
	pause
	goto menu
)
echo [2/2] 编译完成：%WEB_DIR%
echo.
echo 访问地址：
echo   本机      http://localhost:%PORT%
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
	set "IP=%%i"
	set "IP=!IP: =!"
	echo   局域网    http://!IP!:%PORT%
)
echo.
echo 正在启动静态服务，按 Ctrl+C 可停止服务。
start "" "http://localhost:%PORT%"
call :serve "%WEB_DIR%"
goto end

REM ========== 2. 微信小程序 发行编译 ==========
:mp_release
echo.
echo 正在编译微信小程序发行版，请稍候...
call "%HBX_CLI%" publish --platform mp-weixin --project "%PROJECT_DIR%"
if errorlevel 1 (
	echo.
	echo [错误] 编译失败，请查看上方 HBuilderX 日志。
	pause
	goto menu
)
echo.
echo 编译完成，产物目录：
echo   %PROJECT_DIR%\unpackage\dist\build\mp-weixin
echo.
echo 后续：用微信开发者工具打开该目录上传，或直接运行本脚本前先编译再上传。
pause
goto menu

REM ========== 3. 微信小程序 开发编译 ==========
:mp_dev
echo.
echo 正在编译微信小程序开发版（不启动开发者工具）...
call "%HBX_CLI%" launch mp-weixin --project "%PROJECT_DIR%" --compile true
echo.
echo 编译完成，产物目录：
echo   %PROJECT_DIR%\unpackage\dist\dev\mp-weixin
echo 可用微信开发者工具直接打开该目录预览。
pause
goto menu

REM ========== 4. H5 开发模式运行 ==========
:h5_dev
echo.
echo 正在以开发模式运行 H5（HBuilderX 将自动打开浏览器，Ctrl+C 停止）...
call "%HBX_CLI%" launch h5 --project "%PROJECT_DIR%"
pause
goto menu

REM ========== 静态服务（python 优先，其次 node 内置服务）==========
:serve
where python >nul 2>nul
if not errorlevel 1 (
	python -m http.server %PORT% --directory %1
	goto :eof
)
where py >nul 2>nul
if not errorlevel 1 (
	py -m http.server %PORT% --directory %1
	goto :eof
)
where node >nul 2>nul
if not errorlevel 1 (
	node "%PROJECT_DIR%\server.js" %1 %PORT%
	goto :eof
)
echo.
echo [提示] 未检测到 python / node，无法自动启动静态服务。
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
