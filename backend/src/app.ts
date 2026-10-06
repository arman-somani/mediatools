import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import os from 'os';
import fs from 'fs';
import axios from 'axios';
import mongoose from 'mongoose';
import { execFile } from 'child_process';

// Local development on Windows keeps yt-dlp.exe in backend/bin. In the Docker
// image yt-dlp and ffmpeg are installed system-wide, so this is a no-op there.
if (os.platform() === 'win32') {
  process.env.PATH = `${path.join(process.cwd(), 'bin')};${process.env.PATH}`;
}

// Imported after the PATH tweak, and before anything else, because it throws
// on a missing secret — the process must die at boot rather than serve traffic
// signed with a default key.
import { env } from './config/env';

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
import { verifyMailTransport } from './utils/email';
import { probePotProvider, getPotMode, currentLadder } from './services/ytdlp';
import { conversionQueue } from './utils/queue';

const app = express();

// Render terminates TLS at its edge and forwards one X-Forwarded-For hop.
// express-rate-limit needs this to key on the real client IP; without it every
// request appears to come from the proxy and one visitor exhausts everyone's
// quota.
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // This process serves JSON and media files, never HTML that executes
  // scripts, so the script/style directives that used to be here (complete
  // with 'unsafe-eval') protected nothing and only advertised intent.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      sandbox: ['allow-downloads'],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
}));

