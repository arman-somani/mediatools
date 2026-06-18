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
import { interceptYoutubeStreams } from '../utils/puppeteerInterceptor';

// OAuth2 is no longer supported by yt-dlp. Using browser cookies natively.
function ytDlpAuthArgs(): string[] {
  return [];
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

function ytDlpArgs(args: string[]): string[] {
  const base = [
    '--remote-components', 'ejs:github',
    // '--rm-cache-dir', // DO NOT remove cache, oauth2 token is stored here!
    '--socket-timeout', '10',
    '--retries', '0',
    '--extractor-retries', '0',
    '--fragment-retries', '0',
    '--extractor-args', 'youtube:player-client=android_vr,web,default',
    '--cookies-from-browser', 'chromium'
  ];

  return [...base, ...ytDlpAuthArgs(), ...args];
}

function runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(getYtDlpPath(), ytDlpArgs(args), { windowsHide: true });
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
            let stdout = '';
            try {
              const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--no-playlist', cleanUrl]);
              stdout = res.stdout;
            } catch (e: any) {
              console.warn(`yt-dlp metadata fetch failed: ${e.message}`);
            }
            const lines = stdout.trim().split('\n');
            const dlTitle = (lines[0] || '').trim();
            if (dlTitle && dlTitle !== 'Downloaded Audio') videoTitle = dlTitle;
            const dlThumb = (lines[1] || '').trim();
            if (dlThumb) thumbnail = dlThumb;
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
            '--concurrent-fragments', '4',
            '--http-chunk-size', '10M',
          ];
          if (proxy) ytdlpArgsArr.push('--proxy', proxy);
          ytdlpArgsArr.push(cleanUrl);

          const ytdlp = spawn(getYtDlpPath(), ytDlpArgs(ytdlpArgsArr), { windowsHide: true });

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
            console.error(`[yt-dlp AUDIO ERROR]:`, data.toString());
          });

          ytdlp.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error('yt-dlp audio failed with code ' + code));
          });
        });

        try {
          console.log(`Trying Tier 1: Headless Browser Interception (Puppeteer)...`);
          const { audioUrl } = await interceptYoutubeStreams(cleanUrl, 'audio');
          if (!audioUrl) throw new Error('Puppeteer failed to intercept audio stream');
          const exactMp3 = path.join(outputDir, `${fileId}.mp3`);
          await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ['-y', '-i', audioUrl, '-vn', '-ab', `${audioQuality}k`, exactMp3]);
            ffmpeg.on('close', code => code === 0 ? resolve(true) : reject(new Error(`ffmpeg failed with code ${code}`)));
          });
          console.log(`Puppeteer AUDIO succeeded`);
        } catch (tier1Err: any) {
          console.error(`Tier 1 (Puppeteer) failed: ${tier1Err.message}. Triggering Tier 2 (Native yt-dlp)...`);
          try {
            await runYtDlpAudio();
            console.log(`yt-dlp AUDIO succeeded on Native Connection`);
          } catch (tier2Err: any) {
            console.error(`Tier 2 (Native Connection) failed: ${tier2Err.message}. Triggering Tier 3 (Proxy Network 1)...`);
            try {
            const { getRandomFreeProxies } = require('../utils/freeproxy');
            const proxies = await getRandomFreeProxies(10);
            let success = false;
            for (const proxy of proxies) {
              console.log(`Trying Tier 2 proxy: ${proxy}`);
              try {
                await runYtDlpAudio(proxy);
                success = true;
                console.log(`yt-dlp AUDIO succeeded via Tier 2 Proxy`);
                break;
              } catch (proxyErr) { console.warn(`Proxy ${proxy} failed.`); }
            }
            if (!success) throw new Error('All Tier 2 proxies failed.');
          } catch (tier2Err: any) {
            console.error(`Tier 2 failed: ${tier2Err.message}. Triggering Tier 3 (Proxy Network 2)...`);
            try {
              const { getRandomFreeProxies } = require('../utils/freeproxy');
              const proxies = await getRandomFreeProxies(10);
              let success = false;
              for (const proxy of proxies) {
                console.log(`Trying Tier 3 proxy: ${proxy}`);
                try {
                  await runYtDlpAudio(proxy);
                  success = true;
                  console.log(`yt-dlp AUDIO succeeded via Tier 3 Proxy`);
                  break;
                } catch (proxyErr) { console.warn(`Proxy ${proxy} failed.`); }
              }
              if (!success) throw new Error('All Tier 3 proxies failed.');
              } catch (tier3Err: any) {
                console.error(`Tier 3 failed:`, tier3Err.message);
                console.log(`Triggering Tier 5 (@distube/ytdl-core)...`);
                try {
                  const ytdl = require('@distube/ytdl-core');
                  await new Promise((resolve, reject) => {
                    const exactMp3 = path.join(outputDir, `${fileId}.mp3`);
                    const stream = ytdl(cleanUrl, { quality: 'highestaudio', filter: 'audioonly' });
                    stream.pipe(fs.createWriteStream(exactMp3));
                    stream.on('end', () => resolve(true));
                    stream.on('error', reject);
                  });
                  console.log(`ytdl-core AUDIO succeeded`);
                } catch (tier5Err: any) {
                  console.error(`Tier 5 failed:`, tier5Err.message);
                  console.log(`Triggering Tier 6 (play-dl)...`);
                  try {
                    const play = require('play-dl');
                    await new Promise(async (resolve, reject) => {
                      try {
                        const exactMp3 = path.join(outputDir, `${fileId}.mp3`);
                        const stream = await play.stream(cleanUrl, { discordPlayerCompatibility: true });
                        const writeStream = fs.createWriteStream(exactMp3);
                        stream.stream.pipe(writeStream);
                        writeStream.on('finish', () => resolve(true));
                        writeStream.on('error', reject);
                      } catch (err) {
                        reject(err);
                      }
                    });
                    console.log(`play-dl AUDIO succeeded`);
                  } catch (tier6Err: any) {
                    console.error(`Tier 6 failed:`, tier6Err.message);
                    throw new Error('All download attempts failed across all tiers.');
                  }
                }
              }
            }
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
        conversion.outputFilename = safeTitle + '.mp3';
        conversion.fileSize = getFileSize(downloadedFilePath);
        // Use GoFile for extremely fast unmetered downloads
        try {
          conversion.outputUrl = await uploadToGoFile(downloadedFilePath);
          console.log(`[GoFile] Audio uploaded successfully: ${conversion.outputUrl}`);
        } catch (e) {
          console.error('[GoFile] Upload failed, falling back to local serve:', e);
          conversion.outputUrl = `/api/convert/download-temp/${fileId}`;
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

    if (!success) {
      console.log('[Universal] Trying yt-dlp...');
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
        const res = await runYtDlp(args);
        stdout = res.stdout;
      } catch (e: any) {
        console.warn(`Universal metadata native fetch failed: ${e.message}`);
        throw new Error("Metadata extraction failed.");
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
            let stdout = '';
            try {
              const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--no-playlist', cleanUrl]);
              stdout = res.stdout;
            } catch (e: any) {
              console.warn(`yt-dlp metadata fetch failed: ${e.message}`);
            }
            const lines = stdout.trim().split('\n');
            const dlTitle = (lines[0] || '').trim();
            if (dlTitle && dlTitle !== 'Downloaded Video') videoTitle = dlTitle;
            const dlThumb = (lines[1] || '').trim();
            if (dlThumb) thumbnail = dlThumb;
          } catch { /* keep defaults */ }
        }

        const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Video';
        conversion.youtubeTitle = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename = `${safeTitle}.mp4`;
        await conversion.save();

        // Step 2: Download video in its native format without remuxing
        // We use -S for sorting formats which is highly optimized for ANY website!
        const runYtDlpDownload = (proxy?: string) => new Promise((resolve, reject) => {
          const ytdlpArgsArr = [
            '--newline',
            '-f', 'bv*+ba/b',
            '-S', ytSort,
            '--merge-output-format', 'mp4',
            '-o', path.join(outputDir, `${fileId}.%(ext)s`),
            '--no-playlist',
            '--concurrent-fragments', '4',
            '--http-chunk-size', '10M',
            '--hls-prefer-native',
          ];
          if (proxy) ytdlpArgsArr.push('--proxy', proxy);
          ytdlpArgsArr.push(cleanUrl);

          const ytdlp = spawn(getYtDlpPath(), ytDlpArgs(ytdlpArgsArr), { windowsHide: true });

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
            console.error(`[yt-dlp UNIVERSAL ERROR]:`, data.toString());
          });

          ytdlp.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error('yt-dlp failed with code ' + code));
          });
        });

        try {
          console.log(`Trying Tier 1: Headless Browser Interception (Puppeteer)...`);
          const { videoUrl, audioUrl } = await interceptYoutubeStreams(cleanUrl, 'video');
          if (!videoUrl || !audioUrl) throw new Error('Puppeteer failed to intercept video or audio streams');
          const exactMp4 = path.join(outputDir, `${fileId}.mp4`);
          await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ['-y', '-i', videoUrl, '-i', audioUrl, '-c:v', 'copy', '-c:a', 'aac', exactMp4]);
            ffmpeg.on('close', code => code === 0 ? resolve(true) : reject(new Error(`ffmpeg failed with code ${code}`)));
          });
          console.log(`Puppeteer UNIVERSAL succeeded`);
        } catch (tier1Err: any) {
          console.error(`Tier 1 (Puppeteer) failed: ${tier1Err.message}. Triggering Tier 2 (Native yt-dlp)...`);
          try {
            await runYtDlpDownload();
            console.log(`yt-dlp UNIVERSAL succeeded on Native Connection`);
          } catch (tier2Err: any) {
            console.error(`Tier 2 (Native Connection) failed: ${tier2Err.message}. Triggering Tier 3 (Proxy Network 1)...`);
            try {
            const { getRandomFreeProxies } = require('../utils/freeproxy');
            const proxies = await getRandomFreeProxies(10);
            let success = false;
            for (const proxy of proxies) {
              console.log(`Trying Tier 2 proxy: ${proxy}`);
              try {
                await runYtDlpDownload(proxy);
                success = true;
                console.log(`yt-dlp UNIVERSAL succeeded via Tier 2 Proxy`);
                break;
              } catch (proxyErr) { console.warn(`Proxy ${proxy} failed.`); }
            }
            if (!success) throw new Error('All Tier 2 proxies failed.');
          } catch (tier2Err: any) {
            console.error(`Tier 2 failed: ${tier2Err.message}. Triggering Tier 3 (Proxy Network 2)...`);
            try {
              const { getRandomFreeProxies } = require('../utils/freeproxy');
              const proxies = await getRandomFreeProxies(10);
              let success = false;
              for (const proxy of proxies) {
                console.log(`Trying Tier 3 proxy: ${proxy}`);
                try {
                  await runYtDlpDownload(proxy);
                  success = true;
                  console.log(`yt-dlp UNIVERSAL succeeded via Tier 3 Proxy`);
                  break;
                } catch (proxyErr) { console.warn(`Proxy ${proxy} failed.`); }
              }
              } catch (tier3Err: any) {
                console.error(`Tier 3 failed:`, tier3Err.message);

                const isYouTube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
                if (!isYouTube) {
                  throw new Error('All download attempts failed across all tiers.');
                }

                console.log(`Triggering Tier 5 (@distube/ytdl-core)...`);
                try {
                  const ytdl = require('@distube/ytdl-core');
                  await new Promise((resolve, reject) => {
                    const exactMp4 = path.join(outputDir, `${fileId}.mp4`);
                    const stream = ytdl(cleanUrl, { quality: 'highest', filter: 'audioandvideo' });
                    stream.pipe(fs.createWriteStream(exactMp4));
                    stream.on('end', () => resolve(true));
                    stream.on('error', reject);
                  });
                  console.log(`ytdl-core UNIVERSAL succeeded`);
                } catch (tier5Err: any) {
                  console.error(`Tier 5 failed:`, tier5Err.message);
                  console.log(`Triggering Tier 6 (play-dl)...`);
                  try {
                    const play = require('play-dl');
                    const info = await play.video_info(cleanUrl);
                    const format = info.format.find((f: any) => f.hasVideo && f.hasAudio) || info.format[0];
                    if (!format || !format.url) throw new Error('No merged format found in play-dl');

                    const fetch = require('node-fetch');
                    const res = await fetch(format.url);
                    if (!res.ok) throw new Error('Failed to fetch from play-dl format url');

                    await new Promise((resolve, reject) => {
                      const exactMp4 = path.join(outputDir, `${fileId}.mp4`);
                      const writeStream = fs.createWriteStream(exactMp4);
                      res.body.pipe(writeStream);
                      writeStream.on('finish', () => resolve(true));
                      writeStream.on('error', reject);
                    });
                    console.log(`play-dl UNIVERSAL succeeded`);
                  } catch (tier6Err: any) {
                    console.error(`Tier 6 failed:`, tier6Err.message);
                    throw new Error('All download attempts failed across all tiers.');
                  }
                }
              }
            }
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
        conversion.outputFilename = safeTitle + path.extname(downloadedFilePath);
        conversion.fileSize = getFileSize(downloadedFilePath);
        
        // Use GoFile for extremely fast unmetered downloads
        try {
          conversion.outputUrl = await uploadToGoFile(downloadedFilePath);
          console.log(`[GoFile] Video uploaded successfully: ${conversion.outputUrl}`);
        } catch (e) {
          console.error('[GoFile] Upload failed, falling back to local serve:', e);
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
      const res = await runYtDlp(['--flat-playlist', '--dump-json', cleanUrl]);
      stdout = res.stdout;
    } catch (e: any) {
      console.warn(`Playlist native fetch failed: ${e.message}`);
      throw new Error("Playlist extraction failed.");
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

/* ── DOWNLOAD (serves file with proper title as filename) ── */
router.get('/download/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const conversion: any = await Conversion.findById(req.params.id);
    if (!conversion) {
      res.status(404).json({ success: false, message: 'File not found' }); return;
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

    // Force browser to download (not preview)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(userFilename)}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(fs.statSync(filePath).size));

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('close', () => {
      // Schedule cleanup 21 mins after download
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

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(userFilename)}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(fs.statSync(filePath).size));

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
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



