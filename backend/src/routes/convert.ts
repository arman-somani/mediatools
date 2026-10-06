import { Router, Response, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

import {
  ytDlpBinary,
  buildArgs,
  runWithClientLadder,
  orderedClients,
  rememberWorkingClient,
  assertSafeUrl,
  parseYouTubeId,
  classifyYtDlpError,
  ExtractError,
} from '../services/ytdlp';

import { authenticate, AuthRequest } from '../middleware/auth';
import { convertLimiter, metadataLimiter, downloadLimiter } from '../middleware/rateLimiter';
import { buildDownloadUrl, verifyDownloadToken } from '../services/downloadToken';
import { asyncHandler } from '../utils/http';
import { env } from '../config/env';

import { Conversion } from '../models/Conversion';
import { User } from '../models/User';
import { Innertube, UniversalCache, Platform } from 'youtubei.js';
import vm from 'vm';

import { conversionQueue } from '../utils/queue';
import { uploadToGoFile } from '../utils/gofile';

/**
 * youtubei.js needs to evaluate YouTube's signature-deciphering JS. Running it
 * in a fresh V8 context keeps it out of this module's scope, so the remote
 * script cannot reach `process`, `require` or any local binding.
 */
Platform.shim.eval = (script: any) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()', Object.create(null), {
    timeout: 5000,
  });
};

const router = Router();

/**
 * Last-seen timestamp per conversion the frontend is actively watching.
 *
 * The download workers consult this to abandon a job whose browser tab has
 * gone away, which on a 512MB instance is the difference between finishing the
 * queue and being OOM-killed by work nobody is waiting for.
 *
 * Entries are normally removed when the job settles, but a crash or a redeploy
 * between `set` and `delete` would leave one behind forever, so the map is also
 * swept. Keys are only ever written for a conversion that exists and belongs to
 * the caller — see the status route.
 */
const activePolls = new Map<string, number>();
const POLL_ENTRY_TTL_MS = 30 * 60 * 1000;

const pollSweeper = setInterval(() => {
  const cutoff = Date.now() - POLL_ENTRY_TTL_MS;
  for (const [id, seen] of activePolls) {
    if (seen < cutoff) activePolls.delete(id);
  }
}, 10 * 60 * 1000);
pollSweeper.unref();

const execAsync = promisify(exec);

/**
 * URL parsing and yt-dlp invocation both live in ../services/ytdlp now.
 * They used to be reimplemented here, in extractor.ts and in direct.ts with
 * three slightly different sets of flags and three different bugs.
 */
const getYtDlpPath = ytDlpBinary;
const getYouTubeVideoId = parseYouTubeId;


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

/**
 * Fallback: download audio via youtubei.js when yt-dlp is blocked.
 * youtubei.js uses the InnerTube API with its own session management and
 * can often succeed where yt-dlp fails because it generates its own
 * visitor data and tokens.
 */
