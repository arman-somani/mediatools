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
import { downloadViaCobalt, downloadFromUrl } from '../utils/cobalt';

// Determine the path to a cookies file for yt-dlp to bypass YouTube bot restrictions
function getCookiesPath(): string | null {
  if (fs.existsSync('/etc/secrets/cookies.txt')) {
    return '/etc/secrets/cookies.txt';
  }
  if (process.env.YOUTUBE_COOKIES) {
    const tmpPath = '/tmp/youtube_cookies.txt';
    try {
      if (!fs.existsSync('/tmp')) fs.mkdirSync('/tmp');
      fs.writeFileSync(tmpPath, process.env.YOUTUBE_COOKIES);
      return tmpPath;
    } catch (e) {
      console.error('Failed to write YOUTUBE_COOKIES to /tmp:', e);
    }
  }
  return null;
}

Platform.shim.eval = (script: any) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
};

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '208e9bff95msh90b82e1f2353e90p17b16ejsn23f1054a290e';
const YT_MEDIA_HOST = 'cloud-api-hub-youtube-downloader.p.rapidapi.com';

/** Stream a URL response body into a local file */
async function downloadStreamFromUrl(url: string, destPath: string): Promise<void> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`CDN fetch failed: ${resp.status} for ${url.slice(0, 80)}`);
  await new Promise<void>((resolve, reject) => {
    const fileStream = fs.createWriteStream(destPath);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
    (resp.body as any).pipe(fileStream);
  });
}

