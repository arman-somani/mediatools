import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { getRandomFreeProxies } from '../utils/freeproxy';
import ytdl from '@distube/ytdl-core';
import play from 'play-dl';
const router = Router();

function getYtDlpPath(): string {
  const binPath = path.join(__dirname, '..', '..', 'bin', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return fs.existsSync(binPath) ? binPath : 'yt-dlp';
}

function ytDlpAuthArgs(): string[] {
  // If running on Colab (Linux) and the Chrome profile exists, extract fresh cookies directly!
  if (os.platform() === 'linux' && fs.existsSync('/root/.config/google-chrome')) {
    return ['--cookies-from-browser', 'chrome:/root/.config/google-chrome'];
  }
  
  // Fallback for Windows/local development
  const cookiePath = path.resolve(process.cwd(), process.env.YOUTUBE_COOKIES || 'cookies.txt');
  if (fs.existsSync(cookiePath)) {
    return ['--cookies', cookiePath];
  }
  return [];
}

function ytDlpArgs(args: string[]): string[] {
  const base = [
    '--remote-components', 'ejs:github',
    // '--rm-cache-dir', // DO NOT remove cache, oauth2 token is stored here!
    '--socket-timeout', '10',
    '--retries', '0',
    '--extractor-retries', '0',
    '--fragment-retries', '0',
    '--extractor-args', 'youtube:player-client=android_vr,web,default'
  ];

  return [...base, ...ytDlpAuthArgs(), ...args];
}

function runYtDlpJson(url: string, proxy?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = ['-J', '--no-playlist', url];
    if (proxy) args.unshift('--proxy', proxy);
    const child = spawn(getYtDlpPath(), ytDlpArgs(args), { windowsHide: true });
    const stdoutChunks: Buffer[] = [];
    let stderr = '';

    child.stdout.on('data', chunk => stdoutChunks.push(chunk));
    child.stderr.on('data', data => { stderr += data.toString(); });
    
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        try {
          const stdoutStr = Buffer.concat(stdoutChunks).toString('utf-8');
          const lines = stdoutStr.trim().split('\n');
          const jsonLine = lines.reverse().find(l => l.trim().startsWith('{')) || stdoutStr;
          const json = JSON.parse(jsonLine);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse yt-dlp JSON output'));
        }
      } else {
        reject(new Error((stderr || `yt-dlp failed with code ${code}`).trim()));
      }
    });
  });
}


