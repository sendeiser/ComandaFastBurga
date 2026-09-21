@echo off
title ComandaFast - Servidor de WhatsApp Bot
color 0A
cls
echo ========================================================
echo   COMANDAFAST BURGERS - SERVIDOR WHATSAPP BOT (BAILEYS)
echo ========================================================
echo.
echo Iniciando microservicio en puerto 3002...
echo.
cd /d "%~dp0"
node server/whatsappBotServer.js
pause
