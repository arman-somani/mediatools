import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

const router = Router();

function getYtDlpPath(): string {
  const binPath = path.join(__dirname, '..', '..', 'bin', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return fs.existsSync(binPath) ? binPath : 'yt-dlp';
}

function ytDlpArgs(args: string[], useProxy: boolean = false): string[] {
  const base = [
    '--js-runtimes', 'node', 
    '--remote-components', 'ejs:github',
    '--extractor-args', 'youtubetab:skip=webpage,authcheck',
    '--extractor-args', 'youtube:player_skip=webpage,configs;visitor_data=VISITOR_DATA_VALUE_HERE',
    '--extractor-args', 'youtube:player_client=android,web'
  ];
  
  if (useProxy && process.env.PROXY_URL) {
    base.unshift('--proxy', process.env.PROXY_URL, '--no-check-certificates');
  }
  
  return [...base, ...args];
}

function runYtDlpJson(url: string, useProxy: boolean = false): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn(getYtDlpPath(), ytDlpArgs(['-J', '--no-playlist', url], useProxy), { windowsHide: true });
    const stdoutChunks: Buffer[] = [];
    let stderr = '';

    child.stdout.on('data', chunk => stdoutChunks.push(chunk));
    child.stderr.on('data', data => { stderr += data.toString(); });
    
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        try {
          const stdoutStr = Buffer.concat(stdoutChunks).toString('utf-8');
          // yt-dlp sometimes prints warnings to stdout before the JSON blob
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
      console.log(`[Extractor] Tier 1: Fetching metadata natively for ${url}`);
      data = await runYtDlpJson(url, false);
      if (!data || !data.formats) throw new Error('Invalid metadata returned natively');
    } catch (err: any) {
      console.warn(`[Extractor] Tier 1 failed: ${err.message}. Falling back to Tier 2 (Proxy)...`);
      data = await runYtDlpJson(url, true);
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