async function fallbackYoutubeJsAudio(
  videoId: string,
  outputPath: string,
  audioQuality: string
): Promise<{ title: string; thumbnail: string }> {
  console.log(`[youtubei.js] Attempting audio fallback for ${videoId}`);
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  const info = await yt.getBasicInfo(videoId);
  const title = info.basic_info?.title || 'Downloaded Audio';
  const thumbnail = info.basic_info?.thumbnail?.[0]?.url || '';

  // Get a streamable format — prefer audio-only
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  if (!format) throw new Error('youtubei.js: no audio format available');

  console.log(`[youtubei.js] Streaming audio (${format.mime_type}, ${format.bitrate}bps)...`);

  // Download the raw audio stream
  const rawPath = outputPath.replace(/\.mp3$/, '.raw_audio');
  const stream = await info.download({ type: 'audio', quality: 'best' });
  await writeAsyncIterableToFile(stream, rawPath);
  requireWrittenFile(rawPath, 'youtubei.js audio download');

  // Transcode to MP3 using ffmpeg
  const bitrateMap: Record<string, string> = { '128': '128k', '192': '192k', '320': '320k' };
  const bitrate = bitrateMap[audioQuality] || '192k';
  console.log(`[youtubei.js] Converting to MP3 at ${bitrate}...`);

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y', '-i', rawPath, '-vn', '-ab', bitrate, '-f', 'mp3', outputPath,
    ], { windowsHide: true });
    ffmpeg.on('close', code => {
      // Clean up raw file
      try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath); } catch {}
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg mp3 conversion failed with code ${code}`));
    });
    ffmpeg.on('error', reject);
  });

  requireWrittenFile(outputPath, 'youtubei.js → ffmpeg MP3');
  console.log(`[youtubei.js] ✓ Audio fallback succeeded`);
  return { title, thumbnail };
}

/**
 * Fallback: download video via youtubei.js when yt-dlp is blocked.
 */
async function fallbackYoutubeJsVideo(
  videoId: string,
  outputDir: string,
  fileId: string,
  targetHeight: string
): Promise<{ filePath: string; title: string; thumbnail: string }> {
  console.log(`[youtubei.js] Attempting video fallback for ${videoId}`);
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  const info = await yt.getBasicInfo(videoId);
  const title = info.basic_info?.title || 'Downloaded Video';
  const thumbnail = info.basic_info?.thumbnail?.[0]?.url || '';

  // Try to get a combined (muxed) format first for simplicity
  let format;
  try {
    format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
  } catch {
    // Fall back to video-only + separate audio
    format = info.chooseFormat({ type: 'video', quality: 'best' });
  }
  if (!format) throw new Error('youtubei.js: no video format available');

  const ext = (format.mime_type?.includes('mp4') ? 'mp4' : 'webm');
  const filePath = path.join(outputDir, `${fileId}.${ext}`);

  console.log(`[youtubei.js] Streaming video (${format.mime_type}, ${format.width}x${format.height})...`);
  const stream = await info.download({ type: 'video+audio', quality: 'best' });
  await writeAsyncIterableToFile(stream, filePath);
  requireWrittenFile(filePath, 'youtubei.js video download');

  // If the file is webm, remux to mp4 if ffmpeg is available
  if (ext === 'webm') {
    const mp4Path = path.join(outputDir, `${fileId}.mp4`);
    try {
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y', '-i', filePath, '-c', 'copy', '-f', 'mp4', mp4Path,
        ], { windowsHide: true });
        ffmpeg.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg remux failed with code ${code}`));
        });
        ffmpeg.on('error', reject);
      });
      // Swap files
      try { fs.unlinkSync(filePath); } catch {}
      console.log(`[youtubei.js] ✓ Remuxed webm → mp4`);
      return { filePath: mp4Path, title, thumbnail };
    } catch (e) {
      console.warn('[youtubei.js] webm→mp4 remux failed, keeping webm:', e);
    }
  }

  console.log(`[youtubei.js] ✓ Video fallback succeeded`);
  return { filePath, title, thumbnail };
}

/** Qualities gated behind a premium subscription. */
const PREMIUM_QUALITIES = new Set(['4K', '8K']);

/**
 * Enforces per-account limits before a job is queued.
 *
 * Throws an error carrying an HTTP `status`, so the shared error handler turns
 * it into a 403 rather than the 500 a bare `Error` used to produce — the
 * frontend showed "Internal server error" when a free account picked 4K.
 */
async function validateUserLimits(
  userId: string,
  requestedQuality: string
): Promise<void> {
  const user = await User.findById(userId).select(
    '_id role isPremium monthlyBandwidthUsed lastBandwidthReset'
  );
  if (!user) {
    throw Object.assign(new Error('Account not found.'), { status: 401 });
  }

  // Roll the bandwidth window over lazily, on first use in a new period.
  const now = Date.now();
  const lastReset = new Date(user.lastBandwidthReset || now).getTime();
  if (now - lastReset > 30 * 24 * 60 * 60 * 1000) {
    user.monthlyBandwidthUsed = 0;
    user.lastBandwidthReset = new Date(now);
    await user.save();
  }

  if (PREMIUM_QUALITIES.has(requestedQuality) && user.role !== 'admin' && !user.isPremium) {
    throw Object.assign(
      new Error('4K and 8K downloads are available on premium accounts.'),
      { status: 403 }
    );
  }
}

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
  const ext = path.extname(name).slice(0, 12);
  const stem = (ext ? name.slice(0, -ext.length) : name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Truncating the whole string to 200 chars used to cut the extension off a
    // long title, so the browser saved an extensionless file that nothing would
    // open. Trim the stem and keep the extension intact.
    .slice(0, 180);
  return `${stem || 'download'}${ext}`;
}

/**
 * Resolves a stored output path to a real file, or null.
 *
 * The containment check matters because `outputPath` is read back from Mongo
 * and handed to `res.download`. Confining it to the output directory means a
 * document whose path was ever set from user-influenced input still cannot
 * serve `/etc/passwd` or the app's own `.env`.
 */