async function downloadFileWithResume(
  url: string,
  destPath: string,
  headers: Record<string, string>,
  fallbackTotalSize: number,
  onProgress?: (progress: number) => void
): Promise<void> {
  const maxRetries = 10;
  let retries = 0;
  let downloaded = 0;
  let totalSize = fallbackTotalSize;
  let lastUpdate = Date.now();

  if (fs.existsSync(destPath)) {
    fs.unlinkSync(destPath);
  }

  while (retries < maxRetries) {
    try {
      const fetchHeaders: any = { ...headers };
      if (downloaded > 0) {
        fetchHeaders['Range'] = `bytes=${downloaded}-`;
      }

      const resp = await fetch(url, { headers: fetchHeaders });
      if (!resp.ok) {
        if (resp.status === 416) return; // Range Not Satisfiable -> Done
        throw new Error(`Fetch failed: ${resp.status}`);
      }

      if (downloaded === 0) {
        const cl = parseInt(resp.headers.get('content-length') || '0', 10);
        if (cl > 0) totalSize = cl;
      }

      await new Promise<void>((resolve, reject) => {
        const fileStream = fs.createWriteStream(destPath, { flags: downloaded > 0 ? 'a' : 'w' });
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
        (async () => {
          try {
            for await (const chunk of resp.body as any) {
              fileStream.write(chunk);
              downloaded += chunk.length;
              if (totalSize > 0 && onProgress) {
                const now = Date.now();
                if (now - lastUpdate > 1000) {
                  lastUpdate = now;
                  onProgress(Math.round((downloaded / totalSize) * 100));
                }
              }
            }
            fileStream.end();
          } catch (e) {
            fileStream.destroy();
            reject(e);
          }
        })();
      });

      if (totalSize > 0 && downloaded < totalSize) {
        throw new Error('Stream ended prematurely');
      }
      return; 
    } catch (err: any) {
      console.warn(`Download interrupted (${downloaded}/${totalSize}): ${err.message}. Retrying...`);
      retries++;
      if (retries >= maxRetries) throw new Error(`Failed after ${maxRetries} retries: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/**
 * Uses cloud-api-hub-youtube-downloader RapidAPI to get streams.
 */
async function downloadAndMergeViaAPI(
  videoId: string,
  outputPath: string,
  mode: 'audio' | 'video',
  targetHeight = 720,
  audioBitrate = '192',
  onProgress?: (progress: number) => void
): Promise<void> {
  const headers = { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': YT_MEDIA_HOST };

  if (mode === 'audio') {
    const audioUrl = `https://${YT_MEDIA_HOST}/download?id=${videoId}&filter=audioonly`;
    const resp = await fetch(audioUrl, { headers });
    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = (await resp.json()) as any[];
    if (!Array.isArray(data) || data.length === 0) throw new Error('API returned no audio formats');
    
    // Pick the best audio format by audio bitrate
    const sortedAudio = data.filter(f => f.ext === 'm4a' || f.acodec !== 'none').sort((a, b) => (b.abr || 0) - (a.abr || 0));
    const bestAudio = sortedAudio[0] || data[0];
    if (!bestAudio.url) throw new Error('No audio URL found in API response');
    
    console.log('Downloading audio via fetch from API link...');
    const tempAudio = outputPath.replace('.mp3', '_api_a.m4a');
    try {
      const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/'
      };
      const fallbackSize = bestAudio.filesize || bestAudio.filesize_approx || 0;
      await downloadFileWithResume(bestAudio.url, tempAudio, fetchHeaders, fallbackSize, onProgress);

      console.log('Converting downloaded audio via ffmpeg...');
      await new Promise<void>((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-y', 
          '-i', tempAudio, 
          '-c:a', 'libmp3lame', 
          '-b:a', `${audioBitrate}k`, 
          outputPath
        ], { windowsHide: true });
        let stderr = '';
        ff.stderr.on('data', d => stderr += d.toString());
        ff.on('close', code => { if (code === 0) resolve(); else reject(new Error(`ffmpeg audio conversion failed with code ${code}. ${stderr}`)); });
        ff.on('error', reject);
      });
    } finally {
      if (fs.existsSync(tempAudio)) fs.unlinkSync(tempAudio);
    }
    return;
  }

  if (mode === 'video') {
    const videoUrl = `https://${YT_MEDIA_HOST}/download?id=${videoId}&filter=videoonly`;
    const audioUrl = `https://${YT_MEDIA_HOST}/download?id=${videoId}&filter=audioonly`;
    
    const [vResp, aResp] = await Promise.all([
      fetch(videoUrl, { headers }),
      fetch(audioUrl, { headers })
    ]);
    
    if (!vResp.ok || !aResp.ok) throw new Error('API request failed for video or audio');
    
    const vData = (await vResp.json()) as any[];
    const aData = (await aResp.json()) as any[];
    
    if (!Array.isArray(vData) || vData.length === 0) throw new Error('API returned no video formats');
    if (!Array.isArray(aData) || aData.length === 0) throw new Error('API returned no audio formats');
    
    // Sort video formats by height, then by fps, then by bitrate
    const sortedVideos = vData.filter(f => f.height).sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      if (b.fps !== a.fps) return (b.fps || 0) - (a.fps || 0);
      return (b.vbr || 0) - (a.vbr || 0);
    });
    const bestVideo = sortedVideos.find(f => f.height <= targetHeight) || sortedVideos[0] || vData[0];
    
    // Sort audio formats by highest audio bitrate (abr)
    const sortedAudio = aData.filter(f => f.ext === 'm4a' || f.acodec !== 'none').sort((a, b) => (b.abr || 0) - (a.abr || 0));
    const bestAudio = sortedAudio[0] || aData[0];
    
    if (!bestVideo || !bestAudio || !bestVideo.url || !bestAudio.url) throw new Error('Missing URL for video or audio');
    
    console.log('Downloading video and audio concurrently from API links...');
    const tempVideo = outputPath.replace('.mp4', '_api_v.mp4');
    const tempAudio = outputPath.replace('.mp4', '_api_a.m4a');
    
    try {
      const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/'
      };
      await Promise.all([
        (async () => {
          const fallbackSize = bestVideo.filesize || bestVideo.filesize_approx || 0;
          await downloadFileWithResume(bestVideo.url, tempVideo, fetchHeaders, fallbackSize, onProgress);
        })(),
        (async () => {
          const fallbackSize = bestAudio.filesize || bestAudio.filesize_approx || 0;
          await downloadFileWithResume(bestAudio.url, tempAudio, fetchHeaders, fallbackSize);
        })()
      ]);

      console.log('Merging video and audio via ffmpeg...');
      await new Promise<void>((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-y', 
          '-i', tempVideo, 
          '-i', tempAudio, 
          '-c:v', 'copy', 
          '-c:a', 'aac', 
          '-b:a', `${audioBitrate}k`, 
          '-shortest', 
          outputPath
        ], { windowsHide: true });
        
        let stderr = '';
        ff.stderr.on('data', d => stderr += d.toString());
        ff.on('close', code => {
          if (code === 0) resolve(); else reject(new Error(`ffmpeg merge failed with code ${code}. ${stderr}`));
        });
        ff.on('error', reject);
      });
    } finally {
      if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
      if (fs.existsSync(tempAudio)) fs.unlinkSync(tempAudio);
    }
  }
}


