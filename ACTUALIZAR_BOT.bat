@echo off
chcp 65001 > nul
title ComandaFast - Actualizador de Bot WhatsApp desde GitHub
color 0A
cls

echo =====================================================================
echo    🍔 [COMANDAFAST BURGERS] - ACTUALIZADOR DE BOT WHATSAPP
echo    Descarga las ultimas mejoras, correcciones y funciones desde GitHub
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. Comprobar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Ejecutar actualizador
node server/botUpdateService.js update

echo.
echo =====================================================================
echo    Proceso de actualizacion finalizado.
echo =====================================================================
echo.
pause
