import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { metadataLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../utils/http';
import { assertSafeUrl, runWithClientLadder, isYouTubeUrl } from '../services/ytdlp';

const router = Router();

/**
 * POST /api/direct — resolves a playable media URL without proxying the bytes.
 *
 * Worth being clear about the limitation, because it is not obvious and it is
 * the reason this endpoint appears flaky: YouTube's `googlevideo.com` URLs are
 * bound to the IP that requested them and expire within a few hours. A URL
 * resolved here is resolved from the *server's* address, so a browser on a
 * different address will usually get a 403 when it follows the link. That is
 * upstream behaviour, not a bug we can fix, so the response says so rather
 * than presenting the URL as a reliable download link.
 *
 * For non-YouTube hosts, which mostly serve plain unsigned files, it works as
 * expected — that is where this endpoint earns its keep.
 */
router.post('/', authenticate, metadataLimiter, asyncHandler(async (req: AuthRequest, res: Response) => {
  const url = assertSafeUrl(req.body.url);

  const { stdout, client } = await runWithClientLadder(
    ['--print', '%(urls)s', '-f', 'best[ext=mp4]/best'],
    [url],
    { timeoutMs: 45_000 }
  );

  const urls = stdout.trim().split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
  if (urls.length === 0) {
    res.status(422).json({
      success: false,
      code: 'FORMAT_UNAVAILABLE',
      message: 'No single-file stream is available for this link.',
    });
    return;
  }

  const ipBound = isYouTubeUrl(url);
  res.json({
    success: true,
    data: {
      directUrl: urls[0],
      client,
      ipBound,
      ...(ipBound && {
        note: 'YouTube ties this URL to the requesting IP address and expires it within a few hours. '
          + 'Use the standard conversion endpoints for a link you can share or open in a browser.',
      }),
    },
  });
}));

export default router;
