const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const platform = os.platform();
let ytUrl = '';
let ytName = 'yt-dlp';

if (platform === 'win32') {
    ytUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    ytName = 'yt-dlp.exe';
} else if (platform === 'darwin') {
    ytUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
} else {
    ytUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
}

const destDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const dest = path.join(destDir, ytName);

if (!fs.existsSync(dest) || fs.statSync(dest).size < 100000) {
    console.log('Downloading ' + ytName + ' using curl...');
    try {
        execSync('curl -L -o "' + dest + '" "' + ytUrl + '"', { stdio: 'inherit' });
        if (platform !== 'win32') {
            fs.chmodSync(dest, 0o755);
        }
        console.log('Successfully downloaded yt-dlp');
    } catch (e) {
        console.error('Download failed', e);
        process.exit(1);
    }
} else {
    console.log('yt-dlp already exists at ' + dest);
}
