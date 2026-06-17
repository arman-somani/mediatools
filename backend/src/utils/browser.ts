import { addExtra } from 'puppeteer-extra';
import puppeteerCore from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';
import os from 'os';

const puppeteer = addExtra(puppeteerCore as any);
puppeteer.use(StealthPlugin());

export interface ScrapedData {
  title: string;
  thumbnail: string;
  videoUrl: string;
}

export async function extractVideoViaBrowser(url: string): Promise<ScrapedData> {
  const isWin = os.platform() === 'win32';
  let execPath = '';
  
  if (isWin) {
    // Local development fallback for Windows
    execPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  } else {
    // Production Linux/Render compressed binary
    execPath = await chromium.executablePath();
  }

  const browser = await puppeteer.launch({
    args: isWin ? [] : chromium.args,
    defaultViewport: { width: 1920, height: 1080 },
    executablePath: execPath,
    headless: true,
    ignoreHTTPSErrors: true,
  });

  try {
    const page = await browser.newPage();
    
    // Intercept requests to find direct MP4 URLs
    let interceptedVideoUrl = '';
    await page.setRequestInterception(true);
    page.on('request', (request: any) => {
      if (request.resourceType() === 'media' && !interceptedVideoUrl) {
        const reqUrl = request.url();
        if (reqUrl.includes('.mp4')) {
          interceptedVideoUrl = reqUrl;
        }
      }
      request.continue();
    });

    try {
      // Use domcontentloaded instead of networkidle2 because YouTube never stops making network requests
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Give it a few seconds for the javascript video player to initialize and trigger the media request
      await new Promise(r => setTimeout(r, 5000));
    } catch (e: any) {
      console.warn(`[Browser] Navigation timed out, but we might still have intercepted the video URL...`);
    }
    
    // Wait for a video tag to appear (optional, fallback)
    try {
      await page.waitForSelector('video', { timeout: 3000 });
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
