import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import os from 'os';
import axios from 'axios';

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
app.use(cors({
  origin: (process.env.FRONTEND_URL || 'http://localhost:3000').trim(),
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



const start = async () => {
  await connectDB();

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

  // Self-ping job to prevent sleeping (every 10 minutes)
  const pingInterval = 10 * 60 * 1000;
  setInterval(async () => {
    try {
      // Use RENDER_EXTERNAL_URL if on Render, SELF_PING_URL if provided, otherwise localhost
      const url = process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL || `http://localhost:${PORT}/api/health`;
      console.log(`[Self-Ping] Keeping server awake by pinging ${url}...`);
      await axios.get(url);
    } catch (err: any) {
      console.error(`[Self-Ping] Error pinging server:`, err.message);
    }
  }, pingInterval);

  // Start the PO Token Microservice in the background
  console.log('[Microservice] Starting PO Token Provider on port 4416...');
  const potProviderProcess = spawn('node', ['build/main.js'], {
    cwd: path.join(__dirname, '..', 'bgutil-ytdlp-pot-provider', 'server'),
    stdio: 'ignore', // Let it run quietly in background
    detached: true
  });
  potProviderProcess.unref();

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 MediaTools Backend running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  });
};

start().catch(console.error);

export default app;
