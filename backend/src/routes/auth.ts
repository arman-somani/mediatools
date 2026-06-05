import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
import { User } from '../models/User';
import { authLimiter } from '../middleware/rateLimiter';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';

const router = Router();

const generateTokens = (userId: string, email: string, role: string) => {
  const accessToken = jwt.sign(
    { id: userId, email, role },
    (process.env.JWT_SECRET || 'secret') as string,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
  );
  const refreshToken = jwt.sign(
    { id: userId, email, role },
    (process.env.JWT_REFRESH_SECRET || 'refresh_secret') as string,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
  return { accessToken, refreshToken };
};

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const user = await User.create({
      name,
      email,
      password,
      emailVerificationToken: verificationCode,
      emailVerificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Send verification email (non-blocking)
    sendVerificationEmail(email, name, verificationCode).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for the verification code.',
    });
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (!user.isEmailVerified) {
      res.status(403).json({ success: false, message: 'Please verify your email address to log in' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.email, user.role);
    res.json({
      success: true,
      data: {
        accessToken, refreshToken,
        user: { id: user._id, name: user.name, email: user.email, isPremium: user.isPremium, subscriptionType: user.subscriptionType },
      },
    });
  }
);

// POST /api/auth/google
router.post('/google', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { accessToken } = req.body;

  if (!accessToken) {
    res.status(400).json({ success: false, message: 'Google access token required' });
    return;
  }

  try {
    const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { sub: googleId, email, name, picture: avatar } = data;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = await User.create({ name, email, googleId, avatar, isEmailVerified: true });
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (avatar) user.avatar = avatar;
      await user.save();
    }

    const tokens = generateTokens(user._id.toString(), user.email, user.role);
    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken, refreshToken: tokens.refreshToken,
        user: { id: user._id, name: user.name, email: user.email, isPremium: user.isPremium, subscriptionType: user.subscriptionType },
      },
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid Google token' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ success: false, message: 'Refresh token required' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret') as {
      id: string; email: string; role: string;
    };
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.id, decoded.email, decoded.role);
    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  const { email, token } = req.body;

  if (!email || !token) {
    res.status(400).json({ success: false, message: 'Email and verification code are required' });
    return;
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    emailVerificationToken: token,
    emailVerificationExpiry: { $gt: new Date() },
  });

  if (!user) {
    res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    return;
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  await user.save();

  const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.email, user.role);

  res.json({
    success: true,
    message: 'Email verified successfully',
    data: {
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, isPremium: user.isPremium, subscriptionType: user.subscriptionType }
    }
  });
});

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ success: false, message: 'No account found with this email address.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    sendPasswordResetEmail(email, user.name, resetToken).catch(console.error);
    res.json({ success: true, message: 'A password reset link has been sent to your email.' });
  }
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() },
    }).select('+password');

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. Please log in.' });
  }
);

export default router;
