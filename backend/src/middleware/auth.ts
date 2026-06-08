import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      id: string;
      email: string;
      role: string;
    };

    const user = await User.findById(decoded.id).select('_id email role isPremium');
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    req.user = { id: user._id.toString(), email: user.email, role: user.role };
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
        id: string;
        email: string;
        role: string;
      };
      req.user = decoded;
    }
  } catch {
    // Token invalid ? continue as guest
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
