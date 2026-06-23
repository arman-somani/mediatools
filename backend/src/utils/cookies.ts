import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';

const execAsync = promisify(exec);

let isFetching = false;
let lastFetchTime = 0;

export async function refreshYouTubeCookies(force = false): Promise<void> {
  // Only run on Linux (Google Colab)
  if (os.platform() !== 'linux') return;

  // Prevent multiple concurrent Chrome spawns, and only fetch max once every 2 minutes unless forced
  const now = Date.now();
  if (!force && (now - lastFetchTime < 120000)) {
    return;
  }

  if (isFetching) return;
  isFetching = true;

  try {
    console.log('🌐 [Cookies] Launching Headless Chrome to fetch fresh YouTube cookies...');
    
    // Optionally wipe the old profile to guarantee a 100% fresh session
    if (force && fs.existsSync('/root/.config/google-chrome')) {
      await execAsync('rm -rf /root/.config/google-chrome');
      console.log('🧹 [Cookies] Wiped old Chrome profile for a forced fresh start.');
    }

    // Run headless Chrome. --virtual-time-budget=5000 makes it automatically exit after 5 seconds of simulated time
    await execAsync('google-chrome-stable --headless --no-sandbox --disable-dev-shm-usage --user-data-dir=/root/.config/google-chrome --password-store=basic --virtual-time-budget=5000 https://www.youtube.com');
    
    lastFetchTime = Date.now();
    console.log('✅ [Cookies] Fresh YouTube cookies successfully generated and stored!');
  } catch (error: any) {
    console.error('❌ [Cookies] Failed to fetch fresh cookies:', error.message);
  } finally {
    isFetching = false;
  }
}
