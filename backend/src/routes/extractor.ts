import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import ytdl from '@distube/ytdl-core';
import { getRandomFreeProxies } from '../utils/freeproxy';

const router = Router();

function getYtDlpPath(): string {
  const binPath = path.join(__dirname, '..', '..', 'bin', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return fs.existsSync(binPath) ? binPath : 'yt-dlp';
}

function getCookiesPath(): string | null {
  const cookiePath = path.join(__dirname, '../../cookies.txt');
  return fs.existsSync(cookiePath) ? cookiePath : null;
}

function ytDlpArgs(args: string[], useProxy: boolean | string = false): string[] {
  const base = [
    '--js-runtimes', 'node', 
    '--remote-components', 'ejs:github',
    '--rm-cache-dir',
    '--socket-timeout', '15'
  ];
  
  if (useProxy) {
    const proxyUrl = typeof useProxy === 'string' ? useProxy : process.env.PROXY_URL;
    if (proxyUrl) {
      base.unshift('--proxy', proxyUrl, '--no-check-certificates');
    }
  }

  const cookiesFile = getCookiesPath();
  if (cookiesFile) base.push('--cookies', cookiesFile);
  
  return [...base, ...args];
}

function runYtDlpJson(url: string, useProxy: boolean | string = false): Promise<any> {
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

async function fetchHuntApiData(url: string): Promise<any> {
  const apiKey = process.env.HUNTAPI_KEY;
  if (!apiKey) throw new Error("HUNTAPI_KEY is missing");

  const initRes = await fetch(`https://api.huntapi.com/v1/video/download?query=${encodeURIComponent(url)}`, {
    headers: { 'x-api-key': apiKey }
  });
  if (!initRes.ok) throw new Error(`HuntAPI failed: ${initRes.status}`);
  const initData: any = await initRes.json();
  const jobId = initData.job_id;
  if (!jobId) throw new Error("HuntAPI returned no job_id");

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.huntapi.com/v1/jobs/${jobId}`, {
      headers: { 'x-api-key': apiKey }
    });
    if (!pollRes.ok) continue;
    const pollData: any = await pollRes.json();
    if (pollData.status === 'CompletedJob') return pollData.result;
    if (pollData.status === 'FailedJob') throw new Error("HuntAPI job failed");
  }
  throw new Error("HuntAPI polling timed out");
}

router.get('/info', async (req: Request, res: Response): Promise<void> => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ success: false, message: 'URL is required' });
      return;
    }

    let data;
    let usedHuntAPI = false;

    if (process.env.HUNTAPI_KEY) {
      try {
        console.log(`[Extractor] Tier 1: Fetching metadata from HuntAPI for ${url}`);
        const result = await fetchHuntApiData(url);
        data = {
          title: result.metadata?.title || 'Downloaded Video',
          thumbnail: (result.metadata?.thumbnails && result.metadata.thumbnails.length > 0) 
            ? result.metadata.thumbnails[result.metadata.thumbnails.length - 1].url 
            : (result.metadata?.thumbnail || ''),
          duration: result.metadata?.duration || 0,
          url: result.response || '',
          formats: [{
            quality: result.metadata?.resolution || 'Best Available',
            ext: 'mp4',
            hasAudio: true,
            url: result.response || '',
            vcodec: 'h264',
            fps: 30
          }]
        };
        usedHuntAPI = true;
      } catch (err: any) {
        console.warn(`[Extractor] HuntAPI Tier 1 failed: ${err.message}. Trying yt-dlp natively...`);
      }
    }

    if (!usedHuntAPI) {
      try {
        console.log(`[Extractor] Tier 2: Fetching metadata natively using yt-dlp for ${url}`);
        data = await runYtDlpJson(url, false);
        if (!data || !data.formats) throw new Error('Invalid metadata returned natively');
      } catch (err: any) {
        console.warn(`[Extractor] Tier 2 failed: ${err.message}. Trying Tier 3 (Premium Proxy)...`);
        let success = false;
        
        const premiumProxy = process.env.PROXY_URL;
        if (premiumProxy) {
          try {
            console.log(`[Extractor] Trying Premium Proxy...`);
            data = await runYtDlpJson(url, premiumProxy);
            if (data && data.formats) {
              success = true;
            }
          } catch (e) {
            console.warn(`[Extractor] Premium proxy failed.`);
          }
        }

        if (!success) {
          throw new Error("Metadata extraction failed natively and via proxy.");
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

/* ΓöÇΓöÇ VEVIOZ-STYLE DIRECT URL EXTRACTOR ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.get('/get-urls', async (req: Request, res: Response): Promise<void> => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ success: false, message: 'URL is required' });
      return;
    }

    console.log(`[Vevioz-Extractor] Fetching formats for: ${url}`);
    
    // ytdl-core handles the ciphering and returns direct playback/download URLs
    const info = await ytdl.getInfo(url);
    
    // We only want formats that the browser can directly download and play easily
    // Usually MP4 with both video+audio, or audio-only formats.
    const formats = info.formats.map(f => {
      const isVideo = f.hasVideo && f.hasAudio;
      const isAudioOnly = f.hasAudio && !f.hasVideo;
      
      return {
        qualityLabel: f.qualityLabel || (f.audioBitrate ? `${f.audioBitrate}kbps` : 'Unknown'),
        mimeType: f.mimeType,
        url: f.url,
        hasVideo: f.hasVideo,
        hasAudio: f.hasAudio,
        contentLength: f.contentLength || null
      };
    }).filter(f => f.hasVideo && f.hasAudio || (!f.hasVideo && f.hasAudio)); // Keep combined MP4s or Audio

    res.json({
      success: true,
      title: info.videoDetails.title,
      thumbnail: info.videoDetails.thumbnails?.[info.videoDetails.thumbnails.length - 1]?.url || '',
      formats: formats
    });
  } catch (error: any) {
    console.error('[Vevioz-Extractor] Error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to extract direct URLs' });
  }
});

export default router;
