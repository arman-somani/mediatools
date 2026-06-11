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
  return null;
}

Platform.shim.eval = (script: any) => {
  const code = typeof script === 'string' ? script : script.output;
  return vm.runInNewContext('new Function(' + JSON.stringify(code) + ')()');
};

function getRapidApiKey(): string {
  const keysStr = process.env.RAPIDAPI_KEYS || process.env.RAPIDAPI_KEY || '208e9bff95msh90b82e1f2353e90p17b16ejsn23f1054a290e';
  const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
  return keys[Math.floor(Math.random() * keys.length)];
}
const YT_MEDIA_HOST = 'cloud-api-hub-youtube-downloader.p.rapidapi.com';
const YT_ALTERNATIVE_HOST = 'youtube-media-downloader.p.rapidapi.com';
const YT_POLLING_HOST = 'youtube-video-fast-downloader-24-7.p.rapidapi.com';
const YT_QUICK_HOST = 'youtube-quick-video-downloader.p.rapidapi.com';
const YT_ALL_MEDIA_HOST = 'all-media-downloader4.p.rapidapi.com';
const YT_CDN_HOST = 'youtube-mp4-mp3-m4a-cdn.p.rapidapi.com';



        if (!audioDownloaded) throw new Error('All download methods failed for audio');

        const downloadedFile = findDownloadedFile(fileId) || diskFilename;
        conversion.outputPath = path.join(outputDir, downloadedFile);
        conversion.outputUrl = `/outputs/${downloadedFile}`;
        requireWrittenFile(conversion.outputPath, 'Audio download');
        conversion.fileSize = getFileSize(conversion.outputPath);
        
        try {
          console.log(`Uploading ${conversion.outputPath} to GoFile...`);
          const goFileUrl = await uploadToGoFile(conversion.outputPath);
          conversion.outputUrl = goFileUrl;
          if (fs.existsSync(conversion.outputPath)) fs.unlinkSync(conversion.outputPath); // Delete local file
        } catch (uploadError) {
          console.error('GoFile upload failed:', uploadError);
        }

        conversion.status = 'completed';
        conversion.progress = 100;
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



          if (!videoDownloaded) throw new Error('All download methods failed for video');

          // Find the actual downloaded file since the extension could be .webm, .mkv, or .mp4
          const downloadedFile = findDownloadedFile(fileId);
          
          if (downloadedFile) {
            const actualExt = path.extname(downloadedFile);
            conversion.outputPath = path.join(outputDir, downloadedFile);
            conversion.outputFilename = `${safeTitle}${actualExt}`;
          }
          requireWrittenFile(conversion.outputPath, 'Video download');

          // Step 3: Mark complete
          conversion.fileSize = getFileSize(conversion.outputPath);
          conversion.outputUrl = `/outputs/${path.basename(conversion.outputPath)}`;
          
          try {
            console.log(`Uploading ${conversion.outputPath} to GoFile...`);
            const goFileUrl = await uploadToGoFile(conversion.outputPath);
            conversion.outputUrl = goFileUrl;
            if (fs.existsSync(conversion.outputPath)) fs.unlinkSync(conversion.outputPath); // Delete local file
          } catch (uploadError) {
            console.error('GoFile upload failed:', uploadError);
          }

          conversion.status = 'completed';
          conversion.progress = 100;
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

    // Run yt-dlp to print title, thumbnail, resolution, filesize, and direct url
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
      console.warn('Universal metadata native fetch failed, trying free proxies...');
      let success = false;
      const freeProxies = await getRandomFreeProxies(2);
      for (const freeProxy of freeProxies) {
        try {
          const res = await runYtDlp(args, freeProxy);
          stdout = res.stdout;
          success = true;
          break;
        } catch (err) {}
      }
      if (!success) {
        console.warn('Free proxies failed, trying ScraperAPI...');
        const res = await runYtDlp(args, true);
        stdout = res.stdout;
      }
    }

    const lines = stdout.trim().split('\n');
    const title = (lines[0] || '').trim() || 'Downloaded Video';
    let thumbnail = (lines[1] || '').trim();
    if (thumbnail === 'NA') thumbnail = '';
    const resolution = (lines[2] || '').trim() || 'Best Available';
    let sizeBytes = parseInt((lines[3] || '').trim(), 10);
    const directVideoUrl = (lines[4] || '').trim();

    if (isNaN(sizeBytes)) sizeBytes = 0;

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
          let stdout = '';
          try {
            const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--no-playlist', cleanUrl], false);
            stdout = res.stdout;
          } catch (e) {
            let success = false;
            const freeProxies = await getRandomFreeProxies(2);
            for (const freeProxy of freeProxies) {
              try {
                const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--no-playlist', cleanUrl], freeProxy);
                stdout = res.stdout;
                success = true;
                break;
              } catch (err) {}
            }
            if (!success) {
              const res = await runYtDlp(['--print', 'title', '--print', 'thumbnail', '--no-playlist', cleanUrl], true);
              stdout = res.stdout;
            }
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
        
        for (const useProxy of [false, true]) {
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
        
        try {
          console.log(`Uploading ${conversion.outputPath} to GoFile...`);
          const goFileUrl = await uploadToGoFile(conversion.outputPath);
          conversion.outputUrl = goFileUrl;
          if (fs.existsSync(conversion.outputPath)) fs.unlinkSync(conversion.outputPath); // Delete local file
        } catch (uploadError) {
          console.error('GoFile upload failed:', uploadError);
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
      const res = await runYtDlp(['--flat-playlist', '--dump-json', cleanUrl], false);
      stdout = res.stdout;
    } catch (e) {
      console.warn('Playlist native fetch failed, trying free proxies...');
      let success = false;
      const freeProxies = await getRandomFreeProxies(2);
      for (const freeProxy of freeProxies) {
        try {
          const res = await runYtDlp(['--flat-playlist', '--dump-json', cleanUrl], freeProxy);
          stdout = res.stdout;
          success = true;
          break;
        } catch (err) {}
      }
      if (!success) {
        console.warn('Free proxies failed, trying ScraperAPI...');
        const res = await runYtDlp(['--flat-playlist', '--dump-json', cleanUrl], true);
        stdout = res.stdout;
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



