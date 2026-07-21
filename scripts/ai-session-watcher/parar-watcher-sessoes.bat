@echo off
REM Script para parar o AI Session Watcher
echo Parando o AI Session Watcher via PM2...
call pm2 stop ai-session-watcher
call pm2 save
echo.
echo Watcher pausado com sucesso! Nenhuma sessão será transcrita enquanto estiver pausado.
pause