function resolveOutputPath(stored: string | undefined | null): string | null {
  if (!stored) return null;
  const abs = path.resolve(stored);
  const root = outputDir.endsWith(path.sep) ? outputDir : outputDir + path.sep;
  if (abs !== outputDir && !abs.startsWith(root)) {
    console.error(`[download] refusing path outside the output directory: ${abs}`);
    return null;
  }
  try {
    return fs.statSync(abs).isFile() ? abs : null;
  } catch {
    return null;
  }
}

/* ── Video TO Audio ───────────────────────────────────────────────────────────── */
const SERVER_ROLE = process.env.SERVER_ROLE || 'all';

if (SERVER_ROLE === 'all' || SERVER_ROLE === 'audio') {
router.post(
  '/upload',
  authenticate,
  convertLimiter,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const file = req.file;
      const quality = safeAudioQuality(req.body.quality);

      if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
      if (!file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return; }

      await validateUserLimits(userId, quality);

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


        let totalDurationSecs = 0;
        try {
          const { stdout: probeOut } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file.path}"`);
          totalDurationSecs = parseFloat(probeOut.trim());
        } catch (e) {
          console.warn('ffprobe failed, progress may be inaccurate');
        }

        res.json({
          success: true,
          message: 'Upload conversion queued',
          data: {
            jobId: conversion._id.toString(),
            conversionId: conversion._id.toString(),
          },
        });

        conversionQueue.add({
          id: conversion._id.toString(),
          execute: async () => {
            try {
              const ffmpeg = spawn('ffmpeg', ['-y', '-i', file.path, '-threads', '1', '-vn', '-ab', `${quality}k`, outputPath]);

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
              if (conversion.fileSize) {
                await User.findByIdAndUpdate(userId, { $inc: { monthlyBandwidthUsed: conversion.fileSize } });
              }

              conversion.status = 'completed';
              conversion.progress = 100;
              await conversion.save();
              await User.findByIdAndUpdate(userId, { $inc: { totalConversions: 1 } });
            } catch (ffmpegError: any) {
              conversion.status = 'failed';
              conversion.errorMessage = ffmpegError.message || 'FFmpeg failed';
              await conversion.save();
            } finally {
              if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            }
          }
        });
      } catch (error: any) {
        console.error('Video error:', error);
        res.status(500).json({ success: false, message: error.message || 'Conversion failed' });
      }
    }
  );