const router = Router();
const execAsync = promisify(exec);

function getYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

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
    '--js-runtimes', 'node', 
    '--extractor-args', 'youtubetab:skip=webpage,authcheck',
    '--extractor-args', 'youtube:player_skip=webpage,configs;visitor_data=VISITOR_DATA_VALUE_HERE',
    '--extractor-args', 'youtube:player_client=android,web'
  ];
  const cookiesFile = getCookiesPath();
  if (cookiesFile) base.push('--cookies', cookiesFile);
  return [...base, ...args];
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

        conversion.status = 'completed';
        conversion.progress = 100;
        conversion.fileSize = getFileSize(outputPath);
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

/* ΓöÇΓöÇ YOUTUBE TO Audio ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.post('/youtube', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const youtubeUrl = req.body.youtubeUrl || req.body.url;
    if (!youtubeUrl) {
      res.status(400).json({ success: false, message: 'YouTube URL is required' });
      return;
    }

    const cleanUrl = String(youtubeUrl).trim();
    const videoId = getYouTubeVideoId(cleanUrl);

    if (!videoId) {
      res.status(400).json({ success: false, message: 'Invalid YouTube URL' });
      return;
    }

    const audioQuality = safeAudioQuality(req.body.quality);
    const fileId = uuidv4();
    const diskFilename = `${fileId}.mp3`;
    const outputPath = path.join(outputDir, diskFilename);

    const conversion: any = await Conversion.create({
      userId: req.user?.id,
      type: 'youtube',
      status: 'processing',
      youtubeUrl: cleanUrl,
      youtubeTitle: 'YouTube Audio',
      outputFilename: `audio.mp3`,
      outputPath: outputPath,
      outputUrl: `/outputs/${diskFilename}`,
      quality: audioQuality,
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

    (async () => {
      try {
        // Step 1: Get metadata
        let videoTitle = 'YouTube Audio';
        let durationSec = 0;
        try {
          const { stdout } = await runYtDlp(['--print', 'title', '--print', 'duration', '--no-playlist', cleanUrl]);
          const lines = stdout.trim().split('\n');
          videoTitle = (lines[0] || '').trim() || 'YouTube Audio';
          durationSec = parseInt((lines[1] || '').trim(), 10) || 0;
        } catch { /* keep defaults */ }

        const safeTitle = sanitizeFilename(videoTitle) || 'YouTube Audio';

        conversion.youtubeTitle = videoTitle;
        conversion.outputFilename = `${safeTitle} (${audioQuality}kbps).mp3`;
        await conversion.save();

        // Step 2: Download audio
        let audioDownloaded = false;

        // API Tier 1: RapidAPI
        if (!audioDownloaded) {
          try {
            console.log('Trying RapidAPI for audio...');
            const rawPath = outputPath.replace('.mp3', '.m4a');
            await downloadAndMergeViaAPI(videoId, rawPath, 'audio', 720, audioQuality, (progress) => {
              Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => { });
            });
            await new Promise((resolve, reject) => {
              const ffmpeg = spawn('ffmpeg', ['-y', '-i', rawPath, '-vn', '-ab', `${audioQuality}k`, outputPath], { windowsHide: true });
              ffmpeg.on('error', reject);
              ffmpeg.on('close', (code) => {
                if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
                if (code === 0) resolve(true); else reject(new Error('FFmpeg m4a to mp3 failed'));
              });
            });
            requireWrittenFile(outputPath, 'RapidAPI audio conversion');
            audioDownloaded = true;
            console.log('RapidAPI audio succeeded');
          } catch (e: any) {
            console.error('RapidAPI audio failed:', e.message);
          }
        }

        // API Tier 2: Cobalt API
        if (!audioDownloaded) {
          try {
            console.log('Trying Cobalt API for audio...');
            const cobaltDownloadUrl = await downloadViaCobalt(cleanUrl, 'audio', audioQuality);
            console.log('Downloading audio via ffmpeg from Cobalt link...');
            await new Promise<void>((resolve, reject) => {
              const ff = spawn('ffmpeg', [
                '-y', 
                '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                '-i', cobaltDownloadUrl, 
                '-c:a', 'libmp3lame', 
                '-b:a', `${audioQuality}k`, 
                outputPath
              ], { windowsHide: true });
              ff.on('close', code => { if (code === 0) resolve(); else reject(new Error(`FFmpeg Cobalt audio failed with code ${code}`)); });
              ff.on('error', reject);
            });
            requireWrittenFile(outputPath, 'Cobalt audio download');
            audioDownloaded = true;
            console.log('Cobalt audio download succeeded');
          } catch (e: any) {
            console.error('Cobalt audio failed:', e.message);
          }
        }



        if (!audioDownloaded) throw new Error('All download methods failed for audio');

        const downloadedFile = findDownloadedFile(fileId) || diskFilename;
        conversion.outputPath = path.join(outputDir, downloadedFile);
        conversion.outputUrl = `/outputs/${downloadedFile}`;
        requireWrittenFile(conversion.outputPath, 'Audio download');
        conversion.status = 'completed';
        conversion.progress = 100;
        conversion.fileSize = getFileSize(conversion.outputPath);
        await conversion.save();
      } catch (err: any) {
        console.error('YouTube background error:', err.message);
        conversion.status = 'failed';
        conversion.errorMessage = err.message || 'Conversion failed';
        await conversion.save();
      }
    })();

  } catch (error: any) {
    console.error('YouTube conversion error:', error);
    res.status(500).json({ success: false, message: error.message || 'YouTube conversion failed' });
  }
});

