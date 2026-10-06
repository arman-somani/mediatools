import { Request, Response, NextFunction } from 'express';
import { ExtractError, ExtractFailure } from '../services/ytdlp';
import { env } from '../config/env';

/**
 * Maps each extraction failure onto an HTTP status.
 *
 * The distinction that matters to a caller is whether waiting or changing the
 * request could help:
 *   400 — the request itself is wrong (bad or unsupported link)
 *   403 — the content exists but this server may not have it
 *   404 — the content is gone
 *   422 — the link is fine but the requested output is impossible
 *   429 — YouTube is throttling this server; retrying soon will not help
 *   502 — an upstream problem on our side of the fence
 *   504 — we gave up waiting
 *
 * Previously every one of these came back as a flat `500 {message: <raw
 * yt-dlp stderr>}`, so the frontend could not distinguish "this video is
 * private" from "our binary is missing" and showed the same generic retry
 * prompt for both.
 */
const STATUS_BY_CODE: Record<ExtractFailure, number> = {
  BOT_CHECK: 429,
  RATE_LIMITED: 429,
  AGE_RESTRICTED: 403,
  PRIVATE: 403,
  MEMBERS_ONLY: 403,
  GEO_BLOCKED: 403,
  UNAVAILABLE: 404,
  NOT_YET_AVAILABLE: 409,
  LIVE_STREAM: 422,
  UNSUPPORTED_URL: 400,
  FORMAT_UNAVAILABLE: 422,
  TOO_LONG: 413,
  NETWORK: 502,
  TIMEOUT: 504,
  UNKNOWN: 502,
};

export const errorHandler = (
  err: Error & { status?: number; statusCode?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Express cannot send a second set of headers. Without this guard, an error
  // thrown after a streaming response had begun produced an unhandled
  // ERR_HTTP_HEADERS_SENT that took the whole process down.
  if (res.headersSent) {
    console.error(`[error] after response started on ${req.method} ${req.path}: ${err.message}`);
    res.end();
    return;
  }

  if (err instanceof ExtractError) {
    const status = STATUS_BY_CODE[err.code] ?? 502;
    // `warn` not `error`: a private video is a normal outcome, not a fault.
    console.warn(`[extract] ${err.code} on ${req.method} ${req.path}: ${err.message}`);
    res.status(status).json({
      success: false,
      code: err.code,
      retriable: err.retriable,
      message: err.message,
    });
    return;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      success: false,
      code: 'FILE_TOO_LARGE',
      message: `That file is too large. The maximum is ${env.maxFileSizeMb}MB.`,
    });
    return;
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ success: false, code: 'BAD_UPLOAD', message: 'Unexpected file field.' });
    return;
  }

  // Mongoose validation and malformed ObjectIds are caller errors.
  if (err.name === 'ValidationError') {
    res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: err.message });
    return;
  }
  if (err.name === 'CastError') {
    res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid identifier.' });
    return;
  }
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    res.status(409).json({ success: false, code: 'DUPLICATE', message: 'That record already exists.' });
    return;
  }

  // A body-parser failure is a 400, not a 500.
  if (err.name === 'SyntaxError' && 'body' in err) {
    res.status(400).json({ success: false, code: 'BAD_JSON', message: 'Request body is not valid JSON.' });
    return;
  }

  const status = err.status || err.statusCode || 500;

  /**
   * Errors we raise on purpose, whose message is written for the user and
   * contains nothing internal. Without this allow-list the blanket 5xx rule
   * below replaced deliberately helpful text — "the server is already working
   * through N downloads, try again shortly" — with a generic apology that tells
   * the user nothing about what to do next.
   */
  const SAFE_CODES = new Set(['QUEUE_FULL', 'SERVICE_UNAVAILABLE', 'UPSTREAM_UNAVAILABLE']);
  const isIntentional = Boolean(err.code && SAFE_CODES.has(err.code));

  // Deliberately generic above 499 otherwise. The old handler echoed
  // `err.message` for every 500, which leaked file paths, Mongo connection
  // strings and raw stderr to anyone who could trigger an exception.
  const clientMessage = status >= 500 && !isIntentional
    ? 'Something went wrong on our side. Please try again.'
    : err.message;

  console.error(`[error] ${status} on ${req.method} ${req.path}: ${err.message}`);
  if (status >= 500 && !isIntentional && err.stack) console.error(err.stack);

  // Tells well-behaved clients when to come back instead of retrying immediately
  // and deepening the backlog that caused the rejection.
  if (status === 503 || status === 429) {
    res.setHeader('Retry-After', '120');
  }

  res.status(status).json({
    success: false,
    code: err.code && isIntentional ? err.code : 'INTERNAL_ERROR',
    message: clientMessage,
    ...(env.isProduction ? {} : { detail: err.message, stack: err.stack }),
  });
};
