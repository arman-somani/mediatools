import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { convertLimiter } from '../middleware/rateLimiter';
import { Conversion } from '../models/Conversion';
import { conversionQueue, QueueFullError } from '../utils/queue';
import { buildDownloadUrl } from '../services/downloadToken';
import { asyncHandler } from '../utils/http';

const execAsync = promisify(exec);
const router = Router();

const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
const outputDir = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../../outputs'));

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'audio';
}

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const parsed = parseFloat(stdout.trim());
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

/** Helper to queue and execute an FFmpeg command with progress tracking. */
async function queueAudioJob({
  userId,
  taskName,
  originalName,
  outputFilename,
  outputPath,
  totalDuration,
  ffmpegArgs,
  tempFilesToClean = [],
}: {
  userId?: string;
  taskName: string;
  originalName: string;
  outputFilename: string;
  outputPath: string;
  totalDuration: number;
  ffmpegArgs: string[];
  tempFilesToClean?: string[];
}): Promise<{ jobId: string; queuePosition: number; estimatedWaitSeconds: number }> {
  if (!conversionQueue.hasCapacity()) {
    throw new QueueFullError(conversionQueue.depth);
  }

  const queuePosition = conversionQueue.depth + (conversionQueue.busy ? 1 : 0);
  const estimatedWaitSeconds = Math.max(3, queuePosition * 5);

  const conversion: any = await Conversion.create({
    userId,
    type: 'audio-tool',
    status: 'processing',
    originalName,
    outputFilename,
    outputPath,
    outputUrl: `/outputs/${path.basename(outputPath)}`,
    progress: 0,
    quality: '320',
  });

  const jobId = conversion._id.toString();

  conversionQueue.add({
    id: jobId,
    execute: async () => {
      try {
        conversionQueue.setCurrent({
          id: jobId,
          title: `${taskName}: ${sanitizeFilename(originalName)}`,
          type: 'audio',
          progress: 0,
          startedAt: Date.now(),
        });

        // Use -threads 1 to keep CPU usage <20% on shared hosting
        const finalArgs = ['-y', ...ffmpegArgs, '-threads', '1', outputPath];
        const ffmpeg = spawn('ffmpeg', finalArgs, { windowsHide: true });

        let lastUpdate = 0;
        ffmpeg.stderr.on('data', (data) => {
          if (!totalDuration || totalDuration <= 0) return;
          const output = data.toString();
          const match = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (match) {
            const h = parseFloat(match[1]);
            const m = parseFloat(match[2]);
            const s = parseFloat(match[3]);
            const currentSecs = h * 3600 + m * 60 + s;
            const progress = Math.min(Math.round((currentSecs / totalDuration) * 100), 99);

            const now = Date.now();
            if (now - lastUpdate >= 500) {
              lastUpdate = now;
              Conversion.findByIdAndUpdate(jobId, { progress }).catch(() => {});
              conversionQueue.reportProgress(jobId, progress);
            }
          }
        });

        await new Promise<void>((resolve, reject) => {
          ffmpeg.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg exited with code ${code}`));
          });
          ffmpeg.on('error', (err) => reject(err));
        });

        let fileSize = 0;
        try {
          const stat = fs.statSync(outputPath);
          fileSize = stat.size;
        } catch {}

        await Conversion.findByIdAndUpdate(jobId, {
          status: 'completed',
          progress: 100,
          fileSize,
        });
      } catch (err: any) {
        console.error(`[audio-tools] error on ${taskName}:`, err.message);
        await Conversion.findByIdAndUpdate(jobId, {
          status: 'failed',
          errorMessage: err.message || 'Operation failed',
        });
      } finally {
        conversionQueue.clearCurrent(jobId);
        // Clean up input temp files
        for (const file of tempFilesToClean) {
          try {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          } catch {}
        }
      }
    },
  });

  return { jobId, queuePosition, estimatedWaitSeconds };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. AUDIO CONVERTER                                                         */
/* ────────────────────────────────────────────────────────────────────────── */
router.post(
  '/convert',
  authenticate,
  convertLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No audio file uploaded' });
      return;
    }

    const targetFormat = String(req.body.format || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bitrate = String(req.body.bitrate || '320').replace(/[^0-9]/g, '');
    const validFormats = ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'wma'];
    const chosenFormat = validFormats.includes(targetFormat) ? targetFormat : 'mp3';

    const baseName = sanitizeFilename(file.originalname.replace(/\.[^.]+$/, ''));
    const outputFilename = `${baseName}.${chosenFormat}`;
    const outputPath = path.join(outputDir, `${uuidv4()}.${chosenFormat}`);
    const duration = await probeDuration(file.path);

    const ffmpegArgs: string[] = ['-i', file.path, '-vn'];
    if (chosenFormat === 'mp3') {
      ffmpegArgs.push('-b:a', `${bitrate}k`, '-ar', '44100');
    } else if (chosenFormat === 'wav') {
      ffmpegArgs.push('-ar', '44100');
    } else if (chosenFormat === 'aac' || chosenFormat === 'm4a') {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', `${bitrate}k`);
    } else if (chosenFormat === 'ogg') {
      ffmpegArgs.push('-c:a', 'libvorbis', '-b:a', `${bitrate}k`);
    } else if (chosenFormat === 'flac') {
      ffmpegArgs.push('-c:a', 'flac');
    }

    const result = await queueAudioJob({
      userId: req.user?.id,
      taskName: 'Convert Audio',
      originalName: file.originalname,
      outputFilename,
      outputPath,
      totalDuration: duration,
      ffmpegArgs,
      tempFilesToClean: [file.path],
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. AUDIO TRIMMER                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
router.post(
  '/trim',
  authenticate,
  convertLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No audio file uploaded' });
      return;
    }

    const startSec = Math.max(0, parseFloat(req.body.startTime) || 0);
    const endSec = Math.max(startSec + 0.5, parseFloat(req.body.endTime) || 0);
    const fadeIn = Math.max(0, parseFloat(req.body.fadeIn) || 0);
    const fadeOut = Math.max(0, parseFloat(req.body.fadeOut) || 0);

    const ext = (path.extname(file.originalname) || '.mp3').toLowerCase();
    const baseName = sanitizeFilename(file.originalname.replace(/\.[^.]+$/, ''));
    const outputFilename = `${baseName}-trimmed${ext}`;
    const outputPath = path.join(outputDir, `${uuidv4()}${ext}`);

    const duration = endSec > startSec ? endSec - startSec : await probeDuration(file.path);

    const ffmpegArgs: string[] = ['-ss', String(startSec)];
    if (endSec > startSec) {
      ffmpegArgs.push('-to', String(endSec));
    }
    ffmpegArgs.push('-i', file.path, '-vn');

    if (fadeIn > 0 || fadeOut > 0) {
      const filters: string[] = [];
      if (fadeIn > 0) filters.push(`afade=t=in:ss=0:d=${fadeIn}`);
      if (fadeOut > 0 && duration > fadeOut) {
        filters.push(`afade=t=out:st=${(duration - fadeOut).toFixed(2)}:d=${fadeOut}`);
      }
      if (filters.length) ffmpegArgs.push('-af', filters.join(','));
    }

    const result = await queueAudioJob({
      userId: req.user?.id,
      taskName: 'Trim Audio',
      originalName: file.originalname,
      outputFilename,
      outputPath,
      totalDuration: duration,
      ffmpegArgs,
      tempFilesToClean: [file.path],
    });

    res.json({ success: true, data: result });
  })
);

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. CHANGE AUDIO SPEED                                                      */
/* ────────────────────────────────────────────────────────────────────────── */
router.post(
  '/speed',
  authenticate,
  convertLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No audio file uploaded' });
      return;
    }

    const speed = Math.max(0.5, Math.min(2.5, parseFloat(req.body.speed) || 1.0));
    const ext = (path.extname(file.originalname) || '.mp3').toLowerCase();
    const baseName = sanitizeFilename(file.originalname.replace(/\.[^.]+$/, ''));
    const outputFilename = `${baseName}-${speed}x${ext}`;
    const outputPath = path.join(outputDir, `${uuidv4()}${ext}`);

    const originalDuration = await probeDuration(file.path);
    const newDuration = originalDuration > 0 ? originalDuration / speed : 0;

    // Build atempo chain if speed > 2.0 (atempo accepts 0.5 to 2.0 per filter)
    let atempoFilter = `atempo=${speed.toFixed(2)}`;
    if (speed > 2.0) {
      atempoFilter = `atempo=2.0,atempo=${(speed / 2.0).toFixed(2)}`;
    }

    const ffmpegArgs: string[] = ['-i', file.path, '-filter:a', atempoFilter, '-vn'];

    const result = await queueAudioJob({
      userId: req.user?.id,
      taskName: 'Change Speed',
      originalName: file.originalname,
      outputFilename,
      outputPath,
      totalDuration: newDuration,
      ffmpegArgs,
      tempFilesToClean: [file.path],
    });

    res.json({ success: true, data: result });
  })
);

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. AUDIO VOLUME ADJUSTER & NORMALIZER                                      */
/* ────────────────────────────────────────────────────────────────────────── */
router.post(
  '/volume',
  authenticate,
  convertLimiter,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No audio file uploaded' });
      return;
    }

    const normalize = req.body.normalize === 'true' || req.body.normalize === true;
    const volumePct = Math.max(10, Math.min(400, parseFloat(req.body.volume) || 100));
    const volumeMultiplier = (volumePct / 100).toFixed(2);

    const ext = (path.extname(file.originalname) || '.mp3').toLowerCase();
    const baseName = sanitizeFilename(file.originalname.replace(/\.[^.]+$/, ''));
    const outputFilename = `${baseName}-vol${volumePct}%${ext}`;
    const outputPath = path.join(outputDir, `${uuidv4()}${ext}`);
    const duration = await probeDuration(file.path);

    const filter = normalize ? 'loudnorm' : `volume=${volumeMultiplier}`;
    const ffmpegArgs: string[] = ['-i', file.path, '-filter:a', filter, '-vn'];

    const result = await queueAudioJob({
      userId: req.user?.id,
      taskName: 'Adjust Volume',
      originalName: file.originalname,
      outputFilename,
      outputPath,
      totalDuration: duration,
      ffmpegArgs,
      tempFilesToClean: [file.path],
    });

    res.json({ success: true, data: result });
  })
);

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. MERGE AUDIO FILES                                                       */
/* ────────────────────────────────────────────────────────────────────────── */
router.post(
  '/merge',
  authenticate,
  convertLimiter,
  upload.array('files', 10),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length < 2) {
      res.status(400).json({ success: false, message: 'Please upload at least 2 audio files to merge' });
      return;
    }

    // Write concat file
    const concatListPath = path.join(uploadDir, `concat-${uuidv4()}.txt`);
    const listContent = files.map((f) => `file '${f.path.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(concatListPath, listContent, 'utf8');

    let totalDuration = 0;
    for (const f of files) {
      totalDuration += await probeDuration(f.path);
    }

    const outputFilename = `merged-audio-${Date.now()}.mp3`;
    const outputPath = path.join(outputDir, `${uuidv4()}.mp3`);

    const ffmpegArgs: string[] = [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:a', 'libmp3lame',
      '-b:a', '320k',
      '-ar', '44100',
      '-vn',
    ];

    const tempFiles = [...files.map((f) => f.path), concatListPath];

    const result = await queueAudioJob({
      userId: req.user?.id,
      taskName: 'Merge Audio',
      originalName: files.map((f) => f.originalname).join(', '),
      outputFilename,
      outputPath,
      totalDuration,
      ffmpegArgs,
      tempFilesToClean: tempFiles,
    });

    res.json({ success: true, data: result });
  })
);

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. AUDIO METADATA / ID3 TAG EDITOR                                         */
/* ────────────────────────────────────────────────────────────────────────── */
router.post(
  '/metadata',
  authenticate,
  convertLimiter,
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const audioFile = files?.file?.[0];
    const coverFile = files?.cover?.[0];

    if (!audioFile) {
      res.status(400).json({ success: false, message: 'No audio file uploaded' });
      return;
    }

    const title = String(req.body.title || '').trim();
    const artist = String(req.body.artist || '').trim();
    const album = String(req.body.album || '').trim();
    const year = String(req.body.year || '').trim();
    const genre = String(req.body.genre || '').trim();

    const ext = (path.extname(audioFile.originalname) || '.mp3').toLowerCase();
    const outputFilename = `${sanitizeFilename(title || audioFile.originalname.replace(/\.[^.]+$/, ''))}${ext}`;
    const outputPath = path.join(outputDir, `${uuidv4()}${ext}`);
    const duration = await probeDuration(audioFile.path);

    const ffmpegArgs: string[] = ['-i', audioFile.path];
    if (coverFile) {
      ffmpegArgs.push('-i', coverFile.path, '-map', '0:a', '-map', '1:v');
    }

    if (title) ffmpegArgs.push('-metadata', `title=${title}`);
    if (artist) ffmpegArgs.push('-metadata', `artist=${artist}`);
    if (album) ffmpegArgs.push('-metadata', `album=${album}`);
    if (year) ffmpegArgs.push('-metadata', `date=${year}`);
    if (genre) ffmpegArgs.push('-metadata', `genre=${genre}`);

    if (coverFile) {
      ffmpegArgs.push('-c:a', 'copy', '-c:v', 'mjpeg', '-id3v2_version', '3', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
    } else {
      ffmpegArgs.push('-c', 'copy');
    }

    const tempFiles = [audioFile.path];
    if (coverFile) tempFiles.push(coverFile.path);

    const result = await queueAudioJob({
      userId: req.user?.id,
      taskName: 'Edit Metadata',
      originalName: audioFile.originalname,
      outputFilename,
      outputPath,
      totalDuration: duration || 1,
      ffmpegArgs,
      tempFilesToClean: tempFiles,
    });

    res.json({ success: true, data: result });
  })
);

/* ────────────────────────────────────────────────────────────────────────── */
/* QUEUE STATUS & JOB STATUS ENDPOINTS                                        */
/* ────────────────────────────────────────────────────────────────────────── */
router.get('/queue', (_req, res) => {
  res.json({
    success: true,
    data: conversionQueue.snapshot(),
  });
});

router.get(
  '/status/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const conversion = await Conversion.findById(req.params.id);
    if (!conversion) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    const id = conversion._id.toString();
    const queuePosition = conversionQueue.getQueuePosition(id);

    res.json({
      success: true,
      data: {
        jobId: id,
        status: queuePosition > 0 ? 'queued' : conversion.status,
        queuePosition,
        estimatedWaitSeconds: Math.max(3, queuePosition * 5),
        progress: conversion.progress,
        outputFilename: conversion.outputFilename,
        fileSize: conversion.fileSize,
        errorMessage: conversion.errorMessage,
        downloadUrl: conversion.status === 'completed' ? buildDownloadUrl(id) : null,
      },
    });
  })
);

export default router;

