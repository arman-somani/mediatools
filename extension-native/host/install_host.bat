@echo off
setlocal
echo ===================================================
echo MediaTools Native Host Installer
echo ===================================================
echo.
echo Please go to chrome://extensions, enable Developer Mode, and click "Load unpacked".
echo Select the 'extension' folder inside 'extension-native'.
echo Copy the generated Extension ID (e.g., aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)
echo.
set /p EXT_ID="Enter Extension ID: "

set "HOST_DIR=%~dp0"
set "HOST_DIR=%HOST_DIR:~0,-1%"
set "MANIFEST_PATH=%HOST_DIR%\com.mediatools.ytdlp.json"
set "BAT_PATH=%HOST_DIR%\host.bat"

:: Escape backslashes for JSON path string
set "ESCAPED_BAT_PATH=%BAT_PATH:\=\\%"

echo { > "%MANIFEST_PATH%"
echo   "name": "com.mediatools.ytdlp", >> "%MANIFEST_PATH%"
echo   "description": "MediaTools Native Downloader", >> "%MANIFEST_PATH%"
echo   "path": "%ESCAPED_BAT_PATH%", >> "%MANIFEST_PATH%"
echo   "type": "stdio", >> "%MANIFEST_PATH%"
echo   "allowed_origins": [ >> "%MANIFEST_PATH%"
echo     "chrome-extension://%EXT_ID%/" >> "%MANIFEST_PATH%"
echo   ] >> "%MANIFEST_PATH%"
echo } >> "%MANIFEST_PATH%"

echo.
echo Writing to Registry...
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mediatools.ytdlp" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

echo.
echo Done! Host is registered successfully.
echo You can now use the extension to download YouTube videos.
pause
