import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { execFile } from 'child_process';
import { startCookieManagerLoop } from './utils/cookieManager';

// On Windows (local dev), inject the local yt-dlp binary dir into PATH
// On Linux/Render, yt-dlp and ffmpeg are already installed system-wide via Dockerfile
const isWin = os.platform() === 'win32';
if (isWin) {
  const ytDlpDir = path.join(process.cwd(), 'bin');
  process.env.PATH = `${ytDlpDir};${process.env.PATH}`;
}


import { connectDB } from './config/database';
import authRoutes from './routes/auth';
import convertRoutes from './routes/convert';
import userRoutes from './routes/user';
import contactRoutes from './routes/contact';
import feedbackRoutes from './routes/feedback';
import searchRoutes from './routes/search';
import extractorRoutes from './routes/extractor';
import adminRoutes from './routes/admin';
import directRoutes from './routes/direct';
import { errorHandler } from './middleware/errorHandler';
import { cleanupOldFiles } from './utils/cleanup';

const app = express();
app.set('trust proxy', 1); // Required for express-rate-limit behind a reverse proxy (like Render)

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://*", "http://*"],
      imgSrc: ["'self'", "data:", "https://*"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameSrc: ["'self'"]
    }
  },
  xFrameOptions: { action: "sameorigin" },
}));
// Allow a comma-separated list so the deployed frontend and localhost can
// both talk to this API. Previously this was a single origin defaulting to
// localhost:3000, so with FRONTEND_URL unset on Render every browser request
// from the real site was blocked by CORS.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Non-browser callers (curl, health checks, the self-ping) send no Origin.
    if (!origin) return callback(null, true);
    const normalised = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalised) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    console.warn(`[CORS] blocked origin: ${origin} (allowed: ${allowedOrigins.join(', ')})`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for downloads
app.use('/outputs', express.static(path.join(__dirname, '../outputs')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Routes
// Health check endpoint for Hugging Face
app.get('/', (req, res) => {
  res.status(200).send('MediaTools Backend is perfectly running! 🚀');
});

app.use('/api/auth', authRoutes);
app.use('/api/convert', convertRoutes);
app.use('/api/user', userRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/extractor', extractorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/direct', directRoutes);

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

/**
 * Log the resolved version of each external binary the downloader depends on.
 * A missing yt-dlp or ffmpeg previously showed up only as an opaque
 * "yt-dlp failed with code 1" per-job, with nothing at boot to point at it.
 */
const preflight = () => {
  const checks: Array<[string, string[]]> = [
    ['yt-dlp', ['--version']],
    ['ffmpeg', ['-version']],
    ['ffprobe', ['-version']],
  ];
  for (const [bin, args] of checks) {
    execFile(bin, args, { timeout: 15000 }, (err, stdout) => {
      if (err) {
        console.error(`[preflight] ✗ ${bin} NOT USABLE: ${err.message}`);
      } else {
        console.log(`[preflight] ✓ ${bin} ${String(stdout).split('\n')[0].trim()}`);
      }
    });
  }
};



const start = async () => {
  await connectDB();
  preflight();

  // Create required directories
  const fs = await import('fs');
  const dirs = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../outputs'),
  ];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Cleanup job - run every 30 minutes
  setInterval(cleanupOldFiles, 30 * 60 * 1000);

  // Start automatic YouTube cookie refresh (headless Chromium, every 30m)
  startCookieManagerLoop();

  // Self-ping job to prevent Render's free-tier spin-down (every 10 minutes).
  // RENDER_EXTERNAL_URL is a bare origin with no path, so join it to the real
  // health endpoint instead of relying on the catch-all "/" route.
  const pingInterval = 10 * 60 * 1000;
  const pingTarget = (() => {
    if (process.env.SELF_PING_URL) return process.env.SELF_PING_URL;
    if (process.env.RENDER_EXTERNAL_URL) {
      return `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/health`;
    }
    return `http://localhost:${PORT}/api/health`;
  })();
  setInterval(async () => {
    try {
      await axios.get(pingTarget, { timeout: 15000 });
    } catch (err: any) {
      console.error('[Self-Ping] failed:', err.message);
    }
  }, pingInterval);
  console.log(`[Self-Ping] keep-alive every 10m -> ${pingTarget}`);

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 MediaTools Backend running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  });
};

start().catch(console.error);

export default app;
