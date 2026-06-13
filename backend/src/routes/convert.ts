import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

function getYtDlpPath(): string {
  const binPath = path.join(__dirname, '..', '..', 'bin', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return fs.existsSync(binPath) ? binPath : 'yt-dlp';
}

import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { Conversion } from '../models/Conversion';
import { User } from '../models/User';
import { Innertube, UniversalCache, Platform, ClientType } from 'youtubei.js';
import ytdl from '@distube/ytdl-core';
import vm from 'vm';

import { getRandomFreeProxies } from '../utils/freeproxy';
import { uploadToGoFile } from '../utils/gofile';

// Determine the path to a cookies file for yt-dlp to bypass YouTube bot restrictions
function getCookiesPath(): string | null {
  const cookiePath = path.join(__dirname, '../../cookies.txt');
  return fs.existsSync(cookiePath) ? cookiePath : null;
}

Platform.shim.eval = (script: any) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
};



const router = Router();
const execAsync = promisify(exec);

// Dummy comment to trigger GitHub auto-sync test 2

function getYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Instantly return if it's already a raw 11-character Video ID
  if (/^[0-9A-Za-z_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return /^[0-9A-Za-z_-]{11}$/.test(id || '') ? id : null;
    }

    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const watchId = parsed.searchParams.get('v');
      if (/^[0-9A-Za-z_-]{11}$/.test(watchId || '')) return watchId;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const pathId = parts.find((part, index) =>
        ['shorts', 'embed', 'live'].includes(parts[index - 1]) && /^[0-9A-Za-z_-]{11}$/.test(part)
      );
      return pathId || null;
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([0-9A-Za-z_-]{11})/);
    return match?.[1] || null;
  }

  return null;
}

function ytDlpArgs(args: string[], useProxy: boolean | string = false): string[] {
  const base = [
    '--js-runtimes', 'node', 
    '--remote-components', 'ejs:github',
    '--rm-cache-dir'
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

function runYtDlp(args: string[], useProxy: boolean | string = false): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(getYtDlpPath(), ytDlpArgs(args, useProxy), { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `yt-dlp failed with code ${code}`).trim()));
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

function findDownloadedFile(fileId: string): string | null {
  const files = fs.readdirSync(outputDir);
  return files.find(file =>
    file.startsWith(`${fileId}.`) &&
    !file.endsWith('.part') &&
    !file.endsWith('.ytdl') &&
    !file.endsWith('.temp')
  ) || null;
}

function requireWrittenFile(filePath: string, label: string): void {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw new Error(`${label} did not produce a downloadable file`);
  }
}

async function writeWebStreamToFile(stream: ReadableStream<Uint8Array>, filePath: string): Promise<void> {
  await pipeline(Readable.fromWeb(stream as any), fs.createWriteStream(filePath));
}

async function writeAsyncIterableToFile(stream: AsyncIterable<Uint8Array>, filePath: string): Promise<void> {
  await pipeline(Readable.from(stream as any), fs.createWriteStream(filePath));
}

router.get('/version', (req: Request, res: Response) => {
  res.json({ version: 'v4_nightly_build_fix' });
});

router.post('/test-ytdlp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { args } = req.body;
    const { stdout, stderr } = await execAsync(`"${getYtDlpPath()}" ${args}`);
    res.json({ stdout, stderr });
  } catch (e: any) {
    res.json({ error: e.message, stdout: e.stdout?.toString(), stderr: e.stderr?.toString() });
  }
});

router.get('/test-ytdlcore', async (req: Request, res: Response): Promise<void> => {
  try {
    const videoId = req.query.id as string || 'dQw4w9WgXcQ';
    const info = await ytdl.getInfo(videoId);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    
    // Test the download url
    const r = await fetch(format.url, { headers: { 'Range': 'bytes=0-99' }});
    res.json({ success: true, title: info.videoDetails.title, formatUrl: format.url.slice(0, 50), downloadStatus: r.status });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const outputDir = process.env.OUTPUT_DIR || './outputs';

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE_MB || 250) * 1024 * 1024 },
});

