import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Signed, expiring download links.
 *
 * The problem this solves: a browser downloading a file navigates to the URL,
 * and a navigation cannot carry an `Authorization` header. So the download
 * endpoints could not simply be put behind `authenticate` — which is why they
 * were left wide open, and why `GET /api/convert/download/<id>` served any
 * user's file to anybody holding an id.
 *
 * Mongo ObjectIds are not secrets. They embed a 4-byte timestamp, a per-process
 * identifier that is constant for the life of the instance, and a counter that
 * increments by one per document. Given any single id from your own job, the
 * ids of documents created around it are largely derivable — so "unguessable
 * id" was never an access control.
 *
 * Instead the status endpoint, which *is* authenticated, hands back a URL
 * carrying an HMAC over the conversion id and an expiry. The download endpoint
 * verifies that signature, so the capability to download is explicitly granted,
 * scoped to one file, and dies on its own.
 */

/**
 * Derived from JWT_SECRET rather than reusing it, so a leaked download link
 * reveals nothing about the token-signing key.
 */
const SIGNING_KEY = crypto
  .createHmac('sha256', env.jwtSecret)
  .update('download-link-derivation-v1')
  .digest();

/** Long enough to start a large download on a slow connection, short enough to expire. */
const DEFAULT_TTL_SECONDS = 6 * 60 * 60;

function sign(resourceId: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', SIGNING_KEY)
    .update(`${resourceId}:${expiresAt}`)
    .digest('base64url');
}

/** Returns an opaque `<expiry>.<signature>` token for one resource. */
export function issueDownloadToken(resourceId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${expiresAt}.${sign(resourceId, expiresAt)}`;
}

export type TokenVerdict = 'valid' | 'expired' | 'invalid';

/** Verifies a token against a resource id, in constant time. */
export function verifyDownloadToken(resourceId: string, token: unknown): TokenVerdict {
  if (typeof token !== 'string' || token.length > 256) return 'invalid';

  const separator = token.indexOf('.');
  if (separator <= 0) return 'invalid';

  const expiresAt = Number(token.slice(0, separator));
  const provided = token.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt) || !provided) return 'invalid';

  const expected = sign(resourceId, expiresAt);

  // Compare before checking expiry so a caller cannot distinguish "wrong
  // signature" from "right signature, expired" by response timing.
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  const matches =
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!matches) return 'invalid';
  if (expiresAt < Math.floor(Date.now() / 1000)) return 'expired';
  return 'valid';
}

/** Builds the relative download path the frontend should navigate to. */
export function buildDownloadUrl(conversionId: string, ttlSeconds?: number): string {
  return `/api/convert/download/${conversionId}?t=${issueDownloadToken(conversionId, ttlSeconds)}`;
}
