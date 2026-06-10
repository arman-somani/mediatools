import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { Conversion } from '../models/Conversion';
import { Payment } from '../models/Payment';
import { authenticate, AuthRequest } from '../middleware/auth';
import { imageUpload } from '../middleware/imageUpload';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';

const router = Router();

// GET /api/user/profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user!.id).select('-password -emailVerificationToken -resetPasswordToken');

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.json({ success: true, data: user });
});

// PUT /api/user/profile
router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('avatar').optional().isURL(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { name, avatar } = req.body;
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (avatar) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user!.id, updates, { new: true }).select('-password');
    res.json({ success: true, data: user });
  }
);

// PUT /api/user/profile/avatar
router.put(
  '/profile/avatar',
  authenticate,
  imageUpload.single('avatar'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No image file provided' });
        return;
      }

      const streamUpload = (req: Express.Request) => {
        return new Promise<{ secure_url: string }>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'avatars' },
            (error, result) => {
              if (result) {
                resolve(result);
              } else {
                reject(error);
              }
            }
          );

          streamifier.createReadStream(req.file!.buffer).pipe(stream);
        });
      };

      const result = await streamUpload(req);

      const user = await User.findByIdAndUpdate(
        req.user!.id,
        { avatar: result.secure_url },
        { new: true }
      ).select('-password');

      res.json({ success: true, data: user });
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
  }
);

// GET /api/user/dashboard
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const [user, recentConversions, recentPayments, userConversionsCount, userDownloadsAgg] = await Promise.all([
    User.findById(userId).select('-password'),
    Conversion.find({ userId }).sort({ createdAt: -1 }).limit(5).select('-outputPath'),
    Payment.find({ userId, status: 'paid' }).sort({ createdAt: -1 }).limit(5).select('-signature'),
    Conversion.countDocuments({ userId }),
    Conversion.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$downloadCount" } } }
    ])
  ]);

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  const exactDownloads = userDownloadsAgg[0]?.total || 0;

  res.json({
    success: true,
    data: {
      user,
      recentConversions,
      recentPayments,
      stats: {
        totalConversions: userConversionsCount,
        totalDownloads: exactDownloads,
        isPremium: user.isPremium,
        subscriptionType: user.subscriptionType,
        subscriptionExpiry: user.subscriptionExpiry,
        monthlyConversionsUsed: user.monthlyConversionsUsed,
        monthlyConversionsLimit: user.monthlyConversionsLimit,
      },
    },
  });
});

// DELETE /api/user/history
router.delete('/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Conversion.deleteMany({ userId: req.user!.id });
    res.json({ success: true, message: 'History cleared' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to clear history' });
  }
});

// DELETE /api/user/history/:id
router.delete('/history/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deleted = await Conversion.findOneAndDelete({ _id: req.params.id, userId: req.user!.id });
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Conversion not found' });
      return;
    }
    res.json({ success: true, message: 'Conversion deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete conversion' });
  }
});

export default router;
