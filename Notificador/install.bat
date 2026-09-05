@echo off
echo === Instalando Notificador Antenor e Filhos ===
echo.

cd /d "%~dp0"

:: Verifica .env
if not exist ".env" (
    echo [!] Arquivo .env nao encontrado.
    echo     Copie .env.example para .env e preencha as credenciais.
    echo.
    pause
    exit /b 1
)

:: Instala dependencias
echo Instalando dependencias...
call npm install --production
if errorlevel 1 (
    echo [ERRO] npm install falhou. Verifique se Node.js esta instalado.
    pause
    exit /b 1
)

:: Cria launcher VBS (roda node sem janela de console)
set "SCRIPT_DIR=%~dp0"
set "VBS_PATH=%~dp0launcher.vbs"

> "%VBS_PATH%" echo Set WshShell = CreateObject("WScript.Shell")
>> "%VBS_PATH%" echo WshShell.CurrentDirectory = "%SCRIPT_DIR%"
>> "%VBS_PATH%" echo WshShell.Run """" ^& "%SCRIPT_DIR%node_modules\.bin\electron.cmd" ^& """ .", 0, False

:: Copia para Startup do Windows
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /y "%VBS_PATH%" "%STARTUP%\AntenorNotifier.vbs" >nul

echo.
echo === Instalado com sucesso! ===
echo.
echo   - Inicia automaticamente com o Windows
echo   - Para iniciar agora: npm start (ou duplo-clique em launcher.vbs)
echo   - Para parar: encerre "node.exe" no Gerenciador de Tarefas
echo   - Para desinstalar: execute uninstall.bat
echo.
pause
