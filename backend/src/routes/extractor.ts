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

function ytDlpAuthArgs(): string[] {
  const args: string[] = [];

  if (process.env.ENABLE_IPV6 === 'true') {
    args.push('--force-ipv6');
  }

  // 2. WARP / SOCKS5 Proxy
  if (process.env.WARP_PROXY_URL) {
    args.push('--proxy', process.env.WARP_PROXY_URL);
  }

  // 3. Trigger yt-dlp PO Token Plugin
  args.push('--extractor-args', 'youtube:player-client=web,default');

  const cookiePath = path.resolve(process.cwd(), process.env.YOUTUBE_COOKIES || 'cookies.txt');
  if (fs.existsSync(cookiePath)) {
    args.push('--cookies', cookiePath);
  } else if (os.platform() === 'linux' && !process.env.RENDER && fs.existsSync('/root/.config/google-chrome')) {
    args.push('--cookies-from-browser', 'chrome:/root/.config/google-chrome');
  }
  
  return args;
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

function runYtDlpJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = ['-J', '--no-playlist', url];
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
      data = await runYtDlpJson(url);
      if (!data || !data.formats) {
        throw new Error('No formats found');
      }
    } catch (err: any) {
      console.error(`[Extractor] failed:`, err.message);
      throw new Error('Extractor failed.');
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
