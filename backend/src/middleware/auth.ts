import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwtSecret) as {
      id: string;
      email: string;
      role: string;
    };

    const user = await User.findById(decoded.id).select('_id email role isPremium isBanned');
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ success: false, message: 'Your account has been suspended.' });
      return;
    }

    req.user = { id: user._id.toString(), email: user.email, role: user.role };
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Attaches `req.user` when a valid token is present, and continues as a guest
 * otherwise.
 *
 * It re-reads the user from the database exactly as `authenticate` does. The
 * previous version assigned the decoded JWT payload straight onto `req.user`,
 * which meant a banned account and a stale `role` claim both sailed through —
 * so any route that opted into "optional" auth silently lost ban enforcement.
 */
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.jwtSecret) as { id: string };
      const user = await User.findById(decoded.id).select('_id email role isBanned');
      if (user && !user.isBanned) {
        req.user = { id: user._id.toString(), email: user.email, role: user.role };
      }
    }
  } catch {
    // Invalid or expired token — continue as a guest.
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return;
  }
  next();
};
