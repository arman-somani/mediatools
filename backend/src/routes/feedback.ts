import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { sendFeedbackEmail } from '../utils/email';

const router = Router();

// POST /api/feedback
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('type').isIn(['compliment', 'complain', 'bug']).withMessage('Valid feedback type is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { name, email, type, message } = req.body;

    try {
      await sendFeedbackEmail(name, email, type, message);
      res.json({ success: true, message: 'Your feedback has been sent successfully!' });
    } catch (error) {
      console.error('Feedback form error:', error);
      res.status(500).json({ success: false, message: 'Failed to send feedback. Please try again later.' });
    }
  }
);

export default router;
