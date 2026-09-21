@echo off
chcp 65001 > nul
title ComandaFast - Lanzador Completo (Sistema + Bot)
color 0E
cls

echo =====================================================================
echo    [COMANDAFAST BURGERS] - LANZADOR COMPLETO (SISTEMA + BOT)
echo =====================================================================
echo.
echo Este script iniciara:
echo   1. Servidor del Bot de WhatsApp (Puerto 3002)
echo   2. Servidor Web POS / Cocina / Auditoria de Dueno (Vite)
echo   3. Apertura automatica del navegador en el panel administrativo
echo.
echo =====================================================================
echo.
pause

cd /d "%~dp0"

echo.
echo [1/3] Lanzando Servidor WhatsApp Bot en ventana separada...
start "ComandaFast - WhatsApp Bot" cmd /c "INICIAR_BOT_WHATSAPP.bat"

timeout /t 2 /nobreak >nul

echo [2/3] Abriendo navegador en el Portal del Dueno & Chatbot...
start http://localhost:5174/#dueno

echo [3/3] Iniciando Servidor Web (Vite)...
echo.
echo (Para cerrar todo cuando termines, simplemente cerra estas consolas)
echo =====================================================================
echo.

call npm run dev
