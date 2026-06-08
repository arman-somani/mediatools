import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

router.get('/youtube', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
      return;
    }

    const API_KEY = process.env.YOUTUBE_API_KEY;
    if (!API_KEY) {
      res.status(500).json({ success: false, message: 'YouTube API key not configured' });
      return;
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        maxResults: 10,
        q: q,
        type: 'video',
        key: API_KEY,
      },
    });

    const items = response.data.items || [];
    const results = items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('YouTube search error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to search YouTube videos' });
  }
});

export default router;
