import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

const passThrough = (req: Request, res: Response, next: NextFunction) => next();

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

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
