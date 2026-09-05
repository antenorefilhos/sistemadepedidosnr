@echo off
echo === Removendo Notificador Antenor e Filhos ===

:: Remove do Startup
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP%\AntenorNotifier.vbs" del "%STARTUP%\AntenorNotifier.vbs"

:: Mata processo se estiver rodando
taskkill /f /im "electron.exe" >nul 2>&1

echo.
echo Notificador removido do inicio automatico do Windows.
pause
