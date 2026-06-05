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
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE_MB || 500) * 1024 * 1024 },
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

/* ── MP4 TO MP3 ─────────────────────────────────────────── */
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
      if (!file)   { res.status(400).json({ success: false, message: 'No file uploaded' }); return; }

      const outputFilename = `${uuidv4()}.mp3`;
      const outputPath = path.join(outputDir, outputFilename);

      const conversion: any = await Conversion.create({
        userId,
        type: 'mp4',
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
              Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => {});
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
      console.error('MP4 error:', error);
      res.status(500).json({ success: false, message: error.message || 'Conversion failed' });
    }
  }
);

/* ── YOUTUBE TO MP3 ─────────────────────────────────────── */
router.post('/youtube', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const youtubeUrl = req.body.youtubeUrl || req.body.url;
    const quality = safeAudioQuality(req.body.quality);

    if (!youtubeUrl) {
      res.status(400).json({ success: false, message: 'YouTube URL is required' });
      return;
    }

    const cleanUrl = String(youtubeUrl).trim();

    // Always UUID on disk — avoids all Windows path/special-char issues
    const fileId = uuidv4();
    const diskFilename = `${fileId}.mp3`;
    const outputPath = path.join(outputDir, diskFilename);

    // Create record FIRST so polling can start immediately
    const conversion: any = await Conversion.create({
      userId: req.user?.id,
      type: 'youtube',
      status: 'processing',
      youtubeUrl: cleanUrl,
      youtubeTitle: 'Fetching title...',
      outputFilename: diskFilename,
      outputPath,
      outputUrl: `/outputs/${diskFilename}`,
      quality: quality as '128' | '192' | '320',
      progress: 0,
    });

    // ✅ Respond immediately — frontend gets jobId and starts polling
    res.json({
      success: true,
      message: 'YouTube conversion started',
      data: {
        jobId: conversion._id.toString(),
        conversionId: conversion._id.toString(),
      },
    });

    // ── Everything below runs in background after response is sent ──
    (async () => {
      try {
        // Step 1: Get title (fast metadata only — no video downloaded)
        let videoTitle = 'YouTube Audio';
        let thumbnail = '';
        try {
          const { stdout } = await execAsync(
            `yt-dlp --print title --print thumbnail --no-playlist "${cleanUrl}"`
          );
          const lines = stdout.trim().split('\n');
          videoTitle = (lines[0] || '').trim() || 'YouTube Audio';
          thumbnail  = (lines[1] || '').trim();
        } catch {
          // Title fetch failed — still convert with default name
        }

        const safeTitle = sanitizeFilename(videoTitle) || 'YouTube Audio';

        // Update DB with title so polling response shows the video name
        conversion.youtubeTitle    = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename  = `${safeTitle}.mp3`; // user sees this on download
        await conversion.save();

        // Step 2: Download + convert (disk path is always UUID — always safe)
        const ytQuality = quality === '320' ? '0' : quality === '192' ? '2' : '5';
        let cookiesPath = '';
        if (process.env.YOUTUBE_COOKIES) {
          cookiesPath = path.join(os.tmpdir(), 'youtube_cookies.txt');
          fs.writeFileSync(cookiesPath, process.env.YOUTUBE_COOKIES);
        }

        const args = ['-x', '--audio-format', 'mp3', '--audio-quality', ytQuality, '-o', outputPath, '--no-playlist'];
        if (cookiesPath) {
          args.push('--cookies', cookiesPath);
        }
        args.push(cleanUrl);

        const ytdlp = spawn('yt-dlp', args);
        
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
                Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => {});
              }
            }
          }
        });
        
        ytdlp.stderr.on('data', (data) => {
          console.error('[yt-dlp MP3 ERROR]:', data.toString());
        });

        await new Promise((resolve, reject) => {
          ytdlp.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error('yt-dlp failed with code ' + code));
          });
        });

        // Step 3: Mark complete
        conversion.status   = 'completed';
        conversion.progress = 100;
        conversion.fileSize = getFileSize(outputPath);
        await conversion.save();

      } catch (err: any) {
        console.error('YouTube background error:', err.message);
        try {
          conversion.status       = 'failed';
          conversion.errorMessage = err.message || 'Conversion failed';
          await conversion.save();
        } catch {}
      }
    })();

  } catch (error: any) {
    console.error('YouTube conversion error:', error);
    res.status(500).json({ success: false, message: error.message || 'YouTube conversion failed' });
  }
});

