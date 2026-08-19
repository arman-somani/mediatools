import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const COOKIE_FILE = path.join(__dirname, '../../cookies.txt');
let isRefreshing = false;

function formatCookiesToNetscape(cookies: any[]): string {
  let netscape = `# Netscape HTTP Cookie File\n# https://curl.haxx.se/rfc/cookie_spec.html\n# This is a generated file!  Do not edit.\n\n`;
  for (const cookie of cookies) {
    const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
    const includeSubDomain = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = cookie.path;
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiry = Math.round(cookie.expires || Date.now() / 1000 + 86400 * 30);
    const name = cookie.name;
    const value = cookie.value;

    netscape += `${domain}\t${includeSubDomain}\t${path}\t${secure}\t${expiry}\t${name}\t${value}\n`;
  }
  return netscape;
}

export async function refreshYouTubeCookies(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;

  console.log('[CookieManager] Starting WARP-routed background cookie refresh...');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log('[CookieManager] Navigating to YouTube via Cloudflare WARP proxy...');
    await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

    try {
      const acceptButtonSelector = 'button[aria-label="Accept all"]';
      await page.waitForSelector(acceptButtonSelector, { timeout: 3000 });
      await page.click(acceptButtonSelector);
      await new Promise(r => setTimeout(r, 2000));
    } catch {
      // No consent dialog
    }

    const cookies = await page.cookies();
    if (cookies.length === 0) {
      throw new Error('No cookies extracted from page');
    }

    const netscapeCookies = formatCookiesToNetscape(cookies);
    fs.writeFileSync(COOKIE_FILE, netscapeCookies, 'utf8');

    console.log('[CookieManager] Successfully generated and saved new cookies via WARP!');

  } catch (error: any) {
    console.error('[CookieManager] Failed to refresh cookies:', error.message);
  } finally {
    await browser.close();
    isRefreshing = false;
  }
}

export function startCookieManagerLoop() {
  // Wait 10 seconds for Wireproxy to start up before running the first fetch
  setTimeout(() => {
    refreshYouTubeCookies();
    // Refresh every 15 minutes
    setInterval(refreshYouTubeCookies, 15 * 60 * 1000);
  }, 10000);
}

export function getActiveCookieFile(): string | null {
  if (fs.existsSync(COOKIE_FILE)) {
    return COOKIE_FILE;
  }
  return null;
}
