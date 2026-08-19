import { Router, Request, Response } from 'express';
import { spawn, execSync } from 'child_process';
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

import { getActiveCookieFile } from '../utils/cookieManager';

function ytDlpAuthArgs(proxy?: string): string[] {
  const args: string[] = [];
  if (proxy) args.push('--proxy', proxy);

  const cookieFile = getActiveCookieFile();
  if (cookieFile) args.push('--cookies', cookieFile);

  return args;
}

function ytDlpArgs(args: string[], proxy?: string): string[] {
  const base = [
    '--remote-components', 'ejs:github',
    // '--rm-cache-dir', // DO NOT remove cache, oauth2 token is stored here!
    '--socket-timeout', '15',
    '--retries', '0',
    '--extractor-retries', '0',
    '--fragment-retries', '0',
    '--no-check-certificate',
    '--extractor-args', 'youtube:player_client=tv,web_embedded;player_skip=webpage',
    '--force-ipv4'
  ];

  return [...base, ...ytDlpAuthArgs(proxy), ...args];
}

function runYtDlpJson(url: string, proxy?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = ['-J', '--no-playlist', url];
    const child = spawn(getYtDlpPath(), ytDlpArgs(args, proxy), { windowsHide: true });
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

    let success = false;

    for (let i = 0; i < 3; i++) {
      const proxy = undefined;
      console.log(`[Attempt ${i + 1}/3] Fetching extractor info${proxy ? ` with proxy: ${proxy}` : ' directly'}...`);
      try {
        data = await runYtDlpJson(url, proxy);
        if (!data || !data.formats) {
          throw new Error('No formats found');
        }
        success = true;
        break;
      } catch (err: any) {
        console.warn(`[Attempt ${i + 1}/3] Extractor failed:`, err.message);
      }
    }

    if (!success) {
      throw new Error('Extractor failed across all attempts.');
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
