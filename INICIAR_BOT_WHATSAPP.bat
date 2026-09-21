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

:: 2. Verificar dependencias de Baileys y qrcode-terminal
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
    set /p RESTART_CONFIRM="Deseas detener el proceso anterior para ver el bot/QR? (S/N): "
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

:: 4. Opcion por parametro directo (--reset o --qr)
if "%1"=="--reset" goto :DO_RESET
if "%1"=="--qr" goto :DO_RESET
if "%1"=="-r" goto :DO_RESET

:ASK_MODE
cls
echo =====================================================================
echo    [COMANDAFAST BURGERS] - SERVIDOR LOCAL WHATSAPP BOT (BAILEYS)
echo =====================================================================
echo.
echo ¿Como deseas iniciar el bot de WhatsApp?
echo.
echo   [1] Conectar normalmente (Usa la sesion guardada si ya estas vinculado)
echo   [2] Vincular NUEVO celular (Muestra el CODIGO QR en pantalla para escanear)
echo.
set BOT_CHOICE=1
set /p BOT_CHOICE="Elige una opcion [1 o 2] (Por defecto 1): "

if "%BOT_CHOICE%"=="2" goto :DO_RESET
goto :RUN_NORMAL

:DO_RESET
cls
echo =====================================================================
echo    [VINCULAR NUEVO WHATSAPP - CODIGO QR EN PANTALLA]
echo =====================================================================
echo.
echo Generando nuevo codigo QR en terminal...
echo Cuando aparezca el codigo, escanealo con WhatsApp desde tu celular:
echo -> WhatsApp > Menu (o Ajustes) > Dispositivos vinculados > Vincular
echo.
echo =====================================================================
echo.
node server/whatsappBotServer.js --reset
goto :AFTER_BOT

:RUN_NORMAL
cls
echo =====================================================================
echo    [CONECTANDO WHATSAPP BOT COMANDAFAST]
echo =====================================================================
echo.
echo Iniciando microservicio...
echo Si no hay sesion guardada, aparecera el codigo QR aqui abajo:
echo.
node server/whatsappBotServer.js
goto :AFTER_BOT

:AFTER_BOT
echo.
echo ---------------------------------------------------------------------
echo El servidor del bot se ha detenido.
echo.
set /p RESTART_BOT="Deseas reiniciar el bot ahora? (S/N): "
if /i "%RESTART_BOT%"=="S" goto :ASK_MODE

echo Saliendo...
