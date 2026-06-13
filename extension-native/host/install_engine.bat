@echo off
setlocal

:: This is the automated silent script that mimics an .exe installer
:: For production, replace YOUR_EXTENSION_ID_HERE with the permanent ID from the Chrome Web Store.
set "EXT_ID=YOUR_EXTENSION_ID_HERE"

:: In local development, if you haven't published yet, you can pass it as an argument
if not "%~1"=="" set "EXT_ID=%~1"

set "HOST_DIR=%~dp0"
set "HOST_DIR=%HOST_DIR:~0,-1%"
set "MANIFEST_PATH=%HOST_DIR%\com.mediatools.ytdlp.json"
set "BAT_PATH=%HOST_DIR%\host.bat"
set "ESCAPED_BAT_PATH=%BAT_PATH:\=\\%"

:: Generate the JSON Manifest silently
echo { > "%MANIFEST_PATH%"
echo   "name": "com.mediatools.ytdlp", >> "%MANIFEST_PATH%"
echo   "description": "MediaTools Native Downloader", >> "%MANIFEST_PATH%"
echo   "path": "%ESCAPED_BAT_PATH%", >> "%MANIFEST_PATH%"
echo   "type": "stdio", >> "%MANIFEST_PATH%"
echo   "allowed_origins": [ >> "%MANIFEST_PATH%"
echo     "chrome-extension://%EXT_ID%/" >> "%MANIFEST_PATH%"
echo   ] >> "%MANIFEST_PATH%"
echo } >> "%MANIFEST_PATH%"

:: Write to Registry silently
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mediatools.ytdlp" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

:: Done
echo Installation complete. The Chrome extension is now active.
