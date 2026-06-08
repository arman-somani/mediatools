import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { Conversion } from '../models/Conversion';
import { User } from '../models/User';
import { Innertube, UniversalCache, Platform, ClientType } from 'youtubei.js';
import vm from 'vm';

Platform.shim.eval = (script: any) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
};

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '448df088femsh10889546dc271aap126ea2jsn1bec5c44767e';
const YT_MEDIA_HOST = 'youtube-media-downloader.p.rapidapi.com';

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

/**
 * Uses youtube-media-downloader RapidAPI to get separate video-only + audio-only streams,
 * downloads them, then merges with ffmpeg for high-quality output.
 *
 * mode 'audio'  → downloads best m4a audio, writes to outputPath
 * mode 'video'  → downloads best video-only + best m4a audio, merges into outputPath (.mp4)
 */
async function downloadAndMergeViaAPI(
  videoId: string,
  outputPath: string,
  mode: 'audio' | 'video',
  targetHeight = 720,
  audioBitrate = '192'
): Promise<void> {
  const apiUrl = `https://${YT_MEDIA_HOST}/v2/video/details?videoId=${videoId}`;
  const resp = await fetch(apiUrl, {
    headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': YT_MEDIA_HOST },
  });
  if (!resp.ok) throw new Error(`youtube-media-downloader API returned ${resp.status}`);
  const data = (await resp.json()) as any;
  if (data.errorId !== 'Success') throw new Error(`API error: ${data.errorId || 'unknown'}`);

  const videos: any[] = data.videos?.items || [];
  const audios: any[] = data.audios?.items || [];

  // Best audio: prefer m4a
  const bestAudio = audios.find(a => a.extension === 'm4a' && a.url) || audios.find(a => a.url);
  if (!bestAudio?.url) throw new Error('API: no audio stream found');

  if (mode === 'audio') {
    // Download m4a audio and convert to mp3
    const tmpAudio = outputPath.replace('.mp3', '.m4a');
    console.log(`API: downloading audio m4a`);
    await downloadStreamFromUrl(bestAudio.url, tmpAudio);
    await new Promise<void>((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-y', '-i', tmpAudio, '-vn', '-ab', `${audioBitrate}k`, outputPath]);
      ff.on('close', code => {
        if (fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio);
        if (code === 0) resolve(); else reject(new Error('ffmpeg audio conversion failed'));
      });
    });
    return;
  }

  // VIDEO mode: pick video-only stream closest to targetHeight (prefer mp4)
  const videoOnly = videos.filter(v => !v.hasAudio && v.url);
  const mp4Videos = videoOnly.filter(v => v.extension === 'mp4');
  const pool = mp4Videos.length > 0 ? mp4Videos : videoOnly;
  const parseH = (v: any) => parseInt(v.quality || v.qualityLabel || '0', 10);
  const bestVideo = pool.sort((a, b) => Math.abs(parseH(a) - targetHeight) - Math.abs(parseH(b) - targetHeight))[0]
    || videos.find(v => v.hasAudio && v.url); // muxed fallback
  if (!bestVideo?.url) throw new Error('API: no video stream found');

  const tmpVideo = outputPath.replace('.mp4', '.tmp_v.mp4');
  const tmpAudio = outputPath.replace('.mp4', '.tmp_a.m4a');

  console.log(`API: downloading video ${parseH(bestVideo)}p + audio`);
  await Promise.all([
    downloadStreamFromUrl(bestVideo.url, tmpVideo),
    downloadStreamFromUrl(bestAudio.url, tmpAudio),
  ]);

  // Merge video + audio with ffmpeg
  await new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-i', tmpVideo,
      '-i', tmpAudio,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      outputPath,
    ]);
    ff.on('close', code => {
      if (fs.existsSync(tmpVideo)) fs.unlinkSync(tmpVideo);
      if (fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio);
      if (code === 0) resolve(); else reject(new Error('ffmpeg merge failed'));
    });
  });
}


const router = Router();
const execAsync = promisify(exec);

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

