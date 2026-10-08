@echo off
setlocal enabledelayedexpansion
title 生成访问二维码

REM ============================================================
REM  单独生成访问二维码（不编译、不启动服务，只需要 Node.js）
REM  用法：双击运行，按提示输入地址即可
REM  注意：本文件必须保存为 ANSI/GBK 编码 + CRLF 换行，否则中文会乱码
REM ============================================================

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"
set "PORT=8901"

where node >nul 2>nul
if errorlevel 1 (
	echo.
	echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org
	echo.
	pause
	exit /b 1
)

REM 自动探测局域网 IP 作为默认值
set "LAN_IP="
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
	set "TMP_IP=%%i"
	set "TMP_IP=!TMP_IP: =!"
	if not defined LAN_IP set "LAN_IP=!TMP_IP!"
)
set "DEFAULT_URL=http://!LAN_IP!:!PORT!"

echo ============================================================
echo   生成访问二维码
echo ------------------------------------------------------------
echo   直接回车 = 使用默认地址：!DEFAULT_URL!
echo   也可输入公网地址，如 http://1.2.3.4:!PORT! 或 https://你的域名
echo ============================================================
echo.
set "URL="
set /p "URL=请输入访问地址: "
if not defined URL set "URL=!DEFAULT_URL!"

echo.
node "!DIR!\qrcode.js" "!URL!" "!DIR!\qrcode.png" --scale 8 --quiet
if errorlevel 1 (
	echo.
	echo [失败] 二维码生成失败，请检查上面的提示。
	pause
	exit /b 1
)

echo 已生成二维码：!DIR!\qrcode.png
echo 访问地址：!URL!
echo.
start "" "!DIR!\qrcode.png" 2>nul
pause
