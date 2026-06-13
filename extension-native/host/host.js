const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// The path to your existing yt-dlp binary
const ytDlpPath = path.join(__dirname, '..', '..', 'bin', 'yt-dlp.exe');
const outputDir = path.join(os.homedir(), 'Downloads', 'MediaTools');

// Native Messaging requires length-prefixed messages
function sendMessage(msg) {
  const buffer = Buffer.from(JSON.stringify(msg));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);
  process.stdout.write(header);
  process.stdout.write(buffer);
}

// Ensure output dir exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let chunks = [];
process.stdin.on('data', (chunk) => {
  chunks.push(chunk);
  
  // Combine chunks
  const input = Buffer.concat(chunks);
  
  // Read message length (first 4 bytes)
  if (input.length >= 4) {
    const msgLen = input.readUInt32LE(0);
    if (input.length >= 4 + msgLen) {
      const msgBuf = input.subarray(4, 4 + msgLen);
      const msgStr = msgBuf.toString('utf8');
      
      try {
        const message = JSON.parse(msgStr);
        handleMessage(message);
      } catch (e) {
        sendMessage({ success: false, error: 'Failed to parse message' });
      }
      
      // Clear processed chunks
      chunks = [input.subarray(4 + msgLen)];
    }
  }
});

function handleMessage(message) {
  if (message.action === 'ping') {
    sendMessage({ success: true, status: 'alive' });
    return;
  }

  if (!message.url) {
    sendMessage({ success: false, error: 'No URL provided' });
    return;
  }

  // Acknowledge receipt
  sendMessage({ success: true, message: 'Download started in background...' });

  const isAudio = message.format === 'audio';
  
  const args = [
    '--no-playlist',
    '-o', path.join(outputDir, '%(title)s.%(ext)s'),
  ];
  
  if (isAudio) {
    args.push('-x', '--audio-format', 'mp3');
  } else {
    // Best video/audio format
    args.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
  }
  
  args.push(message.url);

  // Run yt-dlp totally detached in the background
  const child = spawn(ytDlpPath, args, {
    detached: true,
    stdio: 'ignore', // Ignore stdio so it doesn't mess with Native Messaging protocol
    windowsHide: true
  });
  
  child.unref();
}
