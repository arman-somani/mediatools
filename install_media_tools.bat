@echo off
setlocal

rem ----- Installation folder (requires admin) -----
set "INSTALL_DIR=%ProgramFiles%\\MediaToolsEngine"

rem ----- Ensure we have admin rights -----
>nul 2>&1 "%SystemRoot%\\system32\\cacls.exe" "%INSTALL_DIR%" || (
    echo Requesting administrative privileges...
    powershell -Command "Start-Process '%~dpnx0' -Verb runAs"
    exit /b
)

rem ----- Create folder -----
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

rem ----- Copy binaries (adjust paths if your binaries live elsewhere) -----
copy /Y "d:\\WEBSITE\\MEDIATOOLS\\bin\\yt-dlp.exe" "%INSTALL_DIR%\\yt-dlp.exe"
copy /Y "d:\\WEBSITE\\MEDIATOOLS\\bin\\ffmpeg.exe" "%INSTALL_DIR%\\ffmpeg.exe"

rem ----- Write registry key so the web UI can detect installation -----
reg add "HKLM\\Software\\MediaToolsEngine" /v Installed /t REG_DWORD /d 1 /f

rem ----- (Optional) Add to system PATH -----
setx /M PATH "%PATH%;%INSTALL_DIR%"

echo MediaToolsEngine installed successfully to %INSTALL_DIR%.
pause
