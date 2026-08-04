import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { Conversion } from '../models/Conversion';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import axios from 'axios';

const router = Router();

// Secure all admin routes
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const downloadsAgg = await Conversion.aggregate([
      { $group: { _id: null, total: { $sum: "$downloadCount" } } }
    ]);
    const totalDownloads = downloadsAgg[0]?.total || 0;

    let totalBandwidthUsed = 0;
    try {
      if (process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID) {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const resRender = await axios.get(`https://api.render.com/v1/metrics/bandwidth?resource=${process.env.RENDER_SERVICE_ID}&startTime=${startOfMonth.toISOString()}&endTime=${now.toISOString()}`, {
          headers: { 'Authorization': `Bearer ${process.env.RENDER_API_KEY}` }
        });
        
        const json = resRender.data;
        if (json && json[0] && json[0].values) {
          const sumMB = json[0].values.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
          totalBandwidthUsed = sumMB * 1024 * 1024; // Convert MB to Bytes
        }
      }
    } catch (e: any) {
      console.warn('Render API bandwidth fetch failed', e?.response?.data || e.message);
      // Fallback
      const bandwidthAgg = await User.aggregate([
        { $group: { _id: null, total: { $sum: "$monthlyBandwidthUsed" } } }
      ]);
      totalBandwidthUsed = bandwidthAgg[0]?.total || 0;
    }

    const activeThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    
    const [
      totalUsers,
      totalConversions,
      recentUsers,
      recentConversions,
      liveUsers
    ] = await Promise.all([
      User.countDocuments(),
      Conversion.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(10).select('-password'),
      Conversion.find().sort({ createdAt: -1 }).limit(10).populate('userId', 'name email'),
      User.countDocuments({ lastActiveAt: { $gte: activeThreshold } })
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalConversions,
          liveUsers,
          totalBandwidthUsed,
          totalDownloads
        },
        recentUsers,
        recentConversions,
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
      .select('name email role totalConversions totalDownloads isPremium isBanned monthlyBandwidthUsed createdAt')
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
