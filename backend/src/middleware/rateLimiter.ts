import { Request, Response, NextFunction } from 'express';

const passThrough = (req: Request, res: Response, next: NextFunction) => next();

export const generalLimiter = passThrough;
export const authLimiter = passThrough;
export const convertLimiter = passThrough;
export const paymentLimiter = passThrough;
