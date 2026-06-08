const fs = require('fs');
const https = require('https');
const path = require('path');
const os = require('os');

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
    console.log(`Downloading ${ytName} from ${ytUrl} into ${dest}...`);
    const file = fs.createWriteStream(dest);
    
    https.get(ytUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
            // Follow redirect
            https.get(response.headers.location, (res2) => {
                res2.pipe(file);
                file.on('finish', () => {
                    file.close();
                    if (platform !== 'win32') {
                        fs.chmodSync(dest, 0o755);
                    }
                    console.log('Successfully downloaded yt-dlp');
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                console.error('Error downloading yt-dlp:', err.message);
            });
        } else {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                if (platform !== 'win32') {
                    fs.chmodSync(dest, 0o755);
                }
                console.log('Successfully downloaded yt-dlp');
            });
        }
    }).on('error', (err) => {
        fs.unlink(dest, () => {});
        console.error('Error downloading yt-dlp:', err.message);
    });
} else {
    console.log('yt-dlp already exists at ' + dest);
}