router.get('/info', async (req: Request, res: Response): Promise<void> => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ success: false, message: 'URL is required' });
      return;
    }

    let data;

    try {
      console.log(`[Extractor] Tier 1: Fetching metadata natively (using cached cookies)...`);
      data = await runYtDlpJson(url);
      if (!data || !data.formats) throw new Error('Invalid metadata from Native Connection');
      console.log(`[Extractor] yt-dlp succeeded natively`);
    } catch (tier1Err: any) {
      console.warn(`[Extractor] Tier 1 (Native) failed: ${tier1Err.message}. Triggering Tier 2 (Proxy Network 1)...`);
      try {
        const { getRandomFreeProxies } = require('../utils/freeproxy');
        const proxies = await getRandomFreeProxies(10);
        let success = false;
        for (const proxy of proxies) {
          console.log(`[Extractor] Trying Tier 2 proxy: ${proxy}`);
          try {
            data = await runYtDlpJson(url, proxy);
            if (data && data.formats) { success = true; break; }
          } catch(e) { console.warn(`[Extractor] Proxy ${proxy} failed.`); }
        }
        if (!success) throw new Error('All Tier 2 proxies failed.');
      } catch (tier2Err: any) {
        console.warn(`[Extractor] Tier 2 failed: ${tier2Err.message}. Triggering Tier 3 (Proxy Network 2)...`);
        try {
          const { getRandomFreeProxies } = require('../utils/freeproxy');
          const proxies = await getRandomFreeProxies(10);
          let success = false;
          for (const proxy of proxies) {
            console.log(`[Extractor] Trying Tier 3 proxy: ${proxy}`);
            try {
              data = await runYtDlpJson(url, proxy);
              if (data && data.formats) { success = true; break; }
            } catch(e) { console.warn(`[Extractor] Proxy ${proxy} failed.`); }
          }
          if (!success) throw new Error('All Tier 3 proxies failed.');
        } catch (tier3Err: any) {
          console.error(`[Extractor] Tier 3 failed:`, tier3Err.message);
          console.log(`[Extractor] Triggering Tier 5 (@distube/ytdl-core)...`);
          try {
            const ytdl = require('@distube/ytdl-core');
            const info = await ytdl.getInfo(url);
            data = {
              title: info.videoDetails.title,
              thumbnail: info.videoDetails.thumbnails?.[0]?.url,
              duration: parseInt(info.videoDetails.lengthSeconds || '0', 10),
              url: url,
              formats: info.formats.map((f: any) => ({
                url: f.url,
                ext: f.container,
                vcodec: f.hasVideo ? (f.videoCodec || 'unknown') : 'none',
                acodec: f.hasAudio ? (f.audioCodec || 'unknown') : 'none',
                height: f.height,
                format_note: f.qualityLabel,
                filesize: f.contentLength ? parseInt(f.contentLength, 10) : null,
                fps: f.fps,
                abr: f.audioBitrate
              }))
            };
            console.log(`[Extractor] ytdl-core succeeded`);
            } catch (tier5Err: any) {
              console.error(`[Extractor] Tier 5 failed:`, tier5Err.message);
              console.log(`[Extractor] Triggering Tier 6 (play-dl)...`);
              try {
                const play = require('play-dl');
                const info = await play.video_info(url);
                data = {
                  title: info.video_details.title,
                  thumbnail: info.video_details.thumbnails?.[0]?.url,
                  duration: info.video_details.durationInSec,
                  url: url,
                  formats: info.format.map((f: any) => ({
                    url: f.url,
                    ext: f.mimeType ? f.mimeType.split(';')[0].split('/')[1] : 'unknown',
                    vcodec: f.hasVideo ? 'unknown' : 'none',
                    acodec: f.hasAudio ? 'unknown' : 'none',
                    height: f.height || (f.qualityLabel ? parseInt(f.qualityLabel, 10) : undefined),
                    format_note: f.qualityLabel,
                    filesize: f.contentLength ? parseInt(f.contentLength, 10) : null,
                    fps: f.fps,
                    abr: f.bitrate ? Math.round(f.bitrate / 1000) : undefined
                  }))
                };
                console.log(`[Extractor] play-dl succeeded`);
              } catch (tier6Err: any) {
                console.error(`[Extractor] Tier 6 failed:`, tier6Err.message);
                throw new Error('All extractor attempts failed across all tiers.');
              }
            }
          }
        }
      }

    if (!data) {
      res.status(500).json({ success: false, message: 'Failed to extract video data (null returned)' });
      return;
    }

    const title = data.title || 'Downloaded Video';
    const thumbnail = data.thumbnail || '';
    const duration = data.duration || 0;
    const formats = data.formats || [];

    const videoFormats: any[] = [];
    const audioFormats: any[] = [];

    formats.forEach((f: any) => {
      if (!f.url || f.protocol === 'mhtml') return;

      const ext = f.ext || 'unknown';
      const isVideo = f.vcodec !== 'none' && !!f.vcodec;
      const isAudio = f.acodec !== 'none' && !!f.acodec;

      if (isVideo) {
        let quality = f.format_note || `${f.height}p`;
        if (f.height) quality = `${f.height}p`;

        videoFormats.push({
          quality,
          ext,
          hasAudio: isAudio,
          url: f.url,
          size: f.filesize || f.filesize_approx || null,
          vcodec: f.vcodec,
          fps: f.fps
        });
      } else if (isAudio && !isVideo) {
        let quality = f.format_note || (f.abr ? `${Math.round(f.abr)}kbps` : 'Audio');

        audioFormats.push({
          quality,
          ext,
          url: f.url,
          size: f.filesize || f.filesize_approx || null,
          acodec: f.acodec,
          abr: f.abr
        });
      }
    });

    videoFormats.sort((a, b) => {
      const ah = parseInt(a.quality) || 0;
      const bh = parseInt(b.quality) || 0;
      return bh - ah;
    });

    audioFormats.sort((a, b) => {
      const aa = a.abr || 0;
      const ba = b.abr || 0;
      return ba - aa;
    });

    res.json({
      success: true,
      data: {
        title,
        thumbnail,
        duration,
        videoUrl: data.url || videoFormats[0]?.url || '',
        formats: {
          video: videoFormats,
          audio: audioFormats
        }
      }
    });

  } catch (error: any) {
    console.error('Extractor API Error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to extract video information' });
  }
});

export default router;
