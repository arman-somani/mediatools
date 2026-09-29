import { Router, Request, Response } from 'express';
import { metadataLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../utils/http';
import { assertSafeUrl, runWithClientLadder, isYouTubeUrl, ExtractError } from '../services/ytdlp';

const router = Router();

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

interface VideoFormat {
  formatId: string;
  quality: string;
  height: number | null;
  ext: string;
  hasAudio: boolean;
  size: number | null;
  vcodec: string;
  fps: number | null;
}

interface AudioFormat {
  formatId: string;
  quality: string;
  ext: string;
  size: number | null;
  acodec: string;
  abr: number | null;
}

/** yt-dlp's `-J` output, narrowed to the fields this route reads. */
interface RawFormat {
  format_id?: string;
  url?: string;
  ext?: string;
  protocol?: string;
  vcodec?: string;
  acodec?: string;
  height?: number;
  fps?: number;
  abr?: number;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `-J` prints a single JSON object, but warnings can precede it on stdout.
 * Scanning backwards for the last line that opens an object is more robust
 * than assuming the whole of stdout parses.
 */
function parseDumpJson(stdout: string): any {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const line = trimmed.split('\n').reverse().find(l => l.trim().startsWith('{'));
    if (!line) {
      throw new ExtractError('UNKNOWN', 'Could not read the video metadata.', true);
    }
    try {
      return JSON.parse(line);
    } catch {
      throw new ExtractError('UNKNOWN', 'Could not read the video metadata.', true);
    }
  }
}

function sizeOf(f: RawFormat): number | null {
  return f.filesize ?? f.filesize_approx ?? null;
}

function splitFormats(raw: RawFormat[]): { video: VideoFormat[]; audio: AudioFormat[] } {
  const video: VideoFormat[] = [];
  const audio: AudioFormat[] = [];

  for (const f of raw) {
    // `mhtml` is the storyboard pseudo-format; it is not playable media.
    if (!f.format_id || f.protocol === 'mhtml') continue;

    const hasVideo = Boolean(f.vcodec && f.vcodec !== 'none');
    const hasAudio = Boolean(f.acodec && f.acodec !== 'none');
    if (!hasVideo && !hasAudio) continue;

    if (hasVideo) {
      video.push({
        formatId: f.format_id,
        quality: f.height ? `${f.height}p` : (f.format_note || 'unknown'),
        height: f.height ?? null,
        ext: f.ext || 'unknown',
        hasAudio,
        size: sizeOf(f),
        vcodec: f.vcodec || 'unknown',
        fps: f.fps ?? null,
      });
    } else {
      audio.push({
        formatId: f.format_id,
        quality: f.abr ? `${Math.round(f.abr)}kbps` : (f.format_note || 'audio'),
        ext: f.ext || 'unknown',
        size: sizeOf(f),
        acodec: f.acodec || 'unknown',
        abr: f.abr ?? null,
      });
    }
  }

  // Highest quality first. The old comparator used parseInt on the *label*, so
  // a format noted "medium" sorted as 0 and "1080p60" and "1080p" tied
  // arbitrarily; comparing height then fps is deterministic.
  video.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.fps ?? 0) - (a.fps ?? 0));
  audio.sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));

  return { video, audio };
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/extractor/info?url=...
 *
 * Returns the available formats for a link, as a catalogue the client can pick
 * from before committing to a conversion.
 *
 * Two things this route used to do, both of which meant it could never have
 * worked on Render:
 *
 *   1. It forced every request through `socks5://127.0.0.1:1080` — a proxy on
 *      the container's own loopback address. Nothing listens there, so every
 *      attempt failed with a connection refusal, and it retried the identical
 *      dead proxy three times before reporting "Extractor failed across all
 *      attempts". This endpoint returned a 500 for every input, always.
 *   2. It passed `--no-check-certificate`, disabling TLS verification for all
 *      of yt-dlp's traffic.
 *
 * Signed media URLs are also no longer returned. YouTube binds them to the
 * requesting IP and expires them quickly, so handing them to a browser
 * produced a 403 that looked like our bug; the client sends `formatId` back to
 * the conversion endpoints instead.
 */
router.get('/info', metadataLimiter, asyncHandler(async (req: Request, res: Response) => {
  const url = assertSafeUrl(req.query.url);

  const { stdout, client } = await runWithClientLadder(
    ['-J'],
    [url],
    { timeoutMs: 45_000 }
  );

  const data = parseDumpJson(stdout);
  const formats = splitFormats(Array.isArray(data.formats) ? data.formats : []);

  if (formats.video.length === 0 && formats.audio.length === 0) {
    throw new ExtractError('FORMAT_UNAVAILABLE', 'No downloadable formats were found for this link.', false);
  }

  res.json({
    success: true,
    data: {
      title: data.title || 'Video',
      thumbnail: data.thumbnail || '',
      duration: Math.round(Number(data.duration) || 0),
      uploader: data.uploader || data.channel || '',
      extractor: data.extractor_key || data.extractor || '',
      client,
      ipBoundUrls: isYouTubeUrl(url),
      formats,
    },
  });
}));

export default router;