function getFileSize(filePath: string): number | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return fs.statSync(filePath).size;
}

function safeAudioQuality(value: unknown): '128' | '192' | '320' {
  const q = String(value || '192');
  return ['128', '192', '320'].includes(q) ? q as '128' | '192' | '320' : '192';
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/* ΓöÇΓöÇ Video TO Audio ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const file = req.file;
      const quality = safeAudioQuality(req.body.quality);

      if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
      if (!file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return; }

      const outputFilename = `${uuidv4()}.mp3`;
      const outputPath = path.join(outputDir, outputFilename);

      const conversion: any = await Conversion.create({
        userId,
        type: 'Video',
        status: 'processing',
        originalName: file.originalname,
        outputFilename: file.originalname.replace(/\.[^.]+$/, '') + '.mp3', // user-facing name
        outputPath,
        outputUrl: `/outputs/${outputFilename}`,
        quality: quality as '128' | '192' | '320',
        progress: 0,
      });

      try {
        let totalDurationSecs = 0;
        try {
          const { stdout: probeOut } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`);
          totalDurationSecs = parseFloat(probeOut.trim());
        } catch (e) {
          console.warn('ffprobe failed, progress may be inaccurate');
        }

        const ffmpeg = spawn('ffmpeg', ['-y', '-i', file.path, '-vn', '-ab', `${quality}k`, outputPath]);

        let lastUpdate = Date.now();
        ffmpeg.stderr.on('data', (data) => {
          if (!totalDurationSecs || totalDurationSecs <= 0) return;
          const output = data.toString();
          const match = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (match) {
            const h = parseFloat(match[1]);
            const m = parseFloat(match[2]);
            const s = parseFloat(match[3]);
            const currentSecs = h * 3600 + m * 60 + s;
            const progress = Math.min(Math.round((currentSecs / totalDurationSecs) * 100), 99);

            const now = Date.now();
            if (now - lastUpdate > 1000) {
              lastUpdate = now;
              Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => { });
            }
          }
        });

        await new Promise((resolve, reject) => {
          ffmpeg.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error('FFmpeg failed with code ' + code));
          });
        });

        conversion.fileSize = getFileSize(outputPath);
        // GoFile upload removed

        conversion.status = 'completed';
        conversion.progress = 100;
        await conversion.save();
        await User.findByIdAndUpdate(userId, { $inc: { totalConversions: 1 } });
      } catch (ffmpegError: any) {
        conversion.status = 'failed';
        conversion.errorMessage = ffmpegError.message || 'FFmpeg failed';
        await conversion.save();
      }

      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

      res.json({
        success: true,
        message: 'Conversion complete',
        data: {
          jobId: conversion._id.toString(),
          conversionId: conversion._id.toString(),
          fileSize: conversion.fileSize,
          downloadUrl: `http://localhost:5000/api/convert/download/${conversion._id}`,
        },
      });
    } catch (error: any) {
      console.error('Video error:', error);
      res.status(500).json({ success: false, message: error.message || 'Conversion failed' });
    }
  }
);



/* ΓöÇΓöÇ YOUTUBE FORMATS EXTRACTOR (Used by WASM Extension) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.post('/youtube-formats', async (req: Request, res: Response): Promise<void> => {
  try {
    const videoUrl = req.body.url;
    if (!videoUrl) {
      res.status(400).json({ success: false, message: 'Video URL is required' });
      return;
    }

    // Because ytdl-core broke globally, we use the incredibly reliable yt-dlp binary to decipher!
    // We request the best video up to 1080p, and the best audio.
    const resTitle = await runYtDlp(['--print', 'title', '--no-playlist', videoUrl]);
    const title = resTitle.stdout.trim();

    const resUrls = await runYtDlp(['-f', 'bestvideo[height<=1080]+bestaudio', '--get-url', videoUrl]);
    const urls = resUrls.stdout.trim().split('\n').filter(line => line.startsWith('http'));

    if (urls.length < 2) {
      // Fallback if video+audio extraction failed
      res.status(400).json({ success: false, message: 'Could not find separated audio and video formats for merging.' });
      return;
    }

    res.json({
      success: true,
      videoUrl: urls[0], // First URL is video
      audioUrl: urls[1], // Second URL is audio
      title: title
    });
  } catch (error: any) {
    console.error('youtube-formats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to extract formats via yt-dlp' });
  }
});

/* ΓöÇΓöÇ UNIVERSAL VIDEO METADATA ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.post('/universal/metadata', async (req: Request, res: Response): Promise<void> => {
  try {
    const videoUrl = req.body.url;
    if (!videoUrl) {
      res.status(400).json({ success: false, message: 'Video URL is required' });
      return;
    }

    const cleanUrl = String(videoUrl).trim();

    let title = 'Downloaded Video';
    let thumbnail = '';
    let resolution = 'Best Available';
    let sizeBytes = 0;
    let directVideoUrl = '';
    let success = false;

    if (process.env.HUNTAPI_KEY) {
      try {
        console.log('[Universal] Trying HuntAPI for metadata...');
        const result = await fetchHuntApiData(cleanUrl);
        title = result.metadata?.title || 'Downloaded Video';
        thumbnail = (result.metadata?.thumbnails && result.metadata.thumbnails.length > 0) 
            ? result.metadata.thumbnails[result.metadata.thumbnails.length - 1].url 
            : (result.metadata?.thumbnail || '');
        resolution = result.metadata?.resolution || 'Best Available';
        directVideoUrl = result.response || '';
        success = true;
      } catch (err: any) {
        console.warn('[Universal] HuntAPI failed:', err.message);
      }
    }

    if (!success) {
      console.log('[Universal] HuntAPI failed or missing, trying yt-dlp...');
      let stdout = '';
      const args = [
        '--print', '%(title)s',
        '--print', '%(thumbnail)s',
        '--print', '%(resolution)s',
        '--print', '%(filesize_approx,filesize)s',
        '--print', '%(url)s',
        '--no-playlist',
        cleanUrl,
      ];

      try {
        const res = await runYtDlp(args, false);
        stdout = res.stdout;
      } catch (e) {
        console.warn('Universal metadata native fetch failed, trying proxy...');
        let ytSuccess = false;
        try {
          const res = await runYtDlp(args, true); // try true to use process.env.PROXY_URL
          stdout = res.stdout;
          ytSuccess = true;
        } catch (err) {}
        if (!ytSuccess) {
          throw new Error("Metadata extraction failed.");
        }
      }

      const lines = stdout.trim().split('\n');
      title = (lines[0] || '').trim() || 'Downloaded Video';
      thumbnail = (lines[1] || '').trim();
      if (thumbnail === 'NA') thumbnail = '';
      resolution = (lines[2] || '').trim() || 'Best Available';
      sizeBytes = parseInt((lines[3] || '').trim(), 10);
      directVideoUrl = (lines[4] || '').trim();
      if (isNaN(sizeBytes)) sizeBytes = 0;
    }

    res.json({
      success: true,
      data: {
        title,
        thumbnail,
        resolution: resolution === 'NA' ? 'Best Available' : resolution,
        sizeBytes,
        videoUrl: directVideoUrl === 'NA' ? '' : directVideoUrl
      },
    });
  } catch (error: any) {
    console.error('Universal metadata error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch video info' });
  }
});

/* ΓöÇΓöÇ UNIVERSAL VIDEO DOWNLOADER ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.post('/universal', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const videoUrl = req.body.url;
    const reqQuality = String(req.body.mp4Quality || req.body.videoQuality || req.body.quality || '720p');
    const videoQuality: string = (['360p', '480p', '720p', '1080p', '4K', '8K'].includes(reqQuality))
      ? reqQuality : '720p';

    if (!videoUrl) {
      res.status(400).json({ success: false, message: 'Video URL is required' });
      return;
    }

    const cleanUrl = String(videoUrl).trim();
    const fileId = uuidv4();
    const diskFilename = `${fileId}.mp4`;
    const outputPath = path.join(outputDir, diskFilename);

    // Map quality label to yt-dlp sort filter for maximum compatibility across all platforms
    const formatMap: Record<string, string> = {
      '360p': 'res:360',
      '480p': 'res:480',
      '720p': 'res:720',
      '1080p': 'res:1080',
      '4K': 'res:2160',
      '8K': 'res:4320',
    };
    const ytSort = formatMap[videoQuality] || formatMap['720p'];

    const conversion: any = await Conversion.create({
      userId: req.user?.id,
      type: 'universal',
      status: 'processing',
      youtubeUrl: cleanUrl, // Using existing schema field to store URL
      youtubeTitle: 'Fetching info...',
      outputFilename: diskFilename,
      outputPath,
      outputUrl: `/outputs/${diskFilename}`,
      quality: '192',
      videoQuality: videoQuality as any,
      progress: 0,
    });

    // Respond immediately ? frontend starts polling
    res.json({
      success: true,
      message: 'Universal video download started',
      data: {
        jobId: conversion._id.toString(),
        conversionId: conversion._id.toString(),
      },
    });

    // Background processing
    (async () => {
      try {
        let videoTitle = 'Downloaded Video';
        let thumbnail = '';
        let directVideoUrl = '';
        let downloadSuccess = false;

        // Step 1: Try HuntAPI first for instant external URL
        if (process.env.HUNTAPI_KEY) {
          try {
            console.log('[Universal Download] Trying HuntAPI...');
            const result = await fetchHuntApiData(cleanUrl);
            videoTitle = result.metadata?.title || 'Downloaded Video';
            thumbnail = (result.metadata?.thumbnails && result.metadata.thumbnails.length > 0) 
                ? result.metadata.thumbnails[result.metadata.thumbnails.length - 1].url 
                : (result.metadata?.thumbnail || '');
            directVideoUrl = result.response || '';
            if (directVideoUrl) downloadSuccess = true;
          } catch (err: any) {
            console.warn('[Universal Download] HuntAPI failed:', err.message);
          }
        }

        if (downloadSuccess && directVideoUrl) {
          const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Video';
          conversion.youtubeTitle = videoTitle;
          conversion.youtubeThumbnail = thumbnail;
          conversion.outputFilename = `${safeTitle}.mp4`;
          conversion.outputUrl = directVideoUrl;
          conversion.status = 'completed';
          conversion.progress = 100;
          await conversion.save();
          console.log('[Universal Download] Completed via HuntAPI direct URL.');
          return;
        }

        // Step 2: Fallback to yt-dlp metadata and download
        try {
          let stdout = '';
          try {
            const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--no-playlist', cleanUrl], false);
            stdout = res.stdout;
          } catch (e) {
            let success = false;
            try {
              const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--no-playlist', cleanUrl], true);
              stdout = res.stdout;
              success = true;
            } catch (err) {}
            if (!success) console.warn('yt-dlp metadata fetch failed.');
          }
          const lines = stdout.trim().split('\n');
          const dlTitle = (lines[0] || '').trim();
          if (dlTitle && dlTitle !== 'Downloaded Video') videoTitle = dlTitle;
          const dlThumb = (lines[1] || '').trim();
          if (dlThumb) thumbnail = dlThumb;
        } catch { /* keep defaults */ }

        const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Video';
        conversion.youtubeTitle = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename = `${safeTitle}.mp4`;
        await conversion.save();

        // Step 2: Download video in its native format without remuxing
        // We use -S for sorting formats which is highly optimized for ANY website!
        let videoDownloaded = false;
        
        for (const useProxy of [false]) {
          if (videoDownloaded) break;
          try {
            console.log(`Trying yt-dlp UNIVERSAL for video... (Proxy: ${useProxy})`);
            const ytdlp = spawn(getYtDlpPath(), ytDlpArgs([
              '--newline',
              '-f', 'bv*+ba/b',
              '-S', ytSort,
              '--merge-output-format', 'mp4',
              '-o', path.join(outputDir, `${fileId}.%(ext)s`),
              '--no-playlist',
              '--concurrent-fragments', '10',
              '--http-chunk-size', '10M',
              '--hls-prefer-native',
              cleanUrl,
            ], useProxy), { windowsHide: true });

            let lastUpdate = Date.now();
            ytdlp.stdout.on('data', (data) => {
              const output = data.toString();
              const match = output.match(/\[download\]\s+([\d.]+)%/);
              if (match) {
                const progress = parseFloat(match[1]);
                if (!isNaN(progress)) {
                  const now = Date.now();
                  if (now - lastUpdate > 1000) {
                    lastUpdate = now;
                    Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => { });
                  }
                }
              }
            });

            ytdlp.stderr.on('data', (data) => {
              console.error(`[yt-dlp UNIVERSAL ERROR (Proxy: ${useProxy})]:`, data.toString());
            });

            await new Promise((resolve, reject) => {
              ytdlp.on('close', (code) => {
                if (code === 0) resolve(true);
                else reject(new Error('yt-dlp failed with code ' + code));
              });
            });
            
            videoDownloaded = true;
            console.log(`yt-dlp UNIVERSAL succeeded (Proxy: ${useProxy})`);
          } catch (e: any) {
            console.error(`yt-dlp UNIVERSAL failed (Proxy: ${useProxy}):`, e.message);
          }
        }
        
        if (!videoDownloaded) {
          throw new Error('All download attempts failed.');
        }

        // Find the actual downloaded file since the extension could be .webm, .mkv, or .mp4
        const downloadedFile = findDownloadedFile(fileId);
        
        if (downloadedFile) {
          const actualExt = path.extname(downloadedFile);
          conversion.outputPath = path.join(outputDir, downloadedFile);
          conversion.outputFilename = safeTitle + actualExt;
        }
        requireWrittenFile(conversion.outputPath, 'Universal download');

        // Step 3: Mark complete
        conversion.fileSize = getFileSize(conversion.outputPath);
        conversion.outputUrl = `/outputs/${path.basename(conversion.outputPath)}`;
        // GoFile upload removed

        conversion.status = 'completed';
        conversion.progress = 100;
        await conversion.save();

      } catch (err: any) {
        console.error('Universal video background error:', err.message);
        try {
          conversion.status = 'failed';
          conversion.errorMessage = err.message || 'Download failed';
          await conversion.save();
        } catch { }
      }
    })();

  } catch (error: any) {
    console.error('Universal route error:', error);
    res.status(500).json({ success: false, message: error.message || 'Universal video download failed' });
  }
});