app.use(cors({
  origin: (origin, callback) => {
    // Non-browser callers (curl, Render health checks, the extension) send no
    // Origin header at all and must not be rejected.
    if (!origin) return callback(null, true);
    const normalised = origin.replace(/\/$/, '');
    if (env.frontendOrigins.includes('*') || env.frontendOrigins.includes(normalised)) {
      return callback(null, true);
    }
    console.warn(`[cors] blocked ${origin} (allowed: ${env.frontendOrigins.join(', ')})`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// 10mb was the previous ceiling on a JSON body. Every endpoint here accepts a
// URL and a few option strings; 64kb is generous and stops a single request
// from claiming an eighth of the instance's heap.
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

/* -------------------------------------------------------------------------- */
/* Directories                                                                */
/* -------------------------------------------------------------------------- */

const OUTPUT_DIR = path.join(__dirname, '../outputs');
const UPLOAD_DIR = path.join(__dirname, '../uploads');

for (const dir of [OUTPUT_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// `index: false` and `dotfiles: 'deny'` stop this from listing the directory
// or serving anything that starts with a dot.
app.use('/outputs', express.static(OUTPUT_DIR, {
  index: false,
  dotfiles: 'deny',
  maxAge: '1h',
}));

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

/** Set by preflight() once each external binary has been probed. */
const binaries: Record<string, string | null> = { 'yt-dlp': null, ffmpeg: null, ffprobe: null };

/**
 * Liveness. Deliberately cheap and always 200 while the process is up, because
 * Render restarts the service when its health check fails and a transient
 * Mongo blip is not a reason to reboot.
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

/** Readiness. Reports what is actually usable, for debugging a deploy. */
app.get('/api/health/ready', (_req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  const missing = Object.entries(binaries).filter(([, v]) => v === null).map(([k]) => k);
  const ready = dbState === 1 && missing.length === 0;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    database: dbState === 1 ? 'connected' : 'disconnected',
    binaries,
    mail: env.mail.configured ? 'configured' : 'disabled',
    proxy: env.youtube.proxyUrl ? 'configured' : 'none',
    cookies: env.youtube.cookieFile || env.youtube.cookiesB64 ? 'configured' : 'none',
    // The two fields worth looking at first when YouTube extraction starts
    // failing: how tokens are being obtained, and which clients that leaves
    // available to try.
    potTokens: getPotMode(),
    extractionClients: currentLadder(),
    // Conversions run one at a time on purpose; see utils/queue.ts.
    queue: { waiting: conversionQueue.depth, busy: conversionQueue.busy },
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    ...(missing.length ? { missing } : {}),
  });
});

app.get('/', (_req, res) => {
  res.type('text/plain').send('MediaTools API. See /api/health.');
});

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

app.use('/api/auth', authRoutes);
app.use('/api/convert', convertRoutes);
app.use('/api/user', userRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/extractor', extractorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/direct', directRoutes);

// A JSON 404 for unmatched API paths. Without this, a typo'd endpoint fell
// through to Express's HTML error page, which the frontend's axios layer
// reported as an unhelpful JSON parse failure.
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'No such endpoint.' });
});

app.use(errorHandler);

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Probes each external binary once at boot and records its version.
 *
 * A missing yt-dlp or ffmpeg used to surface only as a per-job
 * "yt-dlp failed with code 1", with nothing at startup pointing at the real
 * cause. Now it is visible in the boot log and on /api/health/ready.
 */
function preflight(): void {
  const checks: Array<[string, string[]]> = [
    ['yt-dlp', ['--version']],
    ['ffmpeg', ['-version']],
    ['ffprobe', ['-version']],
  ];
  for (const [bin, args] of checks) {
    execFile(bin, args, { timeout: 20_000 }, (err, stdout) => {
      if (err) {
        binaries[bin] = null;
        console.error(`[preflight] ${bin} is NOT usable: ${err.message}`);
      } else {
        const version = String(stdout).split('\n')[0].trim();
        binaries[bin] = version;
        console.log(`[preflight] ${bin} ${version}`);
      }
    });
  }
}

/**
 * Keeps the instance warm on Render's free tier, when explicitly enabled.
 *
 * Off by default, and that is the correct default. The free plan allows 750
 * instance-hours per month; a month is ~730 hours, so pinging around the clock
 * consumes essentially the entire allowance and leaves nothing for any other
 * free service on the account. It also only works while the instance happens
 * to be awake — once Render has spun the service down, no timer inside it is
 * running to wake it up, so this cannot recover from a spin-down, only delay
 * the first one. Set SELF_PING=true if you have decided that trade is worth it.
 */
function startSelfPing(port: number): NodeJS.Timeout | null {
  if ((process.env.SELF_PING || '').toLowerCase() !== 'true') {
    console.log('[self-ping] disabled (set SELF_PING=true to keep the free instance warm)');
    return null;
  }

  const target = process.env.SELF_PING_URL
    || (process.env.RENDER_EXTERNAL_URL
      ? `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/health`
      : `http://127.0.0.1:${port}/api/health`);

  console.log(`[self-ping] every 10m -> ${target}`);
  const timer = setInterval(() => {
    axios.get(target, { timeout: 15_000 })
      .catch((err: any) => console.warn(`[self-ping] failed: ${err.message}`));
  }, 10 * 60 * 1000);

  timer.unref();
  return timer;
}

async function start(): Promise<void> {
  await connectDB();
  preflight();
  void verifyMailTransport();

  // The sidecar is started by start.sh, which waits for it before launching
  // this process, so the first probe normally succeeds immediately. Re-probed
  // on a timer because the provider can die (or be OOM-killed) later, and a
  // ladder that keeps offering web clients after that produces failures that
  // look exactly like a YouTube block.
  void probePotProvider().then(ready => {
    console.log(`[boot] PO token source: ${getPotMode()}`);
    console.log(`[boot] extraction clients: ${currentLadder().join(' -> ')}`);
    if (!ready) {
      console.warn('[boot] no PO token source available; the web clients are '
        + 'excluded from the ladder and only tokenless clients will be tried');
    }
  });
  const potTimer = setInterval(() => void probePotProvider(), 5 * 60 * 1000);
  potTimer.unref();

  const cleanupTimer = setInterval(cleanupOldFiles, 30 * 60 * 1000);
  cleanupTimer.unref();
  void cleanupOldFiles();

  const port = env.port;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[boot] MediaTools API listening on ${port} (${env.nodeEnv})`);
  });

  // Above Node's 120s default, so a slow client on a large file is not cut off
  // mid-download, but still bounded.
  server.headersTimeout = 70_000;
  server.requestTimeout = 0; // downloads stream for as long as they need
  server.keepAliveTimeout = 65_000;

  startSelfPing(port);

  /**
   * Render sends SIGTERM and waits before SIGKILL on every deploy and scale
   * event. Without this the process died instantly, cutting active downloads
   * off mid-stream and leaving their Conversion documents stuck on
   * "processing" forever — which is exactly the state that made the site look
   * like it hung rather than failed.
   */
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received, draining connections`);

    const force = setTimeout(() => {
      console.error('[shutdown] drain timed out, exiting');
      process.exit(1);
    }, 25_000);
    force.unref();

    server.close(async () => {
      clearInterval(cleanupTimer);
      try {
        await mongoose.connection.close();
      } catch {
        // Already closed; nothing useful to do here.
      }
      clearTimeout(force);
      console.log('[shutdown] clean exit');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // An unhandled rejection anywhere in a background download job would
  // otherwise terminate the process on Node 20 with no indication of where it
  // came from.
  process.on('unhandledRejection', reason => {
    console.error('[fatal] unhandled rejection:', reason);
  });
  process.on('uncaughtException', error => {
    console.error('[fatal] uncaught exception:', error);
    shutdown('uncaughtException');
  });
}

start().catch(error => {
  console.error('[boot] startup failed:', error);
  process.exit(1);
});

export default app;