/* ── YOUTUBE TO MP3 ─────────────────────────────────────── */
router.post('/youtube', authenticate, convertLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const videoUrl = req.body.youtubeUrl || req.body.url;
    const reqQuality = String(req.body.quality || '320');
    const audioQuality = ['128', '192', '320'].includes(reqQuality) ? reqQuality : '320';

    if (!videoUrl) {
      res.status(400).json({ success: false, message: 'Video URL is required' });
      return;
    }

    await validateUserLimits(userId, audioQuality);

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
      quality: audioQuality as any,
      progress: 0,
    });

    // See the note in /universal: resolve through the by-id streaming route
    // rather than guessing a static /outputs path.
    conversion.outputUrl = `/api/convert/download/${conversion._id}`;
    await conversion.save();

    res.json({
      success: true,
      message: 'YouTube conversion started',
      data: {
        jobId: conversion._id.toString(),
        conversionId: conversion._id.toString(),
      },
    });

    // Background processing
    conversionQueue.add({
      id: conversion._id.toString(),
      execute: async () => {
        try {
        let videoTitle = req.body.title || 'Downloaded Audio';
        let thumbnail = '';

        // Step 1: Fetch metadata via yt-dlp only if we don't have it
        if (!req.body.title) {
          try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
            const resp = await fetch(oembedUrl);
            if (resp.ok) {
              const data = await resp.json();
              if (data.title && data.title !== 'Downloaded Audio') videoTitle = data.title;
              if (data.thumbnail_url) thumbnail = data.thumbnail_url;
            }
          } catch (err) {
            console.warn('oEmbed audio metadata fetch failed:', err);
          }
        }

        const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Audio';
        conversion.youtubeTitle = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename = `${safeTitle}.mp3`;
        await conversion.save();

        const runYtDlpAudio = (client?: string) => new Promise((resolve, reject) => {
          // Save directly as a flat file, not in a subdirectory, to avoid path issues
          const flatOutputTemplate = path.join(outputDir, `${fileId}.%(ext)s`);
          const flags = [
            '--newline',
            '-f', 'ba/b',
            '-x', '--audio-format', 'mp3',
            '--audio-quality', `${audioQuality}K`,
            '-o', flatOutputTemplate,
          ];

          // cleanUrl is passed as a separate positional list so buildArgs can
          // place it after `--`. Appending it into the flags array (as this
          // did before) is what allowed a URL of "--exec=..." to be read as an
          // option and execute a shell command on the server.
          const ytdlp = spawn(getYtDlpPath(), buildArgs(flags, [cleanUrl], client), {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          activePolls.set(conversion._id.toString(), Date.now());
          const zombieKiller = setInterval(() => {
            const lastPoll = activePolls.get(conversion._id.toString());
            if (lastPoll && Date.now() - lastPoll > 60000) {
              ytdlp.kill('SIGKILL');
              clearInterval(zombieKiller);
              reject(new ExtractError('TIMEOUT', 'Download cancelled — the page stopped responding.', false));
            }
          }, 5000);

          let lastUpdate = Date.now();
          ytdlp.stdout.on('data', (data) => {
            const match = data.toString().match(/\[download\]\s+([\d.]+)%/);
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

          let audioStderr = '';
          ytdlp.stderr.on('data', (data) => {
            audioStderr += data.toString();
            if (audioStderr.length > 64_000) audioStderr = audioStderr.slice(-32_000);
          });

          ytdlp.on('error', (e: any) => {
            clearInterval(zombieKiller);
            reject(new ExtractError(
              'UNKNOWN',
              e?.code === 'ENOENT' ? 'yt-dlp is not installed on this server.' : `Could not start yt-dlp: ${e?.message}`,
              false
            ));
          });

          ytdlp.on('close', (code) => {
            clearInterval(zombieKiller);
            activePolls.delete(conversion._id.toString());
            if (code === 0) resolve(true);
            else reject(classifyYtDlpError(audioStderr));
          });
        });

        let success = false;
        let lastFailure: ExtractError | null = null;

        // Walk the no-PO-token client ladder, most-recently-successful first.
        // A non-retriable verdict (bot check, private, geo-block) ends the loop
        // immediately: those are deterministic, so trying four more clients
        // only burns ~30s and more requests against an already-throttled IP.
        for (const client of orderedClients()) {
          console.log(`[audio] trying client=${client}`);
          try {
            await runYtDlpAudio(client);
            console.log(`[audio] succeeded with client=${client}`);
            success = true;
            break;
          } catch (err: any) {
            const failure = err instanceof ExtractError
              ? err
              : new ExtractError('UNKNOWN', String(err?.message || err), true);
            lastFailure = failure;
            console.warn(`[audio] client=${client} failed: ${failure.code} — ${failure.message}`);
            if (!failure.retriable) break;
          }
        }

        // Final fallback: youtubei.js talks to the InnerTube API directly, so
        // it fails independently of yt-dlp. Only worth trying when the failure
        // was retriable — it cannot un-private a private video.
        if (!success && (lastFailure?.retriable ?? true)) {
          const ytVideoId = getYouTubeVideoId(cleanUrl);
          if (ytVideoId) {
            console.log(`[audio] yt-dlp exhausted, trying youtubei.js for ${ytVideoId}`);
            try {
              const result = await fallbackYoutubeJsAudio(ytVideoId, outputPath, audioQuality);
              if (result.title && result.title !== 'Downloaded Audio') videoTitle = result.title;
              if (result.thumbnail) thumbnail = result.thumbnail;
              success = true;
            } catch (err: any) {
              console.error('[audio] youtubei.js fallback also failed:', err?.message || err);
            }
          }
        }

        if (!success) {
          throw lastFailure ?? new ExtractError('UNKNOWN', 'All download attempts failed.', false);
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
        
        if (conversion.fileSize) {
          await User.findByIdAndUpdate(userId, { $inc: { monthlyBandwidthUsed: conversion.fileSize } });
        }

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
    }
    });

  } catch (error: any) {
    console.error('YouTube audio route error:', error);
    res.status(500).json({ success: false, message: error.message || 'YouTube audio conversion failed' });
  }
});
} // END audio routes

if (SERVER_ROLE === 'all' || SERVER_ROLE === 'video') {
/* ── YOUTUBE FORMATS EXTRACTOR (used by the browser extension) ───── */
router.post('/youtube-formats', metadataLimiter, asyncHandler(async (req: Request, res: Response) => {
  // assertSafeUrl before the value can reach an argv array. This endpoint is
  // unauthenticated, so it is the most exposed yt-dlp call site in the app.
  const videoUrl = assertSafeUrl(req.body.url);

  // One pass, printing both the title and the two resolved media URLs, instead
  // of two separate extractions of the same video.
  const result = await runWithClientLadder(
    [
      '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
      '--print', '%(title)s',
      '--print', '%(urls)s',
      '--ignore-no-formats-error',
    ],
    [videoUrl],
    { timeoutMs: 60_000 }
  );

  const lines = result.stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const title = lines[0] || 'Video';
  const urls = lines.slice(1).filter(line => line.startsWith('http'));

  if (urls.length < 2) {
    res.status(422).json({
      success: false,
      code: 'FORMAT_UNAVAILABLE',
      message: 'Could not find separate audio and video streams to merge for this video.',
    });
    return;
  }

  res.json({ success: true, title, videoUrl: urls[0], audioUrl: urls[1] });
}));

/* ── UNIVERSAL VIDEO METADATA ────────────────────────────────────── */
router.post('/universal/metadata', metadataLimiter, asyncHandler(async (req: Request, res: Response) => {
  const cleanUrl = assertSafeUrl(req.body.url);

  // One extraction, five `--print` templates, walking the client ladder.
  // The old loop retried the *same* arguments three times and only differed by
  // whether PROXY_URL was attached — so on a bot check it took three full
  // extractions to report a verdict the first one already had.
  const { stdout } = await runWithClientLadder(
    [
      '--print', '%(title)s',
      '--print', '%(thumbnail)s',
      '--print', '%(resolution)s',
      '--print', '%(filesize_approx,filesize)s',
      '--print', '%(duration)s',
      '--ignore-no-formats-error',
    ],
    [cleanUrl],
    { timeoutMs: 45_000 }
  );

  const lines = stdout.trim().split('\n').map(l => l.trim());
  const naToEmpty = (v: string) => (!v || v === 'NA' ? '' : v);

  const sizeBytes = Number.parseInt(naToEmpty(lines[3] || ''), 10);
  const duration = Number.parseFloat(naToEmpty(lines[4] || ''));

  res.json({
    success: true,
    data: {
      title: naToEmpty(lines[0] || '') || 'Video',
      thumbnail: naToEmpty(lines[1] || ''),
      resolution: naToEmpty(lines[2] || '') || 'Best available',
      sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
      duration: Number.isFinite(duration) ? Math.round(duration) : 0,
    },
  });
}));

/* ΓöÇΓöÇ UNIVERSAL VIDEO DOWNLOADER ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
router.post('/universal', authenticate, convertLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const videoUrl = req.body.url;
    const reqQuality = String(req.body.mp4Quality || req.body.videoQuality || req.body.quality || '720p');
    const videoQuality: string = (['360p', '480p', '720p', '1080p', '4K', '8K'].includes(reqQuality))
      ? reqQuality : '720p';

    if (!videoUrl) {
      res.status(400).json({ success: false, message: 'Video URL is required' });
      return;
    }

    await validateUserLimits(userId, videoQuality);

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
      quality: '192',
      videoQuality: videoQuality as any,
      progress: 0,
    });

    // Point at the by-id streaming route, which resolves the REAL file recorded
    // in outputPath and sets Content-Disposition. The previous static guess
    // (`/outputs/<uuid>.mp4`) 404'd whenever yt-dlp wrote a different container,
    // and because it was always truthy it also dead-ended the CDN fallbacks below.
    conversion.outputUrl = `/api/convert/download/${conversion._id}`;
    await conversion.save();

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
    conversionQueue.add({
      id: conversion._id.toString(),
      execute: async () => {
        try {
        let videoTitle = req.body.title || 'Downloaded Video';
        let thumbnail = '';

        // Step 1: Fetch metadata via yt-dlp only if we don't have it
        if (!req.body.title) {
          try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
            const resp = await fetch(oembedUrl);
            if (resp.ok) {
              const data = await resp.json();
              if (data.title && data.title !== 'Downloaded Video') videoTitle = data.title;
              if (data.thumbnail_url) thumbnail = data.thumbnail_url;
            }
          } catch (err) {
            console.warn('oEmbed video metadata fetch failed:', err);
          }
        }

        const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Video';
        conversion.youtubeTitle = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename = `${safeTitle}.mp4`;
        await conversion.save();

        // Step 2: Download video with the user's selected quality
        console.log(`[QUALITY DEBUG] User requested: ${videoQuality} → targetHeight: ${targetHeight}`);
        const runYtDlpDownload = (proxy?: string, client?: string) => new Promise((resolve, reject) => {
          // Prefer H.264 video + AAC audio so the merge is a pure stream copy
          // into a real .mp4. Two reasons this matters:
          //  1) yt-dlp's default pick here was AV1+Opus, which merges to .webm -
          //     and the DB row promised /outputs/<id>.mp4, so the download 404'd.
          //  2) avc1/mp4a remuxes with -c copy, which is nearly free on a 512MB
          //     instance; re-encoding AV1 would OOM.
          const formatStr = [
            `bv*[height<=${targetHeight}][vcodec^=avc1]+ba[acodec^=mp4a]`,
            `bv*[height<=${targetHeight}]+ba`,
            `b[height<=${targetHeight}]`,
            `bv*+ba/b`,
          ].join('/');
          console.log(`[QUALITY] ${videoQuality} -> height<=${targetHeight}, client=${client || 'default'}`);
          const flags = [
            '--newline',
            '-f', formatStr,
            '-S', `res:${targetHeight},vcodec:h264,acodec:aac,ext:mp4`,
            // Guarantee the container matches the .mp4 we advertise.
            '--merge-output-format', 'mp4',
            '-o', path.join(outputDir, `${fileId}.%(ext)s`),
            '--hls-prefer-native',
          ];

          // Positional URL kept out of the flags array — see the audio path.
          const ytdlp = spawn(getYtDlpPath(), buildArgs(flags, [cleanUrl], client), {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          activePolls.set(conversion._id.toString(), Date.now());
          const zombieKiller = setInterval(() => {
            const lastPoll = activePolls.get(conversion._id.toString());
            if (lastPoll && Date.now() - lastPoll > 60000) {
              ytdlp.kill('SIGKILL');
              clearInterval(zombieKiller);
              reject(new ExtractError('TIMEOUT', 'Download cancelled — the page stopped responding.', false));
            }
          }, 5000);

          let lastUpdate = Date.now();
          ytdlp.stdout.on('data', (data) => {
            const match = data.toString().match(/\[download\]\s+([\d.]+)%/);
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

          let videoStderr = '';
          ytdlp.stderr.on('data', (data) => {
            videoStderr += data.toString();
            if (videoStderr.length > 64_000) videoStderr = videoStderr.slice(-32_000);
          });

          ytdlp.on('error', (e: any) => {
            clearInterval(zombieKiller);
            reject(new ExtractError(
              'UNKNOWN',
              e?.code === 'ENOENT' ? 'yt-dlp is not installed on this server.' : `Could not start yt-dlp: ${e?.message}`,
              false
            ));
          });

          ytdlp.on('close', (code) => {
            clearInterval(zombieKiller);
            activePolls.delete(conversion._id.toString());
            if (code === 0) resolve(true);
            else reject(classifyYtDlpError(videoStderr));
          });
        });

        let success = false;
        let lastFailure: ExtractError | null = null;

        // Same no-PO-token client ladder as the audio path, most-recently
        // successful client first, stopping on any deterministic verdict.
        for (const client of orderedClients()) {
          console.log(`[video] trying client=${client}`);
          try {
            await runYtDlpDownload(client);
            console.log(`[video] succeeded with client=${client}`);
            success = true;
            break;
          } catch (err: any) {
            const failure = err instanceof ExtractError
              ? err
              : new ExtractError('UNKNOWN', String(err?.message || err), true);
            lastFailure = failure;
            console.warn(`[video] client=${client} failed: ${failure.code} — ${failure.message}`);
            if (!failure.retriable) break;
          }
        }

        // Final fallback: youtubei.js, which reaches InnerTube independently.
        if (!success && (lastFailure?.retriable ?? true)) {
          const ytVideoId = getYouTubeVideoId(cleanUrl);
          if (ytVideoId) {
            console.log(`[video] yt-dlp exhausted, trying youtubei.js for ${ytVideoId}`);
            try {
              const result = await fallbackYoutubeJsVideo(ytVideoId, outputDir, fileId, targetHeight);
              if (result.title && result.title !== 'Downloaded Video') videoTitle = result.title;
              if (result.thumbnail) thumbnail = result.thumbnail;
              conversion.outputPath = result.filePath;
              success = true;
            } catch (err: any) {
              console.error('[video] youtubei.js fallback also failed:', err?.message || err);
            }
          }
        }

        if (!success) {
          throw lastFailure ?? new ExtractError('UNKNOWN', 'All download attempts failed.', false);
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
        
        if (conversion.fileSize) {
          await User.findByIdAndUpdate(userId, { $inc: { monthlyBandwidthUsed: conversion.fileSize } });
        }
        
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
    }
    });

  } catch (error: any) {
    console.error('Universal route error:', error);
    res.status(500).json({ success: false, message: error.message || 'Universal video download failed' });
  }
});
} // END video routes

/* ── STATUS (the frontend polls this) ────────────────────────────────── */

/**
 * GET /api/convert/status/:id
 *
 * Authenticated and ownership-checked. Previously open to anyone, which leaked
 * the title, thumbnail and output URL of every job on the instance to anybody
 * who could produce an ObjectId — and see services/downloadToken.ts on why
 * ObjectIds are close to enumerable.
 */
router.get('/status/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const conversion = await Conversion.findById(req.params.id).select('-outputPath');

  // One response for "no such job" and "not your job", so this cannot be used
  // to probe which ids exist.
  if (!conversion || (conversion.userId && conversion.userId !== req.user!.id)) {
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Conversion not found' });
    return;
  }

  const id = conversion._id.toString();

  // Recorded only for a job that actually exists. The previous line ran
  // `activePolls.set(req.params.id, ...)` before the lookup, so any request
  // with a made-up id added a permanent map entry — an unbounded,
  // attacker-controlled cache on a 512MB instance.
  activePolls.set(id, Date.now());

  const queuePosition = conversionQueue.getQueuePosition(id);

  res.json({
    success: true,
    data: {
      jobId: id,
      status: queuePosition > 0 ? 'queued' : conversion.status,
      queuePosition,
      progress: conversion.progress,
      outputFilename: conversion.outputFilename,
      // Both spellings. The frontend reads `fileSize` in some components and
      // `filesize` in others, and the mismatch showed downloads as "0 B".
      fileSize: conversion.fileSize,
      filesize: conversion.fileSize,
      videoQuality: conversion.videoQuality,
      youtubeTitle: conversion.youtubeTitle,
      youtubeThumbnail: conversion.youtubeThumbnail,
      errorMessage: conversion.errorMessage,
      // A signed, expiring link, issued only to the owner and only once the
      // file is ready. This is what makes the download endpoint safe to expose
      // to a header-less browser navigation.
      downloadUrl: conversion.status === 'completed' ? buildDownloadUrl(id) : null,
      // External mirrors, when the file was uploaded off-instance.
      gofileUrl: conversion.gofileUrl || null,
      cdnUrl: conversion.cdnUrl || null,
    },
  });
}));

