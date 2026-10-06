import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const convertLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 15, // Max 15 conversion requests per IP per 10 mins
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

/**
 * Metadata lookups are cheap for the caller and expensive for us: each one is
 * a yt-dlp process and a request against an IP YouTube is already watching.
 * These endpoints are unauthenticated, so without a limit a single client can
 * burn the instance's entire request budget and get the IP throttled for
 * everybody.
 */
export const metadataLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many lookups. Please wait a moment.' },
});

/** File serving is much cheaper than extraction, so the ceiling is higher. */
export const downloadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many download requests. Please wait a moment.' },
});

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
