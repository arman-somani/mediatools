
const ffmpegPath = require('ffmpeg-static');
const ytdlpPath = require('yt-dlp-exec/src/constants').YOUTUBE_DL_PATH;
const path = require('path');
const ffmpegDir = path.dirname(ffmpegPath);
const ytdlpDir = path.dirname(ytdlpPath);
const delimiter = process.platform === 'win32' ? ';' : ':';
process.env.PATH = ffmpegDir + delimiter + ytdlpDir + delimiter + process.env.PATH;
const { spawnSync } = require('child_process');
console.log('ffmpeg version:', spawnSync('ffmpeg', ['-version']).stdout.toString().split('\n')[0]);
console.log('yt-dlp version:', spawnSync('yt-dlp', ['--version']).stdout.toString().trim());

