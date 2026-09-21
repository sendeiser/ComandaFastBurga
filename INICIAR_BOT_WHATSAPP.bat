@echo off
chcp 65001 > nul
title ComandaFast - Servidor WhatsApp Bot (Baileys)
color 0B
cls

echo =====================================================================
echo    [COMANDAFAST BURGERS] - SERVIDOR LOCAL WHATSAPP BOT (BAILEYS)
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. Verificar si Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Verificar dependencias de Baileys
if not exist "node_modules\@whiskeysockets\baileys" (
    echo [INFO] Instalando dependencias necesarias de Baileys y WhatsApp...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Hubo un error al instalar las dependencias con npm.
        pause
        exit /b 1
    )
)

:: 3. Verificar si el puerto 3002 ya esta ocupado
set OCCUPIED_PID=
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :3002 ^| findstr LISTENING 2^>nul') do (
    set OCCUPIED_PID=%%p
)

if defined OCCUPIED_PID (
    echo [AVISO] El puerto 3002 ya esta siendo usado por el proceso PID %OCCUPIED_PID%.
    echo Es probable que una instancia previa del bot ya este en ejecucion.
    echo.
    set /p RESTART_CONFIRM="Deseas detener el proceso anterior y reiniciar el bot? (S/N): "
    if /i "%RESTART_CONFIRM%"=="S" (
        echo Deteniendo proceso %OCCUPIED_PID%...
        taskkill /F /PID %OCCUPIED_PID% >nul 2>nul
        timeout /t 2 /nobreak >nul
    ) else (
        echo.
        echo Manteniendo el bot actual activo en http://localhost:3002/status
        echo Podes gestionar el bot desde el panel de Dueno: http://localhost:5174/#dueno
        echo.
        pause
        exit /b 0
    )
)

:RUN_BOT
cls
echo =====================================================================
echo    [COMANDAFAST BURGERS] - SERVIDOR LOCAL WHATSAPP BOT (BAILEYS)
echo =====================================================================
echo.
echo [OK] Microservicio de WhatsApp iniciado en el puerto 3002.
echo [OK] Estado de sesion y codigos QR sincronizados con el panel web.
echo.
echo Para gestionar el bot, ver el simulador o escanear el QR:
echo -> Ingresa a: http://localhost:5174/#dueno (Pestana Bot WhatsApp)
echo.
echo Presiona Ctrl + C para detener el bot en cualquier momento.
echo =====================================================================
echo.

node server/whatsappBotServer.js

echo.
echo ---------------------------------------------------------------------
echo El servidor del bot se ha detenido.
echo.
set /p RESTART_BOT="Deseas reiniciar el bot ahora? (S/N): "
if /i "%RESTART_BOT%"=="S" goto :RUN_BOT

echo Saliendo...