/* ── DOWNLOAD ────────────────────────────────────────────────────────── */

/** Hosts we are willing to 302 a user towards. */
const ALLOWED_REDIRECT_HOSTS = new Set([
  'gofile.io',
  'store1.gofile.io',
  'tmpfiles.org',
]);

function isAllowedRedirect(target: string): boolean {
  try {
    const url = new URL(target);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_REDIRECT_HOSTS.has(host)
      || host.endsWith('.gofile.io')
      || host.endsWith('.tmpfiles.org');
  } catch {
    return false;
  }
}

/**
 * Streams a completed conversion to the caller.
 *
 * Authorised by *either* a valid signed token in `?t=` or a bearer token from
 * the owning account, so both a browser navigation and a scripted client work.
 */
router.get('/download/:id', downloadLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  const verdict = verifyDownloadToken(id, req.query.t);

  if (verdict === 'expired') {
    res.status(410).json({
      success: false,
      code: 'LINK_EXPIRED',
      message: 'This download link has expired. Refresh the page to get a new one.',
    });
    return;
  }

  const conversion = await Conversion.findById(id);
  if (!conversion) {
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Conversion not found' });
    return;
  }

  // No valid signature, so fall back to proving ownership with a bearer token.
  if (verdict !== 'valid') {
    const owner = conversion.userId;
    if (!owner || owner !== req.user?.id) {
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'This download link is not valid for your account.',
      });
      return;
    }
  }

  // A user file must never be stored by a shared cache. The previous handler
  // sent `Cache-Control: public, max-age=604800`, which invited any
  // intermediary or CDN to keep one user's media for a week and hand it to the
  // next caller of the same URL.
  res.setHeader('Cache-Control', 'private, no-store');

  // Mirror links, validated against an allow-list. `res.redirect(outputUrl)`
  // on an unchecked stored string was an open redirect.
  const mirror = conversion.cdnUrl || conversion.gofileUrl
    || (conversion.outputUrl?.startsWith('http') ? conversion.outputUrl : null);

  if (mirror) {
    if (!isAllowedRedirect(mirror)) {
      console.error(`[download] refusing redirect to non-allow-listed host: ${mirror}`);
      res.status(502).json({
        success: false,
        code: 'BAD_MIRROR',
        message: 'The stored download location is not trusted.',
      });
      return;
    }
    await Conversion.updateOne({ _id: id }, { $inc: { downloadCount: 1 } });
    res.redirect(302, mirror);
    return;
  }

  const filePath = resolveOutputPath(conversion.outputPath);
  if (!filePath) {
    res.status(404).json({
      success: false,
      code: 'FILE_GONE',
      message: 'This file has expired. Please run the conversion again.',
    });
    return;
  }

  // Counted with $inc rather than a read-modify-write `save()`, which lost
  // concurrent increments and could overwrite fields the background job was
  // still updating.
  await Conversion.updateOne({ _id: id }, { $inc: { downloadCount: 1 } });

  // No per-download `setTimeout` deleting the file afterwards. That fired even
  // when the transfer failed, scheduled a fresh timer on every request, and
  // could delete a file out from under a second in-flight download. Expiry is
  // handled centrally by utils/cleanup.ts and the model's TTL index.
  res.download(filePath, sanitizeFilename(conversion.outputFilename || path.basename(filePath)), err => {
    if (err && !res.headersSent) {
      console.error(`[download] stream failed for ${id}: ${err.message}`);
    }
  });
}));

