@echo off
REM Script para iniciar o AI Session Watcher (Sincronizador de IAs para o Obsidian)
cd /d "%~dp0scripts\ai-session-watcher"

echo Iniciando AI Session Watcher via PM2...
call npm i -g pm2
call pm2 start index.js --name "ai-session-watcher"
call pm2 save
echo.
echo Watcher rodando em background! Suas sessões do Copilot e Antigravity serão transcritas para "06 - Sessões" automaticamente.
pause
