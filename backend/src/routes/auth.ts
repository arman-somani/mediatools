import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body } from 'express-validator';
import axios from 'axios';
import { User } from '../models/User';
import { authLimiter } from '../middleware/rateLimiter';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { env } from '../config/env';
import { asyncHandler, failedValidation, asString, normaliseEmail } from '../utils/http';

const router = Router();

/** Only Gmail is accepted, per the product rule enforced on every entry point. */
const GMAIL_ONLY_MESSAGE =
  'Only @gmail.com addresses are accepted. Institutional and temporary mailboxes are not supported.';

function isGmail(email: string): boolean {
  return email.endsWith('@gmail.com');
}

const generateTokens = (userId: string, email: string, role: string) => {
  const accessToken = jwt.sign(
    { id: userId, email, role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as jwt.SignOptions
  );
  const refreshToken = jwt.sign(
    { id: userId, type: 'refresh' },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn } as jwt.SignOptions
  );
  return { accessToken, refreshToken };
};

/** The shape the frontend expects under `data.user` on every auth response. */
function publicUser(user: any) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isPremium: user.isPremium,
    subscriptionType: user.subscriptionType,
  };
}

/** Reset tokens are stored hashed so a database read cannot be replayed. */
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Grants the admin role to ADMIN_EMAIL, and only on an account that has
 * already proven ownership by authenticating normally.
 *
 * This replaces a hardcoded `email === '...' && password === '...'` block that
 * shipped a real password in the repository and re-granted admin on every
 * login even after the account had been deliberately demoted.
 */
async function applyAdminPromotion(user: any): Promise<void> {
  if (!env.adminEmail || user.email !== env.adminEmail) return;
  if (user.role === 'admin') return;
  user.role = 'admin';
  await user.save();
  console.log(`[auth] promoted ${user.email} to admin (matches ADMIN_EMAIL)`);
}

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (failedValidation(req, res)) return;

    const email = normaliseEmail(req.body.email);
    const name = asString(req.body.name, 100);
    const password = asString(req.body.password, 200);

    if (!email || !name || !password) {
      res.status(400).json({ success: false, message: 'Name, email and password are required' });
      return;
    }
    if (!isGmail(email)) {
      res.status(400).json({ success: false, message: GMAIL_ONLY_MESSAGE });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    // crypto.randomInt, not Math.random — the latter is a predictable PRNG and
    // this code is the only thing standing between a stranger and the account.
    const verificationCode = crypto.randomInt(100000, 1000000).toString();

    await User.create({
      name,
      email,
      password,
      isEmailVerified: false,
      emailVerificationToken: verificationCode,
      emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      emailVerificationAttempts: 0,
    });

    // Awaited, not fire-and-forget: if the mail cannot be sent the user must
    // be told, rather than being asked to check an inbox nothing will arrive in.
    const delivered = await sendVerificationEmail(email, name, verificationCode);
    if (!delivered) {
      res.status(502).json({
        success: false,
        message: 'Account created, but the verification email could not be sent. Please use "Resend code".',
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Check your email for the verification code.',
      data: { email },
    });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    if (failedValidation(req, res)) return;

    const email = normaliseEmail(req.body.email);
    const password = asString(req.body.password, 200);

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }
    if (!isGmail(email)) {
      res.status(400).json({ success: false, message: GMAIL_ONLY_MESSAGE });
      return;
    }

    const user = await User.findOne({ email }).select('+password');

    // One message for "no such user" and "wrong password" so the endpoint
    // cannot be used to enumerate which addresses are registered.
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ success: false, message: 'Your account has been suspended.' });
      return;
    }
    if (!user.isEmailVerified) {
      res.status(403).json({
        success: false,
        message: 'Please verify your email address to log in',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    await applyAdminPromotion(user);

    const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.email, user.role);
    res.json({ success: true, data: { accessToken, refreshToken, user: publicUser(user) } });
  })
);

