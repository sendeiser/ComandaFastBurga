@echo off
chcp 65001 > nul
title ComandaFast - Generador de Bot Portatil Embebido
color 0A
cls

cd /d "%~dp0"

echo =====================================================================
echo    🍔 [COMANDAFAST] - GENERADOR DE BOT PORTATIL CON NODE EMBEBIDO
echo =====================================================================
echo.
echo Generando paquete autonomo para Pendrive / WhatsApp...
echo.

set NODE_BIN=node
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "D:\Archivos de Programas\NodeJs\node.exe" (
        set NODE_BIN="D:\Archivos de Programas\NodeJs\node.exe"
    ) else (
        echo [ERROR] No se encontro Node.js en el sistema para ejecutar el generador.
        pause
        exit /b 1
    )
)

%NODE_BIN% scripts\generatePortableBot.js

echo.
pause