/* ── YOUTUBE TO MP4 ─────────────────────────────────────── */
router.post('/youtube-mp4', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const youtubeUrl = req.body.youtubeUrl || req.body.url;
    const videoQuality: string = (['360p', '480p', '720p', '1080p', '4K', '8K'].includes(req.body.videoQuality))
      ? req.body.videoQuality : '720p';

    if (!youtubeUrl) {
      res.status(400).json({ success: false, message: 'YouTube URL is required' });
      return;
    }

    const cleanUrl = String(youtubeUrl).trim();
    const fileId = uuidv4();
    const diskFilename = `${fileId}.mp4`;
    const outputPath = path.join(outputDir, diskFilename);

    // Map quality label to yt-dlp format filter
    const formatMap: Record<string, string> = {
      '360p':  'bestvideo[height<=360]+bestaudio/best[height<=360]/bestvideo+bestaudio/best',
      '480p':  'bestvideo[height<=480]+bestaudio/best[height<=480]/bestvideo+bestaudio/best',
      '720p':  'bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo+bestaudio/best',
      '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo+bestaudio/best',
      '4K':    'bestvideo[height<=2160]+bestaudio/best[height<=2160]/bestvideo+bestaudio/best',
      '8K':    'bestvideo[height<=4320]+bestaudio/best[height<=4320]/bestvideo+bestaudio/best',
    };
    const ytFormat = formatMap[videoQuality] || formatMap['720p'];

    const conversion: any = await Conversion.create({
      userId: req.user?.id,
      type: 'youtube-mp4',
      status: 'processing',
      youtubeUrl: cleanUrl,
      youtubeTitle: 'Fetching title...',
      outputFilename: diskFilename,
      outputPath,
      outputUrl: `/outputs/${diskFilename}`,
      quality: '192',         // audio quality within the mp4
      videoQuality: videoQuality as any,
      progress: 0,
    });

    // Respond immediately — frontend starts polling
    res.json({
      success: true,
      message: 'YouTube MP4 download started',
      data: {
        jobId: conversion._id.toString(),
        conversionId: conversion._id.toString(),
      },
    });

    // Background processing
    (async () => {
      try {
        // Step 1: Get metadata
        let videoTitle = 'YouTube Video';
        let thumbnail = '';
        try {
          const { stdout } = await execAsync(
            `yt-dlp --print title --print thumbnail --no-playlist "${cleanUrl}"`
          );
          const lines = stdout.trim().split('\n');
          videoTitle = (lines[0] || '').trim() || 'YouTube Video';
          thumbnail  = (lines[1] || '').trim();
        } catch { /* keep defaults */ }

        const safeTitle = sanitizeFilename(videoTitle) || 'YouTube Video';
        conversion.youtubeTitle     = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename   = `${safeTitle}.mp4`;
        await conversion.save();

        // Step 2: Download video + audio merged into mp4
        const ytdlp = spawn('yt-dlp', ['-f', ytFormat, '--merge-output-format', 'mp4', '-o', outputPath, '--no-playlist', cleanUrl]);
        
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
                Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => {});
              }
            }
          }
        });

        ytdlp.stderr.on('data', (data) => {
          console.error('[yt-dlp MP4 ERROR]:', data.toString());
        });

        await new Promise((resolve, reject) => {
          ytdlp.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error('yt-dlp failed with code ' + code));
          });
        });

        // Step 3: Mark complete
        conversion.status   = 'completed';
        conversion.progress = 100;
        conversion.fileSize = getFileSize(outputPath);
        await conversion.save();

      } catch (err: any) {
        console.error('YouTube MP4 background error:', err.message);
        try {
          conversion.status       = 'failed';
          conversion.errorMessage = err.message || 'Download failed';
          await conversion.save();
        } catch {}
      }
    })();

  } catch (error: any) {
    console.error('YouTube MP4 route error:', error);
    res.status(500).json({ success: false, message: error.message || 'YouTube MP4 download failed' });
  }
});