/* ── DOWNLOAD-TEMP (audio path, keyed by job file id) ────────────────── */

/**
 * GET /api/convert/download-temp/:fileId
 *
 * The old implementation resolved the file with
 * `files.find(f => f.startsWith(fileId))` against the whole output directory.
 * Because that is a *prefix* match on an unvalidated parameter, a request for
 * `/download-temp/a` returned the first file in the directory beginning with
 * "a" — someone else's download. Requiring a full UUID plus a signature
 * closes both halves of that.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/download-temp/:fileId', downloadLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { fileId } = req.params;

  if (!UUID_RE.test(fileId)) {
    res.status(400).json({ success: false, code: 'BAD_ID', message: 'Malformed file id.' });
    return;
  }

  const verdict = verifyDownloadToken(fileId, req.query.t);
  if (verdict === 'expired') {
    res.status(410).json({ success: false, code: 'LINK_EXPIRED', message: 'This download link has expired.' });
    return;
  }
  if (verdict !== 'valid') {
    res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'This download link is not valid.' });
    return;
  }

  // Exact prefix on a full UUID, and the candidate must resolve to a real file
  // inside the output directory.
  let entries: string[];
  try {
    entries = fs.readdirSync(outputDir);
  } catch {
    res.status(404).json({ success: false, code: 'FILE_GONE', message: 'File not found.' });
    return;
  }

  const found = entries.find(f =>
    f.startsWith(`${fileId}.`) && !f.endsWith('.part') && !f.endsWith('.ytdl')
  );
  if (!found) {
    res.status(404).json({ success: false, code: 'FILE_GONE', message: 'File not found or already expired.' });
    return;
  }

  const filePath = resolveOutputPath(path.join(outputDir, found));
  if (!filePath) {
    res.status(404).json({ success: false, code: 'FILE_GONE', message: 'File not found.' });
    return;
  }

  const conversion = await Conversion.findOne({ outputPath: filePath }).select('outputFilename');

  res.setHeader('Cache-Control', 'private, no-store');
  res.download(filePath, sanitizeFilename(conversion?.outputFilename || found), err => {
    if (err && !res.headersSent) {
      console.error(`[download-temp] stream failed for ${fileId}: ${err.message}`);
    }
  });
}));

/* ── PUBLIC-FILE (legacy alias) ──────────────────────────────────────── */

/**
 * Retained only so old links do not 404 silently. It carried the same IDOR as
 * /download/:id and had no authorisation of any kind, so it now redirects into
 * the signed flow rather than serving bytes itself.
 */
router.get('/public-file/:id', downloadLimiter, (req: Request, res: Response) => {
  const token = typeof req.query.t === 'string' ? req.query.t : '';
  res.redirect(308, `/api/convert/download/${encodeURIComponent(req.params.id)}${token ? `?t=${encodeURIComponent(token)}` : ''}`);
});


export default router;



