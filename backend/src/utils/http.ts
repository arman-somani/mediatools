import { Request, Response, NextFunction, RequestHandler } from 'express';
import { validationResult } from 'express-validator';

/**
 * Express 4 does not forward rejected promises from async handlers to the
 * error middleware. Without this wrapper a single Mongo hiccup produced an
 * `unhandledRejection` and *no response at all* — the browser sat on an open
 * socket until it timed out, which is what made failures look like hangs.
 */
export function asyncHandler(
  fn: (req: any, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Returns true if it has already sent a 400. Several handlers declared
 * express-validator chains but never checked the result, so the validators
 * were decorative and raw body values reached Mongo queries.
 */
export function failedValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ success: false, errors: errors.array() });
  return true;
}

/**
 * Coerce an untrusted body value to a string, or return null.
 *
 * This is the specific defence against NoSQL operator injection: Express's
 * JSON body parser happily produces `{ token: { $gt: "" } }`, and Mongoose
 * will treat that object as a *query operator* rather than a value, so
 * `findOne({ resetPasswordToken: token })` matches the first document with any
 * live token. Forcing the value to a primitive string makes the query an
 * equality check again.
 */
export function asString(value: unknown, maxLength = 512): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

/** Normalise an email the same way express-validator's normalizeEmail() does. */
export function normaliseEmail(value: unknown): string | null {
  const raw = asString(value, 254);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return null;

  const [local, domain] = lower.split('@');
  // Gmail ignores dots and everything after a '+'. Register/login normalise,
  // so verify-email and forgot-password must normalise identically or a user
  // who typed "first.last@gmail.com" can never be found again.
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const stripped = local.split('+')[0].replace(/\./g, '');
    return `${stripped}@gmail.com`;
  }
  return lower;
}
