import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function getYtDlpPath(): string {
  const binPath = path.join(__dirname, '..', '..', 'bin', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  return fs.existsSync(binPath) ? binPath : 'yt-dlp';
}

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const videoUrl = req.body.url;
    if (!videoUrl) {
      res.status(400).json({ success: false, message: 'Video URL is required' });
      return;
    }

    const cleanUrl = String(videoUrl).trim();

    // Use best[ext=mp4] to guarantee a single pre-merged file
    const args = [
      '--get-url',
      '-f', 'best[ext=mp4]',
      '--no-warnings',
      '--no-playlist',
      cleanUrl
    ];

    const child = spawn(getYtDlpPath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });

    await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) resolve(true);
        else reject(new Error((stderr || stdout || `yt-dlp failed with code ${code}`).trim()));
      });
    });

    const urls = stdout.trim().split('\n').filter(line => line.startsWith('http'));
    if (urls.length === 0) {
      res.status(400).json({ success: false, message: 'Could not extract direct URL.' });
      return;
    }

    res.json({
      success: true,
      data: {
        directUrl: urls[0]
      }
    });

  } catch (error: any) {
    console.error('Direct download error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to extract direct URL' });
  }
});

export default router;
