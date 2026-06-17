import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export interface ScrapedData {
  title: string;
  thumbnail: string;
  videoUrl: string;
}

export async function extractVideoViaBrowser(url: string): Promise<ScrapedData> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Intercept requests to find direct MP4 URLs
    let interceptedVideoUrl = '';
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.resourceType() === 'media' && !interceptedVideoUrl) {
        const reqUrl = request.url();
        if (reqUrl.includes('.mp4')) {
          interceptedVideoUrl = reqUrl;
        }
      }
      request.continue();
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for a video tag to appear (optional, fallback)
    try {
      await page.waitForSelector('video', { timeout: 5000 });
    } catch (e) {
      // Ignored
    }

    const data = await page.evaluate(() => {
      const titleEl = document.querySelector('meta[property="og:title"]') || document.querySelector('title');
      const title = titleEl ? (titleEl.getAttribute('content') || titleEl.textContent) : 'Downloaded Video';
      
      const thumbEl = document.querySelector('meta[property="og:image"]');
      const thumbnail = thumbEl ? thumbEl.getAttribute('content') : '';

      const videoEl = document.querySelector('video');
      const videoSrc = videoEl ? videoEl.getAttribute('src') : '';
      
      return { title: title || 'Downloaded Video', thumbnail: thumbnail || '', videoSrc: videoSrc || '' };
    });

    const finalVideoUrl = interceptedVideoUrl || data.videoSrc || '';

    if (!finalVideoUrl || finalVideoUrl.startsWith('blob:')) {
      throw new Error("Browser extraction failed: No direct video URL found.");
    }

    return {
      title: data.title,
      thumbnail: data.thumbnail,
      videoUrl: finalVideoUrl,
    };

  } finally {
    await browser.close();
  }
}
