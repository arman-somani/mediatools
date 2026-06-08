const fs = require('fs');
let code = fs.readFileSync('backend/src/routes/convert.ts', 'utf8');

const startStr = '      (async () => {\r\n        try {\r\n          const headers = {\r\n            \'x-rapidapi-host\': \'cloud-api-hub-youtube-downloader.p.rapidapi.com\',';
// Since newlines might be \n or \r\n, we will just use a regex that matches the start of the block and the end.
const blockRegex = /\(async \(\) => \{\s*try \{\s*const headers = \{\s*'x-rapidapi-host': 'cloud-api-hub-youtube-downloader\.p\.rapidapi\.com',[\s\S]*?\} catch \(err: any\) \{/g;

const newBlock = (async () => {
        try {
          // Step 1: Get metadata
          let videoTitle = 'YouTube Video';
          try {
            const { stdout } = await execAsync(
              \yt-dlp --print title --no-playlist "\"\
            );
            const lines = stdout.trim().split('\\n');
            videoTitle = (lines[0] || '').trim() || 'YouTube Video';
          } catch { /* keep defaults */ }

          const safeTitle = sanitizeFilename(videoTitle) || 'YouTube Video';
          conversion.youtubeTitle = videoTitle;
          await conversion.save();

          // Step 2: Download video in its native format without remuxing
          const formatMap: Record<string, string> = {
            '360p': 'res:360,ext:mp4:m4a',
            '480p': 'res:480,ext:mp4:m4a',
            '720p': 'res:720,ext:mp4:m4a',
            '1080p': 'res:1080,ext:mp4:m4a',
            '4K': 'res:2160,ext:mp4:m4a',
            '8K': 'res:4320,ext:mp4:m4a',
          };
          const ytSort = formatMap[videoQuality] || formatMap['720p'];

          const ytdlp = spawn('yt-dlp', ['-S', ytSort, '-o', path.join(outputDir, \\.%(ext)s\), '--no-playlist', cleanUrl]);

          let lastUpdate = Date.now();
          ytdlp.stdout.on('data', (data) => {
            const output = data.toString();
            const match = output.match(/\\[download\\]\\s+([\\d\\.]+)%/);
            if (match) {
              const progress = Math.round(parseFloat(match[1]));
              const now = Date.now();
              if (now - lastUpdate > 1000) {
                lastUpdate = now;
                Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => { });
              }
            }
          });

          await new Promise((resolve, reject) => {
            ytdlp.on('close', (code) => {
              if (code === 0) resolve(true);
              else reject(new Error('yt-dlp failed with code ' + code));
            });
          });

          // Find the actual downloaded file since the extension could be .webm, .mkv, or .mp4
          const files = fs.readdirSync(outputDir);
          const downloadedFile = files.find(f => f.startsWith(fileId + '.') && !f.endsWith('.part') && !f.endsWith('.ytdl'));
          
          if (downloadedFile) {
            const actualExt = path.extname(downloadedFile);
            conversion.outputPath = path.join(outputDir, downloadedFile);
            conversion.outputFilename = \\ (\)\\;
          }

          // Step 3: Mark complete
          conversion.status = 'completed';
          conversion.progress = 100;
          conversion.fileSize = getFileSize(conversion.outputPath);
          conversion.outputUrl = \/outputs/\\;
          await conversion.save();
        } catch (err: any) {;

code = code.replace(blockRegex, newBlock);
fs.writeFileSync('backend/src/routes/convert.ts', code);
