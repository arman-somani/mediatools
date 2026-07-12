import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import { refreshYouTubeCookies as refreshViaPuppeteer } from './puppeteerInterceptor';

const execAsync = promisify(exec);

let fetchPromise: Promise<void> | null = null;
let lastFetchTime = 0;

export async function refreshYouTubeCookies(force = false): Promise<void> {
  const now = Date.now();
  
  // If we successfully fetched cookies within the last 30 seconds, 
  // don't fetch again. They are still perfectly fresh!
  if (!force && now - lastFetchTime < 30000) {
    return;
  }

  // If another download request is CURRENTLY fetching cookies, 
  // just wait for that one to finish instead of spawning a second Chrome window!
  if (fetchPromise) {
    console.log('⏳ [Cookies] Another download is already fetching cookies. Waiting in queue...');
    return fetchPromise;
  }

  // Start the fetch and store the promise so other requests can await it
  fetchPromise = (async () => {
    try {
      // Check if google-chrome-stable is installed (Colab environment)
      let isColab = false;
      if (os.platform() === 'linux' && !process.env.RENDER) {
        try {
          await execAsync('which google-chrome-stable');
          isColab = true;
        } catch (e) {
          isColab = false;
        }
      }

      if (isColab) {
        console.log('🌐 [Cookies] Colab environment detected. Launching native Google Chrome...');
        if (force && fs.existsSync('/root/.config/google-chrome')) {
          await execAsync('rm -rf /root/.config/google-chrome');
          console.log('🧹 [Cookies] Wiped old Chrome profile for a forced fresh start.');
        }
        try {
          await execAsync('google-chrome-stable --headless --no-sandbox --disable-dev-shm-usage --user-data-dir=/root/.config/google-chrome --password-store=basic --virtual-time-budget=5000 https://www.youtube.com', { timeout: 15000 });
        } catch (err) {
          // ignore timeouts or errors since it might have generated the cookies anyway
        } finally {
          try { await execAsync('pkill -f chrome'); } catch(e) {}
        }
      } else {
        console.log('🌐 [Cookies] Render/Docker/Local environment detected. Launching Headless Chromium via Puppeteer...');
        await refreshViaPuppeteer();
      }

      lastFetchTime = Date.now();
      console.log('✅ [Cookies] Fresh YouTube cookies successfully generated and stored!');
    } catch (error: any) {
      console.error('❌ [Cookies] Failed to fetch fresh cookies:', error.message);
    } finally {
      // Clear the promise so future requests can trigger a new fetch
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}