function safeAudioQuality(value: unknown): string {
  const q = String(value || '192');
  return ['128', '192', '320'].includes(q) ? q : '192';
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
    const videoId = cleanUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/)?.[1];

    if (!videoId) {
      res.status(400).json({ success: false, message: 'Invalid YouTube URL' });
      return;
    }

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
      quality: '192',
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
          const { stdout } = await execAsync(
            `yt-dlp --print title --print duration --no-playlist "${cleanUrl}"`
          );
          const lines = stdout.trim().split('\n');
          videoTitle = (lines[0] || '').trim() || 'YouTube Audio';
          durationSec = parseInt((lines[1] || '').trim(), 10) || 0;
        } catch { /* keep defaults */ }

        const safeTitle = sanitizeFilename(videoTitle) || 'YouTube Audio';
        const reqQuality = String(req.body.quality || '192');
        const audioQuality: string = (['128', '192', '320'].includes(reqQuality)) ? reqQuality : '192';

        conversion.youtubeTitle = videoTitle;
        conversion.outputFilename = `${safeTitle} (${audioQuality}kbps).mp3`;
        await conversion.save();

        // Step 2: Download audio using yt-dlp
        try {
          await new Promise((resolve, reject) => {
            const ytdlp = spawn('yt-dlp', ['-x', '--audio-format', 'mp3', '--audio-quality', `${audioQuality}K`, '-o', outputPath, '--no-playlist', cleanUrl]);

            let lastUpdate = Date.now();
            ytdlp.stdout.on('data', (data) => {
              const output = data.toString();
              const match = output.match(/\[download\]\s+([\d\.]+)%/);
              if (match) {
                const progress = Math.round(parseFloat(match[1]));
                const now = Date.now();
                if (now - lastUpdate > 1000) {
                  lastUpdate = now;
                  Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => { });
                }
              }
            });

            ytdlp.on('close', (code) => {
              if (code === 0) resolve(true);
              else reject(new Error('yt-dlp failed with code ' + code));
            });
          });
        } catch (ytdlpError: any) {
          console.error('yt-dlp failed for audio, trying alternatives:', ytdlpError.message);

          // Helper: stream a youtubei.js iterable into a file
          const streamToFile = async (stream: AsyncIterable<Uint8Array>, filePath: string) => {
            await new Promise<void>((resolve, reject) => {
              const fileStream = fs.createWriteStream(filePath);
              fileStream.on('finish', resolve);
              fileStream.on('error', reject);
              (async () => {
                try { for await (const chunk of stream) fileStream.write(chunk); fileStream.end(); }
                catch (e) { reject(e); }
              })();
            });
          };

          let audioDownloaded = false;

          // Tier 2: RapidAPI — returns live signed Google CDN URLs, bypasses IP blocks
          if (!audioDownloaded) {
            try {
              console.log('Trying RapidAPI for audio...');
              const rawPath = outputPath.replace('.mp3', '.m4a');
              await downloadAndMergeViaAPI(videoId, rawPath, 'audio', 720, audioQuality);
              // Convert m4a → mp3
              await new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', ['-y', '-i', rawPath, '-vn', '-ab', `${audioQuality}k`, outputPath]);
                ffmpeg.on('close', (code) => {
                  if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
                  if (code === 0) resolve(true); else reject(new Error('FFmpeg m4a→mp3 failed'));
                });
              });
              audioDownloaded = true;
              console.log('RapidAPI audio succeeded');
            } catch (e: any) {
              console.error('RapidAPI audio failed:', e.message);
            }
          }

          // Tier 3a: youtubei.js MWEB — audio-only stream
          if (!audioDownloaded) {
            try {
              console.log('Trying youtubei.js MWEB for audio...');
              const yt = await Innertube.create({ generate_session_locally: true, fetch: fetch, cache: new UniversalCache(false), client_type: ClientType.MWEB });
              const stream = await yt.download(videoId, { type: 'audio', quality: 'best', format: 'any' });
              const fallbackVideoPath = outputPath.replace('.mp3', '.m4a');
              await streamToFile(stream, fallbackVideoPath);
              await new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', ['-y', '-i', fallbackVideoPath, '-vn', '-ab', `${audioQuality}k`, outputPath]);
                ffmpeg.on('close', (code) => {
                  if (fs.existsSync(fallbackVideoPath)) fs.unlinkSync(fallbackVideoPath);
                  if (code === 0) resolve(true); else reject(new Error('FFmpeg MWEB audio extraction failed'));
                });
              });
              audioDownloaded = true;
            } catch (e: any) {
              console.error('youtubei.js MWEB audio failed:', e.message);
            }
          }

          // Tier 3b: youtubei.js ANDROID — video+audio → extract audio
          if (!audioDownloaded) {
            try {
              console.log('Trying youtubei.js ANDROID for video+audio→mp3...');
              const yt = await Innertube.create({ generate_session_locally: true, fetch: fetch, cache: new UniversalCache(false), client_type: ClientType.ANDROID });
              const stream = await yt.download(videoId, { type: 'video+audio', quality: 'best', format: 'mp4' });
              const fallbackVideoPath = outputPath.replace('.mp3', '.mp4');
              await streamToFile(stream, fallbackVideoPath);
              await new Promise((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', ['-y', '-i', fallbackVideoPath, '-vn', '-ab', `${audioQuality}k`, outputPath]);
                ffmpeg.on('close', (code) => {
                  if (fs.existsSync(fallbackVideoPath)) fs.unlinkSync(fallbackVideoPath);
                  if (code === 0) resolve(true); else reject(new Error('FFmpeg ANDROID extraction failed'));
                });
              });
              audioDownloaded = true;
            } catch (e: any) {
              console.error('youtubei.js ANDROID audio failed:', e.message);
            }
          }

          if (!audioDownloaded) throw new Error('All download methods failed for audio');
        }

        conversion.status = 'completed';
        conversion.progress = 100;
        conversion.fileSize = getFileSize(outputPath);
        conversion.outputUrl = `/outputs/${diskFilename}`;
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
    const reqQuality = String(req.body.mp4Quality || req.body.quality || '720p');
    const videoQuality: string = (['360p', '480p', '720p', '1080p', '4K', '8K'].includes(reqQuality))
      ? reqQuality : '720p';

    if (!youtubeUrl) {
      res.status(400).json({ success: false, message: 'YouTube URL is required' });
      return;
    }

    const cleanUrl = String(youtubeUrl).trim();
    const videoId = cleanUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/)?.[1];

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
            const { stdout } = await execAsync(
              `yt-dlp --print title --no-playlist "${cleanUrl}"`
            );
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

          try {
            await new Promise((resolve, reject) => {
              const ytdlp = spawn('yt-dlp', ['-S', ytSort, '-o', path.join(outputDir, `${fileId}.%(ext)s`), '--no-playlist', cleanUrl]);
    
              let lastUpdate = Date.now();
              ytdlp.stdout.on('data', (data) => {
                const output = data.toString();
                const match = output.match(/\[download\]\s+([\d\.]+)%/);
                if (match) {
                  const progress = Math.round(parseFloat(match[1]));
                  const now = Date.now();
                  if (now - lastUpdate > 1000) {
                    lastUpdate = now;
                    Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => { });
                  }
                }
              });
    
              ytdlp.on('close', (code) => {
                if (code === 0) resolve(true);
                else reject(new Error('yt-dlp failed with code ' + code));
              });
            });
          } catch (ytdlpError: any) {
            console.error('yt-dlp failed for video, trying alternatives:', ytdlpError.message);

            // Helper: stream a youtubei.js iterable into a file
            const streamToFile = async (stream: AsyncIterable<Uint8Array>, filePath: string) => {
              await new Promise<void>((resolve, reject) => {
                const fileStream = fs.createWriteStream(filePath);
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
                (async () => {
                  try { for await (const chunk of stream) fileStream.write(chunk); fileStream.end(); }
                  catch (e) { reject(e); }
                })();
              });
            };

            let videoDownloaded = false;
            const fallbackOutputPath = path.join(outputDir, `${fileId}.mp4`);
            const targetHeightMap: Record<string, number> = { '360p': 360, '480p': 480, '720p': 720, '1080p': 1080, '4K': 2160, '8K': 4320 };
            const targetH = targetHeightMap[videoQuality] || 720;

            // Tier 2: RapidAPI
            if (!videoDownloaded) {
              try {
                console.log('Trying RapidAPI for video...');
                await downloadAndMergeViaAPI(videoId, fallbackOutputPath, 'video', targetH);
                videoDownloaded = true;
                console.log('RapidAPI video succeeded');
              } catch (e: any) {
                console.error('RapidAPI video failed:', e.message);
              }
            }

            // Tier 3: youtubei.js cascade
            for (const clientType of [ClientType.ANDROID, ClientType.TV, ClientType.MWEB]) {
              if (videoDownloaded) break;
              try {
                console.log(`Trying youtubei.js ${clientType} for video...`);
                const yt = await Innertube.create({ generate_session_locally: true, fetch: fetch, cache: new UniversalCache(false), client_type: clientType });
                const stream = await yt.download(videoId, { type: 'video+audio', quality: 'best', format: 'mp4' });
                await streamToFile(stream, fallbackOutputPath);
                videoDownloaded = true;
                console.log(`youtubei.js ${clientType} video succeeded`);
              } catch (e: any) {
                console.error(`youtubei.js ${clientType} video failed:`, e.message);
              }
            }

            if (!videoDownloaded) throw new Error('All download methods failed for video');
          }

          // Find the actual downloaded file since the extension could be .webm, .mkv, or .mp4
          const files = fs.readdirSync(outputDir);
          const downloadedFile = files.find(f => f.startsWith(fileId + '.') && !f.endsWith('.part') && !f.endsWith('.ytdl'));
          
          if (downloadedFile) {
            const actualExt = path.extname(downloadedFile);
            conversion.outputPath = path.join(outputDir, downloadedFile);
            conversion.outputFilename = `${safeTitle} (${videoQuality})${actualExt}`;
          }

          // Step 3: Mark complete
          conversion.status = 'completed';
          conversion.progress = 100;
          conversion.fileSize = getFileSize(conversion.outputPath);
          conversion.outputUrl = `/outputs/${diskFilename}`;
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
    const { stdout } = await execAsync(
      `yt-dlp --print "%(title)s" --print "%(thumbnail)s" --print "%(resolution)s" --print "%(filesize_approx,filesize)s" --no-playlist "${cleanUrl}"`
    );

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
    const videoQuality: string = (['360p', '480p', '720p', '1080p', '4K', '8K'].includes(req.body.mp4Quality))
      ? req.body.mp4Quality : '720p';

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
          const { stdout } = await execAsync(
            `yt-dlp --print title --print thumbnail --no-playlist "${cleanUrl}"`
          );
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
        const ytdlp = spawn('yt-dlp', ['-S', ytSort, '-o', path.join(outputDir, `${fileId}.%(ext)s`), '--no-playlist', cleanUrl]);

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
        const files = fs.readdirSync(outputDir);
        const downloadedFile = files.find(f => f.startsWith(fileId + '.') && !f.endsWith('.part') && !f.endsWith('.ytdl'));
        
        if (downloadedFile) {
          const actualExt = path.extname(downloadedFile);
          conversion.outputPath = path.join(outputDir, downloadedFile);
          conversion.outputFilename = safeTitle + actualExt;
        }

        // Step 3: Mark complete
        conversion.status = 'completed';
        conversion.progress = 100;
        conversion.fileSize = getFileSize(conversion.outputPath);
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
    const { stdout } = await execAsync(
      `yt-dlp --flat-playlist --dump-json "${cleanUrl}"`
    );

    const lines = stdout.trim().split('\n');
    const videos = lines.map(line => {
      try {
        const item = JSON.parse(line);
        // yt-dlp flat-playlist uses 'id', 'title', 'url'
        return {
          id: item.id,
          title: item.title,
          url: item.url || `https://www.youtube.com/watch?v=${item.id}`,
          thumbnail: `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
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
