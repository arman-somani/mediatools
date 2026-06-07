import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { connectDB } from './config/database';
import { generalLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth';
import convertRoutes from './routes/convert';
import userRoutes from './routes/user';
import contactRoutes from './routes/contact';
import { errorHandler } from './middleware/errorHandler';
import { cleanupOldFiles } from './utils/cleanup';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: (process.env.FRONTEND_URL || 'http://localhost:3000').trim(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for downloads
app.use('/outputs', express.static(path.join(__dirname, '../outputs')));

// Rate limiting
app.use('/api', generalLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/convert', convertRoutes);
app.use('/api/user', userRoutes);
app.use('/api/contact', contactRoutes);

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

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 MediaTools Backend running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  });
};

start().catch(console.error);

export default app;
