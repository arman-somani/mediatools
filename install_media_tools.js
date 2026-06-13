// install_media_tools.js – Node script that acts as the installer executable
// This file will be compiled to a Windows .exe using the `pkg` tool.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function run(command) {
  try {
    return execSync(command, { stdio: 'inherit' });
  } catch (e) {
    console.error('Command failed:', command);
    process.exit(1);
  }
}

function isAdmin() {
  // Simple check: try to write to Program Files; if fails, not admin.
  try {
    const testPath = path.join(process.env.ProgramFiles, 'MediaToolsEngine_test');
    fs.mkdirSync(testPath);
    fs.rmdirSync(testPath);
    return true;
  } catch {
    return false;
  }
}

function requestAdmin() {
  // Relaunch the script with admin rights via PowerShell if not admin.
  const scriptPath = process.argv[1];
  const cmd = `powershell -Command "Start-Process node -ArgumentList '\"${scriptPath}\"' -Verb runAs"`;
  run(cmd);
  process.exit(0);
}

if (!isAdmin()) {
  console.log('Requesting administrative privileges...');
  requestAdmin();
}

const INSTALL_DIR = path.join(process.env.ProgramFiles, 'MediaToolsEngine');

// Create directory
if (!fs.existsSync(INSTALL_DIR)) {
  console.log('Creating install directory at', INSTALL_DIR);
  fs.mkdirSync(INSTALL_DIR, { recursive: true });
}

// Copy binaries (adjust paths if they change)
const binDir = path.join(__dirname, 'bin');
const files = ['yt-dlp.exe', 'ffmpeg.exe'];
files.forEach((file) => {
  const src = path.join(binDir, file);
  const dest = path.join(INSTALL_DIR, file);
  if (!fs.existsSync(src)) {
    console.error('Missing binary:', src);
    process.exit(1);
  }
  console.log(`Copying ${file} to ${INSTALL_DIR}`);
  fs.copyFileSync(src, dest);
});

// Write registry key to indicate installation
console.log('Writing registry key...');
run(`reg add "HKLM\\Software\\MediaToolsEngine" /v Installed /t REG_DWORD /d 1 /f`);

// Optionally add to system PATH (requires admin, already elevated)
console.log('Adding install folder to system PATH');
run(`setx /M PATH "%PATH%;${INSTALL_DIR}"`);

console.log('MediaToolsEngine installed successfully!');
console.log('You may close this window.');
