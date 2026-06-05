import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { ContactMessage } from '../models/ContactMessage';

const router = Router();

// POST /api/contact
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { name, email, message } = req.body;

    try {
      // Save directly to database to bypass Render free tier email block
      await ContactMessage.create({ name, email, message });
      res.json({ success: true, message: 'Your message has been sent successfully. We will get back to you soon!' });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message. Please try again later.' });
    }
  }
);

export default router;