/* ΓöÇΓöÇ YOUTUBE PLAYLIST METADATA ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.post('/youtube-playlist/metadata', async (req: Request, res: Response): Promise<void> => {
  try {
    const playlistUrl = req.body.url;
    if (!playlistUrl) {
      res.status(400).json({ success: false, message: 'Playlist URL is required' });
      return;
    }

    const cleanUrl = String(playlistUrl).trim();

    // Fetch flat playlist JSON (fast, no extraction)
    // --dump-json outputs one JSON object per line per video
    let stdout = '';
    try {
      const res = await runYtDlp(['--flat-playlist', '--dump-json', cleanUrl], false);
      stdout = res.stdout;
    } catch (e) {
      console.warn('Playlist native fetch failed, trying free proxies...');
      let success = false;
      const freeProxies: string[] = [];
      for (const freeProxy of freeProxies) {
        try {
          const res = await runYtDlp(['--flat-playlist', '--dump-json', cleanUrl], freeProxy);
          stdout = res.stdout;
          success = true;
          break;
        } catch (err) {}
      }
      if (!success) {
        throw new Error("Playlist extraction failed.");
      }
    }

    const lines = stdout.trim().split('\n');
    const videos = lines.map(line => {
      try {
        const item = JSON.parse(line);
        // yt-dlp flat-playlist uses 'id', 'title', 'url'
        const id = item.id || getYouTubeVideoId(item.url || '');
        return {
          id,
          title: item.title,
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        };
      } catch {
        return null;
      }
    }).filter(v => v !== null && v.id && v.title);

    res.json({
      success: true,
      data: { videos },
    });
  } catch (error: any) {
    console.error('Playlist fetch error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch playlist' });
  }
});

/* ΓöÇΓöÇ GET STATUS (frontend polls this) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.get('/status/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const conversion: any = await Conversion.findById(req.params.id).select('-outputPath');
    if (!conversion) {
      res.status(404).json({ success: false, message: 'Conversion not found' });
      return;
    }
    res.json({
      success: true,
      data: {
        jobId: conversion._id.toString(),
        status: conversion.status,
        progress: conversion.progress,
        outputFilename: conversion.outputFilename,
        outputUrl: conversion.outputUrl,
        fileSize: conversion.fileSize,
        youtubeTitle: conversion.youtubeTitle,
        youtubeThumbnail: conversion.youtubeThumbnail,
        errorMessage: conversion.errorMessage,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get status' });
  }
});

/* ΓöÇΓöÇ DOWNLOAD (serves file with proper title as filename) ΓöÇΓöÇ */
router.get('/download/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const conversion: any = await Conversion.findById(req.params.id);
    if (!conversion) {
      res.status(404).json({ success: false, message: 'File not found' }); return;
    }

    conversion.downloadCount += 1;
    await conversion.save();

    // If it's an external URL (from an API), just redirect to it
    if (conversion.outputUrl && conversion.outputUrl.startsWith('http')) {
      res.redirect(conversion.outputUrl);
      return;
    }

    if (!conversion.outputPath || !fs.existsSync(conversion.outputPath)) {
      res.status(404).json({ success: false, message: 'File expired or deleted' }); return;
    }

    // outputFilename = "Song Title.mp3" (user-facing), outputPath = UUID file on disk
    res.download(conversion.outputPath, conversion.outputFilename || 'download.mp3', (err) => {
      let delayMs = 21 * 60 * 1000; // 21 min default
      try {
        if (fs.existsSync(conversion.outputPath)) {
          const stats = fs.statSync(conversion.outputPath);
          if (stats.size > 500 * 1024 * 1024) { // > 500MB
            delayMs = 35 * 60 * 1000; // 35 mins
          }
        }
      } catch (e) {}

      // Schedule cleanup
      setTimeout(async () => {
        try {
          if (fs.existsSync(conversion.outputPath)) {
            fs.unlinkSync(conversion.outputPath);
          }
          // Do NOT delete the database record so it stays in user's history
          console.log(`[CLEANUP] Deleted file for conversion ${conversion._id} after ${delayMs / 60000} mins.`);
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }, delayMs);
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Download failed' });
  }
});

/* ΓöÇΓöÇ PUBLIC FILE (legacy alias) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.get('/public-file/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const conversion: any = await Conversion.findById(req.params.id);
    if (!conversion || !conversion.outputPath) {
      res.status(404).json({ success: false, message: 'File not found' }); return;
    }
    if (!fs.existsSync(conversion.outputPath)) {
      res.status(404).json({ success: false, message: 'File expired or deleted' }); return;
    }
    res.download(conversion.outputPath, conversion.outputFilename || 'download', (err) => {
      let delayMs = 21 * 60 * 1000; // 21 min default
      try {
        if (fs.existsSync(conversion.outputPath)) {
          const stats = fs.statSync(conversion.outputPath);
          if (stats.size > 500 * 1024 * 1024) { // > 500MB
            delayMs = 35 * 60 * 1000; // 35 mins
          }
        }
      } catch (e) {}

      // Schedule cleanup
      setTimeout(async () => {
        try {
          if (fs.existsSync(conversion.outputPath)) {
            fs.unlinkSync(conversion.outputPath);
          }
          // Do NOT delete the database record so it stays in user's history
          console.log(`[CLEANUP] Deleted file for public-file ${conversion._id} after ${delayMs / 60000} mins.`);
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }, delayMs);
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Download failed' });
  }
});

export default router;