/* ΓöÇΓöÇ YOUTUBE TO Video ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.post('/youtube-Video', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const youtubeUrl = req.body.youtubeUrl || req.body.url;
    // Frontend might send 'quality' or 'videoQuality'
    const reqQuality = String(req.body.mp4Quality || req.body.videoQuality || req.body.quality || '720p');
    const videoQuality: string = (['360p', '480p', '720p', '1080p', '4K', '8K'].includes(reqQuality))
      ? reqQuality : '720p';

    if (!youtubeUrl) {
      res.status(400).json({ success: false, message: 'YouTube URL is required' });
      return;
    }

    const cleanUrl = String(youtubeUrl).trim();
    const videoId = getYouTubeVideoId(cleanUrl);

    if (!videoId) {
      res.status(400).json({ success: false, message: 'Invalid YouTube URL' });
      return;
    }

    const fileId = uuidv4();
    const diskFilename = `${fileId}.mp4`;
    const outputPath = path.join(outputDir, diskFilename);

    const conversion: any = await Conversion.create({
      userId: req.user?.id,
      type: 'youtube-Video',
      status: 'processing',
      youtubeUrl: cleanUrl,
      youtubeTitle: 'YouTube Video',
      outputFilename: `video.mp4`,
      outputPath: outputPath,
      outputUrl: `/outputs/${diskFilename}`,
      quality: '192',
      videoQuality: videoQuality as any,
      progress: 0,
    });

    res.json({
      success: true,
      message: 'YouTube Video download started',
      data: {
        jobId: conversion._id.toString(),
        conversionId: conversion._id.toString(),
      },
    });

      (async () => {
        try {
          // Step 1: Get metadata
          let videoTitle = 'YouTube Video';
          try {
            const { stdout } = await runYtDlp(['--print', 'title', '--no-playlist', cleanUrl]);
            const lines = stdout.trim().split('\n');
            videoTitle = (lines[0] || '').trim() || 'YouTube Video';
          } catch { /* keep defaults */ }

          const safeTitle = sanitizeFilename(videoTitle) || 'YouTube Video';
          conversion.youtubeTitle = videoTitle;
          await conversion.save();

          // Step 2: Download video in its native format without remuxing
          const formatMap: Record<string, string> = {
            '360p': 'res:360,ext:mp4:m4a',
            '480p': 'res:480,ext:mp4:m4a',
            '720p': 'res:720,ext:mp4:m4a',
            '1080p': 'res:1080,ext:mp4:m4a',
            '4K': 'res:2160,ext:mp4:m4a',
            '8K': 'res:4320,ext:mp4:m4a',
          };
          const ytSort = formatMap[videoQuality] || formatMap['720p'];

          let videoDownloaded = false;
          const fallbackOutputPath = path.join(outputDir, `${fileId}.mp4`);
          const targetHeightMap: Record<string, number> = { '360p': 360, '480p': 480, '720p': 720, '1080p': 1080, '4K': 2160, '8K': 4320 };
          const targetH = targetHeightMap[videoQuality] || 720;

          // API Tier 1: RapidAPI
          if (!videoDownloaded) {
            try {
              console.log('Trying RapidAPI for video...');
              await downloadAndMergeViaAPI(videoId, fallbackOutputPath, 'video', targetH, '192', (progress) => {
                Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => { });
              });
              requireWrittenFile(fallbackOutputPath, 'RapidAPI video download');
              videoDownloaded = true;
              console.log('RapidAPI video succeeded');
            } catch (e: any) {
              console.error('RapidAPI video failed:', e.message);
            }
          }

          // API Tier 2: Cobalt API
          if (!videoDownloaded) {
            try {
              console.log('Trying Cobalt API for video...');
              const cobaltDownloadUrl = await downloadViaCobalt(cleanUrl, 'video', videoQuality);
              console.log('Downloading video via ffmpeg from Cobalt link...');
              await new Promise<void>((resolve, reject) => {
                const ff = spawn('ffmpeg', [
                  '-y', 
                  '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                  '-i', cobaltDownloadUrl, 
                  '-c', 'copy', 
                  fallbackOutputPath
                ], { windowsHide: true });
                ff.on('close', code => { if (code === 0) resolve(); else reject(new Error(`FFmpeg Cobalt video failed with code ${code}`)); });
                ff.on('error', reject);
              });
              requireWrittenFile(fallbackOutputPath, 'Cobalt video download');

              videoDownloaded = true;
              console.log('Cobalt video download succeeded');
            } catch (e: any) {
              console.error('Cobalt video failed:', e.message);
            }
          }

          if (!videoDownloaded) throw new Error('All download methods failed for video');

          // Find the actual downloaded file since the extension could be .webm, .mkv, or .mp4
          const downloadedFile = findDownloadedFile(fileId);
          
          if (downloadedFile) {
            const actualExt = path.extname(downloadedFile);
            conversion.outputPath = path.join(outputDir, downloadedFile);
            conversion.outputFilename = `${safeTitle} (${videoQuality})${actualExt}`;
          }
          requireWrittenFile(conversion.outputPath, 'Video download');

          // Step 3: Mark complete
          conversion.status = 'completed';
          conversion.progress = 100;
          conversion.fileSize = getFileSize(conversion.outputPath);
          conversion.outputUrl = `/outputs/${path.basename(conversion.outputPath)}`;
          await conversion.save();
        } catch (err: any) {
          console.error('YouTube Video background error:', err.message);
          conversion.status = 'failed';
          conversion.errorMessage = err.message || 'Download failed';
          await conversion.save();
        }
      })();

  } catch (error: any) {
    console.error('YouTube Video route error:', error);
    res.status(500).json({ success: false, message: error.message || 'YouTube Video download failed' });
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

    // Run yt-dlp to print title, thumbnail, resolution, and filesize
    const { stdout } = await runYtDlp([
      '--print', '%(title)s',
      '--print', '%(thumbnail)s',
      '--print', '%(resolution)s',
      '--print', '%(filesize_approx,filesize)s',
      '--no-playlist',
      cleanUrl,
    ]);

    const lines = stdout.trim().split('\n');
    const title = (lines[0] || '').trim() || 'Downloaded Video';
    const thumbnail = (lines[1] || '').trim();
    const resolution = (lines[2] || '').trim() || 'Best Available';
    let sizeBytes = parseInt((lines[3] || '').trim(), 10);

    if (isNaN(sizeBytes)) sizeBytes = 0;

    res.json({
      success: true,
      data: {
        title,
        thumbnail,
        resolution: resolution === 'NA' ? 'Best Available' : resolution,
        sizeBytes
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
      '360p': 'res:360,ext:mp4:m4a',
      '480p': 'res:480,ext:mp4:m4a',
      '720p': 'res:720,ext:mp4:m4a',
      '1080p': 'res:1080,ext:mp4:m4a',
      '4K': 'res:2160,ext:mp4:m4a',
      '8K': 'res:4320,ext:mp4:m4a',
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
        // Step 1: Get metadata
        let videoTitle = 'Downloaded Video';
        let thumbnail = '';
        try {
          const { stdout } = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--no-playlist', cleanUrl]);
          const lines = stdout.trim().split('\n');
          videoTitle = (lines[0] || '').trim() || 'Downloaded Video';
          thumbnail = (lines[1] || '').trim();
        } catch { /* keep defaults */ }

        const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Video';
        conversion.youtubeTitle = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename = `${safeTitle}.mp4`;
        await conversion.save();

        // Step 2: Download video in its native format without remuxing
        // We use -S for sorting formats which is highly optimized for ANY website!
        const ytdlp = spawn(getYtDlpPath(), ytDlpArgs([
          '--newline',
          '-f', 'bv*+ba/b',
          '-S', ytSort,
          '--merge-output-format', 'mp4',
          '-o', path.join(outputDir, `${fileId}.%(ext)s`),
          '--no-playlist',
          cleanUrl,
        ]), { windowsHide: true });

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
          console.error('[yt-dlp UNIVERSAL ERROR]:', data.toString());
        });

        await new Promise((resolve, reject) => {
          ytdlp.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error('yt-dlp failed with code ' + code));
          });
        });

        // Find the actual downloaded file since the extension could be .webm, .mkv, or .mp4
        const downloadedFile = findDownloadedFile(fileId);
        
        if (downloadedFile) {
          const actualExt = path.extname(downloadedFile);
          conversion.outputPath = path.join(outputDir, downloadedFile);
          conversion.outputFilename = safeTitle + actualExt;
        }
        requireWrittenFile(conversion.outputPath, 'Universal download');

        // Step 3: Mark complete
        conversion.status = 'completed';
        conversion.progress = 100;
        conversion.fileSize = getFileSize(conversion.outputPath);
        conversion.outputUrl = `/outputs/${path.basename(conversion.outputPath)}`;
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
    const { stdout } = await runYtDlp(['--flat-playlist', '--dump-json', cleanUrl]);

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
      // Schedule cleanup exactly 1 minute after download finishes (or fails)
      setTimeout(async () => {
        try {
          if (fs.existsSync(conversion.outputPath)) {
            fs.unlinkSync(conversion.outputPath);
          }
          await Conversion.findByIdAndDelete(conversion._id);
          console.log(`[CLEANUP] Deleted conversion ${conversion._id} and files 1 min after download.`);
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }, 60 * 1000);
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
      // Schedule cleanup exactly 1 minute after download finishes
      setTimeout(async () => {
        try {
          if (fs.existsSync(conversion.outputPath)) {
            fs.unlinkSync(conversion.outputPath);
          }
          await Conversion.findByIdAndDelete(conversion._id);
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      }, 60 * 1000);
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Download failed' });
  }
});

export default router;