/* ── UNIVERSAL VIDEO METADATA ──────────────────────────── */
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

/* ── UNIVERSAL VIDEO DOWNLOADER ────────────────────────── */
router.post('/universal', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const videoUrl = req.body.url;
    const videoQuality: string = (['360p', '480p', '720p', '1080p', '4K', '8K'].includes(req.body.videoQuality))
      ? req.body.videoQuality : '720p';

    if (!videoUrl) {
      res.status(400).json({ success: false, message: 'Video URL is required' });
      return;
    }

    const cleanUrl = String(videoUrl).trim();
    const fileId = uuidv4();
    const diskFilename = `${fileId}.mp4`;
    const outputPath = path.join(outputDir, diskFilename);

    // Map quality label to yt-dlp format filter
    const formatMap: Record<string, string> = {
      '360p':  'bestvideo[height<=360]+bestaudio/best[height<=360]/bestvideo+bestaudio/best',
      '480p':  'bestvideo[height<=480]+bestaudio/best[height<=480]/bestvideo+bestaudio/best',
      '720p':  'bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo+bestaudio/best',
      '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/bestvideo+bestaudio/best',
      '4K':    'bestvideo[height<=2160]+bestaudio/best[height<=2160]/bestvideo+bestaudio/best',
      '8K':    'bestvideo[height<=4320]+bestaudio/best[height<=4320]/bestvideo+bestaudio/best',
    };
    const ytFormat = formatMap[videoQuality] || formatMap['720p'];

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

    // Respond immediately — frontend starts polling
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
          thumbnail  = (lines[1] || '').trim();
        } catch { /* keep defaults */ }

        const safeTitle = sanitizeFilename(videoTitle) || 'Downloaded Video';
        conversion.youtubeTitle     = videoTitle;
        conversion.youtubeThumbnail = thumbnail;
        conversion.outputFilename   = `${safeTitle}.mp4`;
        await conversion.save();

        // Step 2: Download video + audio merged into mp4
        const ytdlp = spawn('yt-dlp', ['-f', ytFormat, '--merge-output-format', 'mp4', '-o', outputPath, '--no-playlist', cleanUrl]);
        
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
                Conversion.findByIdAndUpdate(conversion._id, { progress }).catch(() => {});
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

        // Step 3: Mark complete
        conversion.status   = 'completed';
        conversion.progress = 100;
        conversion.fileSize = getFileSize(outputPath);
        await conversion.save();

      } catch (err: any) {
        console.error('Universal video background error:', err.message);
        try {
          conversion.status       = 'failed';
          conversion.errorMessage = err.message || 'Download failed';
          await conversion.save();
        } catch {}
      }
    })();

  } catch (error: any) {
    console.error('Universal route error:', error);
    res.status(500).json({ success: false, message: error.message || 'Universal video download failed' });
  }
});

/* ── YOUTUBE PLAYLIST METADATA ────────────────────────── */
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

/* ── GET STATUS (frontend polls this) ───────────────────── */
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
        jobId:            conversion._id.toString(),
        status:           conversion.status,
        progress:         conversion.progress,
        outputFilename:   conversion.outputFilename,
        outputUrl:        conversion.outputUrl,
        fileSize:         conversion.fileSize,
        youtubeTitle:     conversion.youtubeTitle,
        youtubeThumbnail: conversion.youtubeThumbnail,
        errorMessage:     conversion.errorMessage,
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
    if (!conversion || !conversion.outputPath) {
      res.status(404).json({ success: false, message: 'File not found' }); return;
    }
    if (!fs.existsSync(conversion.outputPath)) {
      res.status(404).json({ success: false, message: 'File expired or deleted' }); return;
    }
    conversion.downloadCount += 1;
    await conversion.save();
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

/* ── PUBLIC FILE (legacy alias) ─────────────────────────── */
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