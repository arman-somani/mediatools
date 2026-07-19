import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { exec, spawn, execSync } from 'child_process';
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

import { uploadToGoFile } from '../utils/gofile';
import { getActiveCookieFile } from '../utils/cookieManager';
import { getRandomFreeProxies } from '../utils/freeproxy';

function ytDlpAuthArgs(proxy?: string): string[] {
  const args: string[] = [];
  if (proxy) args.push('--proxy', proxy);
  return args;
}

Platform.shim.eval = (script: any) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
};



const router = Router();
const activePolls = new Map<string, number>();
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

function ytDlpArgs(args: string[], proxy?: string): string[] {
  const base = [
    '--remote-components', 'ejs:github',
    '--js-runtimes', 'node',
    '--socket-timeout', '15',
    '--retries', '0',
    '--extractor-retries', '0',
    '--fragment-retries', '3',
    '--no-warnings',
    '--no-check-certificate'
  ];

  return [...base, ...ytDlpAuthArgs(proxy), ...args];
}

function runYtDlp(args: string[], proxy?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(getYtDlpPath(), ytDlpArgs(args, proxy), { windowsHide: true });
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



function findDownloadedFile(fileId: string): string | null {
  const files = fs.readdirSync(outputDir);
  // Strictly match final merged extensions, ignoring yt-dlp intermediate (.f137.mp4) formats
  return files.find(file => 
    file === `${fileId}.mp4` || 
    file === `${fileId}.mkv` || 
    file === `${fileId}.webm` || 
    file === `${fileId}.mp3`
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
    const r = await fetch(format.url, { headers: { 'Range': 'bytes=0-99' } });
    res.json({ success: true, title: info.videoDetails.title, formatUrl: format.url.slice(0, 50), downloadStatus: r.status });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
const outputDir = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../../outputs'));

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

        activePolls.set(conversion._id.toString(), Date.now());
        const zombieKiller = setInterval(() => {
          const lastPoll = activePolls.get(conversion._id.toString());
          if (lastPoll && Date.now() - lastPoll > 60000) {
             ffmpeg.kill('SIGKILL');
             clearInterval(zombieKiller);
          }
        }, 5000);

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
            clearInterval(zombieKiller);
            activePolls.delete(conversion._id.toString());
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
/* ── YOUTUBE TO MP3 ─────────────────────────────────────── */
router.post('/youtube', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const videoUrl = req.body.youtubeUrl || req.body.url;
    const reqQuality = String(req.body.quality || '320');
    const audioQuality = ['128', '192', '320'].includes(reqQuality) ? reqQuality : '320';

    if (!videoUrl) {
      res.status(400).json({ success: false, message: 'Video URL is required' });
      return;
    }

    const cleanUrl = String(videoUrl).trim();
    const fileId = uuidv4();
    const diskFilename = `${fileId}.mp3`;
    const outputPath = path.join(outputDir, diskFilename);

    const conversion: any = await Conversion.create({
      userId: req.user?.id,
      type: 'youtube',
      status: 'processing',
      youtubeUrl: cleanUrl,
      youtubeTitle: req.body.title || 'Fetching info...',
      outputFilename: diskFilename,
      outputPath,
      outputUrl: `/outputs/${diskFilename}`,
      quality: audioQuality as any,
      progress: 0,
    });

    res.json({
      success: true,
      message: 'YouTube conversion started',
      data: {
        jobId: conversion._id.toString(),
        conversionId: conversion._id.toString(),
      },
    });

    // Background processing
    (async () => {
      try {
        let videoTitle = req.body.title || 'Downloaded Audio';
        let thumbnail = '';

        // Step 1: Fetch metadata via yt-dlp only if we don't have it
        if (!req.body.title) {
          try {
            let metaSuccess = false;
            let stdout = '';
            outerLoopMeta:
            for (let i = 0; i < 10; i++) {
              const proxyTiers = await getRandomFreeProxies(10);
              for (let j = 0; j < proxyTiers.length; j++) {
                try {
                  const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--ignore-no-formats-error', '--no-playlist', cleanUrl], proxyTiers[j]);
                  stdout = res.stdout;
                  metaSuccess = true;
                  break outerLoopMeta;
                } catch (e: any) {
                  console.warn(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] yt-dlp audio title fetch failed: ${e.message}`);
                }
              }
            }
            if (metaSuccess) {
              const lines = stdout.trim().split('\n');
              const dlTitle = (lines[0] || '').trim();
              if (dlTitle && dlTitle !== 'Downloaded Audio') videoTitle = dlTitle;
              const dlThumb = (lines[1] || '').trim();
              if (dlThumb) thumbnail = dlThumb;
            }
          } catch { /* keep defaults */ }
        }

        const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Audio';
        conversion.youtubeTitle = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename = `${safeTitle}.mp3`;
        await conversion.save();

        const runYtDlpAudio = (proxy?: string) => new Promise((resolve, reject) => {
          // Save directly as flat file, not in a subdirectory, to avoid path issues
          const flatOutputTemplate = path.join(outputDir, `${fileId}.%(ext)s`);
          const ytdlpArgsArr = [
            '--newline',
            '-f', 'ba/b',
            '-x', '--audio-format', 'mp3',
            '--audio-quality', `${audioQuality}K`,
            '-o', flatOutputTemplate,
            '--no-playlist',
          ];
          ytdlpArgsArr.push(cleanUrl);

          const ytdlp = spawn(getYtDlpPath(), ytDlpArgs(ytdlpArgsArr, proxy), { windowsHide: true });

          activePolls.set(conversion._id.toString(), Date.now());
          const zombieKiller = setInterval(() => {
            const lastPoll = activePolls.get(conversion._id.toString());
            if (lastPoll && Date.now() - lastPoll > 60000) {
               ytdlp.kill('SIGKILL');
               clearInterval(zombieKiller);
               reject(new Error('User closed the tab. Download cancelled.'));
            }
          }, 5000);

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
                  Conversion.findByIdAndUpdate(conversion._id, { progress: progress }).catch(() => { });
                }
              }
            }
          });

          ytdlp.stderr.on('data', (data) => {
            console.error(`[yt-dlp AUDIO ERROR]:`, data.toString());
          });

          ytdlp.on('close', (code) => {
            clearInterval(zombieKiller);
            activePolls.delete(conversion._id.toString());
            if (code === 0) resolve(true);
            else reject(new Error('yt-dlp audio failed with code ' + code));
          });
        });

        let success = false;

        outerLoopAudio:
        for (let i = 0; i < 10; i++) {
          const tiers = await getRandomFreeProxies(10);
          for (let j = 0; j < tiers.length; j++) {
            const proxy = tiers[j];
            console.log(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] Attempting audio download${proxy ? ` with proxy: ${proxy}` : ' directly'}...`);
            try {
              await runYtDlpAudio(proxy);
              console.log(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] yt-dlp AUDIO succeeded`);
              success = true;
              break outerLoopAudio;
            } catch (err: any) {
              console.error(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] yt-dlp AUDIO failed:`, err.message);
            }
          }
        }

        if (!success) {
          throw new Error('All 10 download tiers failed.');
        }

        // Find the actual downloaded mp3 file (saved as {fileId}.mp3 or {fileId}.m4a etc)
        const findAudioFile = (baseId: string): string | undefined => {
          const exactMp3 = path.join(outputDir, `${baseId}.mp3`);
          if (fs.existsSync(exactMp3)) return exactMp3;
          // Search flat outputDir for any file starting with the fileId
          const files = fs.readdirSync(outputDir);
          const found = files.find(f => f.startsWith(baseId) && !f.endsWith('.part') && !f.endsWith('.ytdl'));
          return found ? path.join(outputDir, found) : undefined;
        };

        const downloadedFilePath = findAudioFile(fileId);

        if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
          throw new Error('Audio download did not produce a downloadable file');
        }

        const downloadedBasename = path.basename(downloadedFilePath);
        conversion.outputPath = downloadedFilePath;
        conversion.outputFilename = videoTitle.replace(/[\/\\\\?%*:|"<>]/g, '-') + '.mp3';
        conversion.fileSize = getFileSize(downloadedFilePath);
        // Use tmpfiles.org for 1 Gbps direct download unthrottled links
        try {
          conversion.status = 'uploading';
          conversion.progress = 100;
          await conversion.save();

          const HUNDRED_MB = 100 * 1024 * 1024;
          if (conversion.fileSize && conversion.fileSize > HUNDRED_MB) {
            try { 
              conversion.gofileUrl = await uploadToGoFile(downloadedFilePath, conversion.outputFilename); 
              conversion.cdnUrl = conversion.gofileUrl; // Redirect main button to GoFile
              conversion.outputUrl = conversion.cdnUrl;
            } catch (e) { console.error('[GoFile] error:', e); }
          } else {
            // <= 100MB: tmpfiles.org for direct high-speed download
            try {
              const { uploadToTmpFiles } = require('../utils/tmpfiles');
              const tmpFilesUrl = await uploadToTmpFiles(downloadedFilePath, conversion.outputFilename);
              conversion.cdnUrl = tmpFilesUrl;
              conversion.outputUrl = tmpFilesUrl; // Frontend directly opens this URL
              console.log(`[TmpFiles] Uploaded successfully: ${tmpFilesUrl}`);
            } catch (e) { 
              console.error('[TmpFiles] error:', e); 
              conversion.outputUrl = `/api/convert/download/${conversion._id}`;
            }
          }

          if (!conversion.outputUrl) {
            conversion.outputUrl = `/api/convert/download/${conversion._id}`;
          }
        } catch (e) {
          console.error('[Upload] failed, falling back to local serve:', e);
          conversion.outputUrl = `/api/convert/download/${conversion._id}`;
        }
        conversion.status = 'completed';
        conversion.progress = 100;
        await conversion.save();

      } catch (err: any) {
        console.error('YouTube audio background error:', err.message);
        try {
          conversion.status = 'failed';
          conversion.errorMessage = err.message || 'Download failed';
          await conversion.save();
        } catch { }
      }
    })();

  } catch (error: any) {
    console.error('YouTube audio route error:', error);
    res.status(500).json({ success: false, message: error.message || 'YouTube audio conversion failed' });
  }
});

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
    const resTitle = await runYtDlp(['--print', 'title', '--ignore-no-formats-error', '--no-playlist', videoUrl]);
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

/* ΓöÇΓöÇ UNIVERSAL VIDEO METADATA ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
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

    if (!success) {
      console.log('[Universal] Trying yt-dlp...');
      let stdout = '';
      const args = [
        '--print', '%(title)s',
        '--print', '%(thumbnail)s',
        '--print', '%(resolution)s',
        '--print', '%(filesize_approx,filesize)s',
        '--print', '%(url)s',
        '--ignore-no-formats-error',
        '--no-playlist',
        cleanUrl,
      ];

      let metaSuccess = false;

      outerLoopUnivMeta:
      for (let i = 0; i < 10; i++) {
        const tiers = await getRandomFreeProxies(10);
        for (let j = 0; j < tiers.length; j++) {
          const proxy = tiers[j];
          console.log(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] Fetching metadata${proxy ? ` with proxy: ${proxy}` : ' directly'}...`);
          try {
            const res = await runYtDlp(args, proxy);
            stdout = res.stdout;
            metaSuccess = true;
            break outerLoopUnivMeta;
          } catch (e: any) {
            console.warn(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] Universal metadata native fetch failed: ${e.message}`);
          }
        }
      }

      if (!metaSuccess) {
        throw new Error("Metadata extraction failed across all 10 tiers.");
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

    // Map quality label to yt-dlp target height for maximum compatibility across all platforms
    const formatMap: Record<string, string> = {
      '360p': '360',
      '480p': '480',
      '720p': '720',
      '1080p': '1080',
      '4K': '2160',
      '8K': '4320',
    };
    const targetHeight = formatMap[videoQuality] || '720';

    const conversion: any = await Conversion.create({
      userId: req.user?.id,
      type: req.body.type || 'universal',
      status: 'processing',
      youtubeUrl: cleanUrl,
      youtubeTitle: req.body.title || 'Fetching info...',
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
        let videoTitle = req.body.title || 'Downloaded Video';
        let thumbnail = '';

        // Step 1: Fetch metadata via yt-dlp only if we don't have it
        if (!req.body.title) {
          try {
            let metaSuccess = false;
            let stdout = '';
            outerLoopUnivTitle:
            for (let i = 0; i < 10; i++) {
              const proxyTiers = await getRandomFreeProxies(10);
              for (let j = 0; j < proxyTiers.length; j++) {
                try {
                  const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--ignore-no-formats-error', '--no-playlist', cleanUrl], proxyTiers[j]);
                  stdout = res.stdout;
                  metaSuccess = true;
                  break outerLoopUnivTitle;
                } catch (e: any) {
                  console.warn(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] yt-dlp video title fetch failed: ${e.message}`);
                }
              }
            }
            if (metaSuccess) {
              const lines = stdout.trim().split('\n');
              const dlTitle = (lines[0] || '').trim();
              if (dlTitle && dlTitle !== 'Downloaded Video') videoTitle = dlTitle;
              const dlThumb = (lines[1] || '').trim();
              if (dlThumb) thumbnail = dlThumb;
            }
          } catch { /* keep defaults */ }
        }

        const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Video';
        conversion.youtubeTitle = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename = `${safeTitle}.mp4`;
        await conversion.save();

        // Step 2: Download video with the user's selected quality
        console.log(`[QUALITY DEBUG] User requested: ${videoQuality} → targetHeight: ${targetHeight}`);
        const runYtDlpDownload = (proxy?: string) => new Promise((resolve, reject) => {
          const formatStr = `bestvideo[height<=${targetHeight}]+bestaudio/best[height<=${targetHeight}]`;
          console.log(`[QUALITY DEBUG] yt-dlp format string: ${formatStr}`);
          const ytdlpArgsArr = [
            '--newline',
            '-v',
            '-f', formatStr,
            '-S', `res:${targetHeight}`,
            '--remux-video', 'mp4',
            '-o', path.join(outputDir, `${fileId}.%(ext)s`),
            '--no-playlist',
            '--hls-prefer-native',
          ];
          ytdlpArgsArr.push(cleanUrl);

          const ytdlp = spawn(getYtDlpPath(), ytDlpArgs(ytdlpArgsArr, proxy), { windowsHide: true });

          activePolls.set(conversion._id.toString(), Date.now());
          const zombieKiller = setInterval(() => {
            const lastPoll = activePolls.get(conversion._id.toString());
            if (lastPoll && Date.now() - lastPoll > 60000) {
               ytdlp.kill('SIGKILL');
               clearInterval(zombieKiller);
               reject(new Error('User closed the tab. Download cancelled.'));
            }
          }, 5000);

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
                  Conversion.findByIdAndUpdate(conversion._id, { progress: progress }).catch(() => { });
                }
              }
            }
          });

          ytdlp.stderr.on('data', (data) => {
            const msg = data.toString();
            // Log format selection and download info for debugging quality issues
            if (msg.includes('Downloading') || msg.includes('format') || msg.includes('Merging') || msg.includes('ERROR')) {
              console.log(`[yt-dlp VERBOSE]:`, msg.trim());
            }
          });

          ytdlp.on('close', (code) => {
            clearInterval(zombieKiller);
            activePolls.delete(conversion._id.toString());
            if (code === 0) resolve(true);
            else reject(new Error('yt-dlp failed with code ' + code));
          });
        });

        let success = false;

        outerLoopUnivDL:
        for (let i = 0; i < 10; i++) {
          const tiers = await getRandomFreeProxies(10);
          for (let j = 0; j < tiers.length; j++) {
            const proxy = tiers[j];
            console.log(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] Attempting video download${proxy ? ` with proxy: ${proxy}` : ' directly'}...`);
            try {
              await runYtDlpDownload(proxy);
              console.log(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] yt-dlp UNIVERSAL succeeded`);
              success = true;
              break outerLoopUnivDL;
            } catch (err: any) {
              console.error(`[Tier ${i + 1}/10] [Proxy ${j + 1}/10] yt-dlp UNIVERSAL failed:`, err.message);
            }
          }
        }

        if (!success) {
          throw new Error('All 10 download tiers failed.');
        }

        // Find the actual downloaded file by fileId prefix
        const findVideoFile = (baseId: string): string | undefined => {
          // Check common extensions first
          for (const ext of ['.mp4', '.mkv', '.webm']) {
            const p = path.join(outputDir, `${baseId}${ext}`);
            if (fs.existsSync(p)) return p;
          }
          // Fallback: scan outputDir for any file starting with fileId
          const files = fs.readdirSync(outputDir);
          const found = files.find(f => f.startsWith(baseId) && !f.endsWith('.part') && !f.endsWith('.ytdl'));
          return found ? path.join(outputDir, found) : undefined;
        };

        const downloadedFilePath = findVideoFile(fileId);

        if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
          throw new Error('Video download did not produce a downloadable file');
        }

        const downloadedBasename = path.basename(downloadedFilePath);
        conversion.outputPath = downloadedFilePath;
        conversion.outputFilename = videoTitle.replace(/[\/\\\\?%*:|"<>]/g, '-') + path.extname(downloadedFilePath);
        conversion.fileSize = getFileSize(downloadedFilePath);
        
        try {
          const { stdout: resOut } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=s=x:p=0 "${downloadedFilePath}"`);
          const h = parseInt(resOut.trim(), 10);
          if (h) {
            conversion.videoQuality = h >= 4320 ? '8K' : h >= 2160 ? '4K' : h >= 1080 ? '1080p' : h >= 720 ? '720p' : h >= 480 ? '480p' : '360p';
          }
        } catch (e) {
          console.warn('ffprobe resolution check failed', e);
        }
        
        // Upload to CDN networks
        try {
          conversion.status = 'uploading';
          conversion.progress = 0; // Reset progress for upload phase
          await conversion.save();

          const HUNDRED_MB = 100 * 1024 * 1024;
          if (conversion.fileSize && conversion.fileSize > HUNDRED_MB) {
            // > 100MB: GoFile
            try { 
              let lastUploadUpdate = Date.now();
              const mbSize = (conversion.fileSize / (1024 * 1024)).toFixed(2);
              console.log(`[GoFile] Starting upload for ${mbSize} MB file...`);
              conversion.gofileUrl = await uploadToGoFile(downloadedFilePath, conversion.outputFilename, (percent) => {
                const now = Date.now();
                if (now - lastUploadUpdate > 2000) {
                  lastUploadUpdate = now;
                  console.log(`[GoFile] Uploading: ${percent}%`);
                  Conversion.findByIdAndUpdate(conversion._id, { progress: percent }).catch(() => {});
                }
              }); 
              conversion.cdnUrl = conversion.gofileUrl; // Redirect main button to GoFile
              conversion.outputUrl = conversion.cdnUrl; // Ensure frontend gets the URL
            } catch (e) { console.error('[GoFile] error:', e); }
          } else {
            // <= 100MB: tmpfiles.org for direct high-speed download
            try {
              const { uploadToTmpFiles } = require('../utils/tmpfiles');
              const tmpFilesUrl = await uploadToTmpFiles(downloadedFilePath, conversion.outputFilename);
              conversion.cdnUrl = tmpFilesUrl;
              conversion.outputUrl = tmpFilesUrl; // Frontend directly opens this URL
              console.log(`[TmpFiles] Uploaded successfully: ${tmpFilesUrl}`);
            } catch (e) { 
              console.error('[TmpFiles] error:', e); 
              conversion.outputUrl = `/api/convert/download/${conversion._id}`;
            }
          }

          if (!conversion.outputUrl) {
            conversion.outputUrl = `/api/convert/download/${conversion._id}`;
          }
        } catch (e) {
          console.error('[Upload] failed, falling back to local serve:', e);
          conversion.outputUrl = `/api/convert/download/${conversion._id}`;
        }

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



/* ΓöÇΓöÇ GET STATUS (frontend polls this) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.get('/status/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    activePolls.set(req.params.id, Date.now());
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
        gofileUrl: conversion.gofileUrl,
        fileSize: conversion.fileSize,
        videoQuality: conversion.videoQuality,
        youtubeTitle: conversion.youtubeTitle,
        youtubeThumbnail: conversion.youtubeThumbnail,
        errorMessage: conversion.errorMessage,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get status' });
  }
});

/* ── DOWNLOAD (serves file with proper title as filename) ── */
router.get('/download/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const conversion: any = await Conversion.findById(req.params.id);
    if (!conversion) {
      res.status(404).json({ success: false, message: 'Conversion not found' });
      return;
    }

    if (conversion.cdnUrl) {
      // Do not touch GoFile
      if (conversion.cdnUrl.includes('gofile.io')) {
        res.redirect(302, conversion.cdnUrl);
        return;
      }
    }

    conversion.downloadCount = (conversion.downloadCount || 0) + 1;
    await conversion.save();

    // If it's an external URL (from a CDN), redirect to it
    if (conversion.outputUrl && conversion.outputUrl.startsWith('http')) {
      res.redirect(conversion.outputUrl);
      return;
    }

    // Resolve to absolute path to handle both old relative and new absolute stored paths
    let filePath = conversion.outputPath;
    if (filePath && !path.isAbsolute(filePath)) {
      filePath = path.resolve(filePath);
    }

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File expired or not found on server' }); return;
    }

    const userFilename = conversion.outputFilename || path.basename(filePath);

    // Enable caching at Cloudflare Edge to turbo-charge speeds
    res.setHeader('Cache-Control', 'public, max-age=604800');

    res.download(filePath, userFilename, (err) => {
      if (err) console.error('Download stream error:', err);
      // Schedule cleanup 21 mins after download is initiated
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          console.log(`[CLEANUP] Deleted ${filePath} after download.`);
        } catch (e) { console.error('Cleanup error:', e); }
      }, 21 * 60 * 1000);
    });

  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, message: error.message || 'Download failed' });
  }
});

/* ── DOWNLOAD-TEMP (finds audio file by fileId prefix) ── */
router.get('/download-temp/:fileId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;

    // Find file in outputDir that starts with this fileId
    const files = fs.readdirSync(outputDir);
    const found = files.find(f => f.startsWith(fileId) && !f.endsWith('.part') && !f.endsWith('.ytdl'));

    if (!found) {
      res.status(404).json({ success: false, message: 'File not found or already expired' }); return;
    }

    const filePath = path.join(outputDir, found);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File expired' }); return;
    }

    // Try to get the user-facing filename from DB
    const conversion: any = await Conversion.findOne({ outputPath: filePath }).select('outputFilename');
    const userFilename = conversion?.outputFilename || found;

    // Enable caching at Cloudflare Edge to turbo-charge speeds
    res.setHeader('Cache-Control', 'public, max-age=604800');

    res.download(filePath, userFilename, (err) => {
      if (err) console.error('Download-temp stream error:', err);
    });
  } catch (error: any) {
    console.error('Download-temp error:', error);
    res.status(500).json({ success: false, message: 'Download failed' });
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
      } catch (e) { }

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