// POST /api/auth/google
router.post(
  '/google',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const googleAccessToken = asString(req.body.accessToken, 4096);
    if (!googleAccessToken) {
      res.status(400).json({ success: false, message: 'Google access token required' });
      return;
    }

    let profile: { sub?: string; email?: string; name?: string; picture?: string };
    try {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
        timeout: 10000,
      });
      profile = data;
    } catch (error: any) {
      console.error('[auth] Google token exchange failed:', error?.response?.status || error?.message);
      res.status(401).json({ success: false, message: 'Invalid Google token' });
      return;
    }

    const email = normaliseEmail(profile.email);
    const googleId = asString(profile.sub, 64);
    if (!email || !googleId) {
      res.status(401).json({ success: false, message: 'Google account did not return a usable profile' });
      return;
    }
    if (!isGmail(email)) {
      res.status(400).json({ success: false, message: GMAIL_ONLY_MESSAGE });
      return;
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = await User.create({
        name: asString(profile.name, 100) || email.split('@')[0],
        email,
        googleId,
        avatar: asString(profile.picture, 512) || undefined,
        isEmailVerified: true,
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      const avatar = asString(profile.picture, 512);
      if (avatar) user.avatar = avatar;
      await user.save();
    }

    if (user.isBanned) {
      res.status(403).json({ success: false, message: 'Your account has been suspended.' });
      return;
    }

    await applyAdminPromotion(user);

    const tokens = generateTokens(user._id.toString(), user.email, user.role);
    res.json({ success: true, data: { ...tokens, user: publicUser(user) } });
  })
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = asString(req.body.refreshToken, 4096);
    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token required' });
      return;
    }

    let decoded: { id: string };
    try {
      decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as { id: string };
    } catch {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    // Re-read the user instead of copying `role` out of the old token.
    // Previously a demoted admin kept `role: "admin"` forever simply by
    // refreshing, and a banned user could refresh indefinitely.
    const user = await User.findById(decoded.id).select('_id email role isBanned');
    if (!user || user.isBanned) {
      res.status(401).json({ success: false, message: 'Account is no longer active' });
      return;
    }

    const tokens = generateTokens(user._id.toString(), user.email, user.role);
    res.json({ success: true, data: tokens });
  })
);

// POST /api/auth/verify-email
router.post(
  '/verify-email',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const email = normaliseEmail(req.body.email);
    const token = asString(req.body.token, 16);

    // asString rejects `{ "$ne": null }` outright. Without it, that object was
    // interpreted as a Mongo operator and verified an arbitrary account —
    // and this handler issues real tokens, so it was a full takeover.
    if (!email || !token) {
      res.status(400).json({ success: false, message: 'Email and verification code are required' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user || user.isEmailVerified) {
      res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
      return;
    }

    if ((user.emailVerificationAttempts ?? 0) >= 5) {
      res.status(429).json({
        success: false,
        message: 'Too many incorrect codes. Request a new one.',
      });
      return;
    }

    const expiry = user.emailVerificationExpiry?.getTime() ?? 0;
    const stored = user.emailVerificationToken ?? '';
    const matches =
      stored.length === token.length &&
      crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(token));

    if (!matches || expiry < Date.now()) {
      user.emailVerificationAttempts = (user.emailVerificationAttempts ?? 0) + 1;
      await user.save();
      res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
      return;
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    user.emailVerificationAttempts = 0;
    await user.save();

    await applyAdminPromotion(user);

    const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.email, user.role);
    res.json({
      success: true,
      message: 'Email verified successfully',
      data: { accessToken, refreshToken, user: publicUser(user) },
    });
  })
);

// POST /api/auth/resend-verification
router.post(
  '/resend-verification',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const email = normaliseEmail(req.body.email);
    if (!email) {
      res.status(400).json({ success: false, message: 'A valid email is required' });
      return;
    }

    const user = await User.findOne({ email });
    // Always report success so this cannot be used to enumerate accounts.
    if (user && !user.isEmailVerified) {
      const code = crypto.randomInt(100000, 1000000).toString();
      user.emailVerificationToken = code;
      user.emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      user.emailVerificationAttempts = 0;
      await user.save();
      await sendVerificationEmail(user.email, user.name, code);
    }

    res.json({ success: true, message: 'If that account exists and is unverified, a new code is on its way.' });
  })
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail()],
  asyncHandler(async (req: Request, res: Response) => {
    if (failedValidation(req, res)) return;

    const email = normaliseEmail(req.body.email);
    if (!email) {
      res.status(400).json({ success: false, message: 'A valid email is required' });
      return;
    }

    const user = await User.findOne({ email });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = hashToken(rawToken);
      user.resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      await sendPasswordResetEmail(user.email, user.name, rawToken);
    }

    // Deliberately identical whether or not the account exists. The previous
    // 404 ("No account found with this email address") let anyone test which
    // addresses were registered.
    res.json({
      success: true,
      message: 'If an account exists for that address, a password reset link has been sent.',
    });
  })
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  authLimiter,
  [body('token').isString().notEmpty(), body('password').isLength({ min: 8 })],
  asyncHandler(async (req: Request, res: Response) => {
    if (failedValidation(req, res)) return;

    const token = asString(req.body.token, 128);
    const password = asString(req.body.password, 200);

    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token and new password are required' });
      return;
    }

    // Look up by hash. `{"token":{"$gt":""}}` used to match the first account
    // with any live reset token, which was an unauthenticated takeover.
    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpiry: { $gt: new Date() },
    }).select('+password');

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    // A successful reset proves mailbox ownership, so it also verifies email.
    user.isEmailVerified = true;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. Please log in.' });
  })
);

export default router;
