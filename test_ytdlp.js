const { spawn } = require('child_process');
const path = require('path');

const ytdlp = spawn(
  path.join(__dirname, 'bin', 'yt-dlp.exe'),
  [
    '--newline',
    '-f', 'bv*+ba/b',
    '-S', 'res:720',
    '--merge-output-format', 'mp4',
    '-o', path.join(__dirname, 'outputs', 'test.%(ext)s'),
    '--no-playlist',
    '--concurrent-fragments', '10',
    '--http-chunk-size', '10M',
    '--hls-prefer-native',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw'
  ],
  { windowsHide: true }
);

ytdlp.stdout.on('data', d => console.log('STDOUT:', d.toString()));
ytdlp.stderr.on('data', d => console.log('STDERR:', d.toString()));
ytdlp.on('close', code => console.log('CLOSED WITH CODE:', code));
