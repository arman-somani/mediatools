const fs = require('fs');

let code = fs.readFileSync('src/routes/convert.ts', 'utf8');

// Insert import at the top
code = code.replace(
  "import { uploadToGoFile } from '../utils/gofile';",
  "import { uploadToGoFile } from '../utils/gofile';\nimport { interceptYoutubeStreams } from '../utils/puppeteerInterceptor';"
);

// Inject into AUDIO fallback
const audioTarget = `        try {
          console.log(\`Trying Tier 1: Native Connection (Audio) using cached cookies...\`);
          await runYtDlpAudio();
          console.log(\`yt-dlp AUDIO succeeded on Native Connection\`);
        } catch (tier1Err: any) {
          console.error(\`Tier 1 (Native Connection) failed: \${tier1Err.message}. Triggering Tier 2 (Proxy Network 1)...\`);`;

const audioReplacement = `        try {
          console.log(\`Trying Tier 1: Headless Browser Interception (Puppeteer)...\`);
          const { audioUrl } = await interceptYoutubeStreams(cleanUrl, 'audio');
          if (!audioUrl) throw new Error('Puppeteer failed to intercept audio stream');
          const exactMp3 = path.join(outputDir, \`\${fileId}.mp3\`);
          await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ['-y', '-i', audioUrl, '-vn', '-ab', \`\${audioQuality}k\`, exactMp3]);
            ffmpeg.on('close', code => code === 0 ? resolve(true) : reject(new Error(\`ffmpeg failed with code \${code}\`)));
          });
          console.log(\`Puppeteer AUDIO succeeded\`);
        } catch (puppeteerErr: any) {
          console.error(\`Tier 1 (Puppeteer) failed: \${puppeteerErr.message}. Triggering Tier 2 (Native yt-dlp)...\`);
${audioTarget}`;

code = code.replace(audioTarget, audioReplacement);


// Inject into UNIVERSAL fallback
const univTarget = `        try {
          console.log(\`Trying Tier 1: Native Connection using cached cookies...\`);
          await runYtDlpDownload();
          console.log(\`yt-dlp UNIVERSAL succeeded on Native Connection\`);
        } catch (tier1Err: any) {
          console.error(\`Tier 1 (Native Connection) failed: \${tier1Err.message}. Triggering Tier 2 (Proxy Network 1)...\`);`;

const univReplacement = `        try {
          console.log(\`Trying Tier 1: Headless Browser Interception (Puppeteer)...\`);
          const { videoUrl, audioUrl } = await interceptYoutubeStreams(cleanUrl, 'video');
          if (!videoUrl || !audioUrl) throw new Error('Puppeteer failed to intercept video or audio streams');
          const exactMp4 = path.join(outputDir, \`\${fileId}.mp4\`);
          await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ['-y', '-i', videoUrl, '-i', audioUrl, '-c:v', 'copy', '-c:a', 'aac', exactMp4]);
            ffmpeg.on('close', code => code === 0 ? resolve(true) : reject(new Error(\`ffmpeg failed with code \${code}\`)));
          });
          console.log(\`Puppeteer UNIVERSAL succeeded\`);
        } catch (puppeteerErr: any) {
          console.error(\`Tier 1 (Puppeteer) failed: \${puppeteerErr.message}. Triggering Tier 2 (Native yt-dlp)...\`);
${univTarget}`;

code = code.replace(univTarget, univReplacement);


// Replace ALL instances of the closing blocks (there are exactly 2, one for audio, one for universal)
const closeTarget = `                  } catch (tier6Err: any) {
                    console.error(\`Tier 6 failed:\`, tier6Err.message);
                    throw new Error('All download attempts failed across all tiers.');
                  }
                }
              }
            }
          }`;

const closeReplacement = closeTarget + "\n        }";
code = code.split(closeTarget).join(closeReplacement);

// Switch yt-dlp to use chrome
code = code.replace(
  /'--cookies-from-browser',\s+'chromium',/g,
  `'--cookies-from-browser',\n    'chrome',`
);

fs.writeFileSync('src/routes/convert.ts', code);
