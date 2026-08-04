import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { Conversion } from '../models/Conversion';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Secure all admin routes
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalConversions = await Conversion.countDocuments();
    
    const downloadsAgg = await Conversion.aggregate([
      { $group: { _id: null, total: { $sum: "$downloadCount" } } }
    ]);
    const totalDownloads = downloadsAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalConversions,
        totalDownloads
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/users
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({})
      .select('name email role totalConversions totalDownloads isPremium isBanned createdAt')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.id;
    
    // Prevent banning yourself
    if (targetUserId === req.user!.id) {
      res.status(400).json({ success: false, message: 'You cannot ban yourself.' });
      return;
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({
      success: true,
      message: user.isBanned ? 'User has been banned.' : 'User has been unbanned.',
      data: { isBanned: user.isBanned }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
