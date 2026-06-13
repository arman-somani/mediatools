const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');

const INSTALL_DIR = path.join(process.env.ProgramFiles, 'MediaToolsEngine');
const IS_SERVER_MODE = process.argv.includes('--server') || __dirname.toLowerCase() === INSTALL_DIR.toLowerCase();

function run(command) {
  try {
    return execSync(command, { stdio: 'inherit' });
  } catch (e) {
    console.error('Command failed:', command);
    process.exit(1);
  }
}

function isAdmin() {
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
  const scriptPath = process.argv[0]; // the compiled .exe
  const cmd = `powershell -Command "Start-Process '${scriptPath}' -Verb runAs"`;
  execSync(cmd);
  process.exit(0);
}

// -----------------------------------------
// INSTALLER MODE
// -----------------------------------------
if (!IS_SERVER_MODE) {
  if (!isAdmin()) {
    console.log('Requesting administrative privileges to install MediaTools Engine...');
    requestAdmin();
  }

  console.log('==============================================');
  console.log(' Installing MediaTools Local Engine...');
  console.log('==============================================');

  if (!fs.existsSync(INSTALL_DIR)) {
    console.log('Creating install directory at', INSTALL_DIR);
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
  }

  const currentExePath = process.execPath;
  const targetExePath = path.join(INSTALL_DIR, 'MediaToolsEngine.exe');
  
  console.log('Installing engine service...');
  fs.copyFileSync(currentExePath, targetExePath);

  console.log('Downloading latest yt-dlp... (This may take a minute)');
  run(`curl.exe -L -o "${path.join(INSTALL_DIR, 'yt-dlp.exe')}" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"`);
  
  console.log('Downloading latest ffmpeg... (This may take a few minutes)');
  const zipPath = path.join(INSTALL_DIR, 'ffmpeg.zip');
  run(`curl.exe -L -o "${zipPath}" "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip"`);
  
  console.log('Extracting ffmpeg...');
  const tmpPath = path.join(INSTALL_DIR, 'ffmpeg_tmp');
  run(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpPath}' -Force; Copy-Item -Path '${tmpPath}\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe' -Destination '${INSTALL_DIR}\\ffmpeg.exe' -Force; Remove-Item -Recurse -Force '${tmpPath}'; Remove-Item '${zipPath}'"`);

  console.log('Writing registry keys...');
  run(`reg add "HKLM\\Software\\MediaToolsEngine" /v Installed /t REG_DWORD /d 1 /f`);
  
  console.log('Adding to Windows Startup...');
  // Add to HKLM Run so it starts automatically
  run(`reg add "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v MediaToolsEngine /t REG_SZ /d "\\"${targetExePath}\\" --server" /f`);

  console.log('Starting the background service...');
  const serverProcess = spawn(targetExePath, ['--server'], {
    detached: true,
    stdio: 'ignore'
  });
  serverProcess.unref();

  console.log('==============================================');
  console.log(' SUCCESS! MediaTools Engine is installed.');
  console.log(' You can close this window and go back to your browser.');
  console.log('==============================================');
  
  // Keep window open for a few seconds so user can read
  setTimeout(() => process.exit(0), 5000);
}

// -----------------------------------------
// SERVER MODE (DAEMON)
// -----------------------------------------
if (IS_SERVER_MODE) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const PORT = 4000;

  app.get('/status', (req, res) => {
    res.json({ installed: true, status: 'running' });
  });

  app.post('/convert/universal', (req, res) => {
    const { url, videoQuality } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });

    // Download to the user's default Downloads folder
    const downloadsFolder = path.join(os.homedir(), 'Downloads');
    const ytDlpPath = path.join(__dirname, '', 'yt-dlp.exe');
    const ffmpegPath = path.join(__dirname, '');

    // Choose format string based on quality
    let formatStr = 'bestvideo+bestaudio/best';
    if (videoQuality === '1080p') formatStr = 'bestvideo[height<=1080]+bestaudio/best';
    if (videoQuality === '720p') formatStr = 'bestvideo[height<=720]+bestaudio/best';
    if (videoQuality === '480p') formatStr = 'bestvideo[height<=480]+bestaudio/best';
    if (videoQuality === '360p') formatStr = 'bestvideo[height<=360]+bestaudio/best';

    const args = [
      url,
      '-f', formatStr,
      '--merge-output-format', 'mp4',
      '--ffmpeg-location', ffmpegPath,
      '-o', path.join(downloadsFolder, '%(title)s.%(ext)s'),
      '--no-playlist'
    ];

    console.log('Starting yt-dlp with args:', args.join(' '));

    const ytdlp = spawn(ytDlpPath, args);

    // Instead of waiting for the full download (which could take a while and timeout the HTTP request),
    // we return success immediately and let yt-dlp run in the background.
    // The browser will just show "Download Started! Check your Downloads folder."
    
    res.json({ success: true, message: 'Download started. Check your Downloads folder shortly.' });

    ytdlp.stdout.on('data', (data) => console.log(`yt-dlp: ${data}`));
    ytdlp.stderr.on('data', (data) => console.error(`yt-dlp error: ${data}`));
    ytdlp.on('close', (code) => console.log(`yt-dlp exited with code ${code}`));
  });

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`MediaTools Engine Daemon running on http://127.0.0.1:${PORT}`);
  });
}
