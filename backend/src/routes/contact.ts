import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { sendContactEmail } from '../utils/email';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, failedValidation, asString, normaliseEmail } from '../utils/http';

const router = Router();

/**
 * POST /api/contact
 *
 * Rate-limited because this endpoint sends mail to the operator's own inbox on
 * behalf of an anonymous caller. Without a limit it is a spam relay aimed at
 * the address that also sends the site's verification codes — getting it
 * flagged would take account registration down with it.
 */
router.post(
  '/',
  generalLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Valid email is required'),
    body('message').trim().isLength({ min: 10, max: 5000 })
      .withMessage('Message must be between 10 and 5000 characters'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (failedValidation(req, res)) return;

    const name = asString(req.body.name, 100);
    const email = normaliseEmail(req.body.email);
    const message = asString(req.body.message, 5000);

    if (!name || !email || !message) {
      res.status(400).json({ success: false, message: 'Name, email and message are required' });
      return;
    }

    // The sender returns a boolean rather than throwing, so the result has to
    // be checked. The previous handler awaited it inside a try/catch and
    // reported success unconditionally, which meant a dead SMTP config looked
    // identical to a delivered message.
    const delivered = await sendContactEmail(name, email, message);
    if (!delivered) {
      res.status(502).json({
        success: false,
        message: 'We could not send your message right now. Please try again shortly.',
      });
      return;
    }

    res.json({ success: true, message: 'Your message has been sent. We will get back to you soon.' });
  })
);

export default router;
