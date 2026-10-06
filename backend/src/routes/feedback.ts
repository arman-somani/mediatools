import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { sendFeedbackEmail } from '../utils/email';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, failedValidation, asString, normaliseEmail } from '../utils/http';

const router = Router();

const FEEDBACK_TYPES = ['compliment', 'complain', 'bug'] as const;

/** POST /api/feedback — rate-limited for the same reason as /api/contact. */
router.post(
  '/',
  generalLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Valid email is required'),
    body('type').isIn(FEEDBACK_TYPES).withMessage('Feedback type must be compliment, complain or bug'),
    body('message').trim().isLength({ min: 10, max: 5000 })
      .withMessage('Message must be between 10 and 5000 characters'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (failedValidation(req, res)) return;

    const name = asString(req.body.name, 100);
    const email = normaliseEmail(req.body.email);
    const message = asString(req.body.message, 5000);
    const rawType = asString(req.body.type, 20);
    const type = FEEDBACK_TYPES.find(t => t === rawType);

    if (!name || !email || !message || !type) {
      res.status(400).json({ success: false, message: 'Name, email, type and message are required' });
      return;
    }

    const delivered = await sendFeedbackEmail(name, email, type, message);
    if (!delivered) {
      res.status(502).json({
        success: false,
        message: 'We could not send your feedback right now. Please try again shortly.',
      });
      return;
    }

    res.json({ success: true, message: 'Thanks — your feedback has been sent.' });
  })
);

export default router;
