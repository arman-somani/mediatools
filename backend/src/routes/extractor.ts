import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { getRandomFreeProxies } from '../utils/freeproxy';

const router = Router();

function getYtDlpPath(): string {
  const binPath = path.join(__dirname, '..', '..', 'bin', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return fs.existsSync(binPath) ? binPath : 'yt-dlp';
}

function getCookiesPath(): string | null {
  const cookiePath = path.join(__dirname, '../../outputs/youtube_cookies.txt');
  return fs.existsSync(cookiePath) ? cookiePath : null;
}

function ytDlpArgs(args: string[]): string[] {
  const base = [
    '--remote-components', 'ejs:github',
    '--rm-cache-dir',
    '--socket-timeout', '10',
    '--retries', '0',
    '--extractor-retries', '0',
    '--fragment-retries', '0',
    '--extractor-args', 'youtube:player-client=ios,android,web'
  ];

  const cookiesFile = getCookiesPath();
  if (cookiesFile) base.push('--cookies', cookiesFile);
  
  return [...base, ...args];
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
      console.warn(`[Extractor] Tier 1 (Native) failed: ${tier1Err.message}. Triggering Tier 2 (Cookie Harvester)...`);
      try {
        const { harvestCookies } = require('../utils/browser');
        await harvestCookies(url);
        console.log(`[Extractor] Fresh cookies harvested. Retrying yt-dlp natively...`);
        data = await runYtDlpJson(url);
        if (!data || !data.formats) throw new Error('Invalid metadata after harvesting cookies');
        console.log(`[Extractor] yt-dlp succeeded after Cookie Harvester`);
      } catch (tier2Err: any) {
        console.error(`[Extractor] Tier 2 (Cookie Harvester) failed: ${tier2Err.message}. Triggering Tier 3 (Proxy Network)...`);
        try {
          const { getRandomFreeProxies } = require('../utils/freeproxy');
          const proxies = await getRandomFreeProxies(10);
          let success = false;
          for (const proxy of proxies) {
            console.log(`[Extractor] Trying Tier 3 proxy: ${proxy}`);
            try {
              data = await runYtDlpJson(url, proxy);
              if (data && data.formats) {
                success = true;
                break;
              }
            } catch(e) {
              console.warn(`[Extractor] Proxy ${proxy} failed.`);
            }
          }
          if (!success) throw new Error('All Tier 3 proxies failed.');
        } catch (tier3Err: any) {
           console.error(`[Extractor] Tier 3 (Proxy Network) failed:`, tier3Err.message);
           throw new Error('All extractor attempts failed across all tiers.');
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
      title,
      thumbnail,
      duration,
      videoUrl: data.url || videoFormats[0]?.url || '',
      formats: {
        video: videoFormats,
        audio: audioFormats
      }
    });

  } catch (error: any) {
    console.error('Extractor API Error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to extract video information' });
  }
});

export default router;
