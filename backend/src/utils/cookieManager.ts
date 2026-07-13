import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { getFreeProxies } from './freeproxy';

puppeteer.use(StealthPlugin());

const COOKIE_FILE = path.resolve(__dirname, '../../youtube-cookies.txt');

// State
let currentWorkingProxy: string | null = null;
let isRefreshing = false;

/**
 * Validates a proxy by sending a quick GET request to YouTube to ensure it doesn't block tunneling.
 */
async function testProxy(proxyUrl: string): Promise<boolean> {
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const res = await fetch('https://www.youtube.com', {
      agent: agent as any,
      method: 'GET',
      timeout: 8000,
    });
    if (!res.ok) return false;
    const text = await res.text();
    // Ensure we actually hit YouTube and not a proxy portal
    return text.toLowerCase().includes('youtube');
  } catch {
    return false;
  }
}

/**
 * Formats Puppeteer cookies into Netscape format for yt-dlp.
 */
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

/**
 * The main routine that finds a proxy, launches Puppeteer, extracts cookies, and saves them.
 */
export async function refreshYouTubeCookies(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;

  console.log('[CookieManager] Starting background cookie refresh...');

  try {
    const proxies = await getFreeProxies();
    if (proxies.length === 0) {
      console.warn('[CookieManager] No free proxies available.');
      isRefreshing = false;
      return;
    }

    // Shuffle proxies to randomize attempts
    const shuffled = [...proxies].sort(() => 0.5 - Math.random());
    let success = false;

    // Aggressive loop: Test up to 15 proxies, and launch Puppeteer for the ones that pass the basic test
    for (const proxy of shuffled.slice(0, 15)) {
      console.log(`[CookieManager] Testing proxy: ${proxy}...`);
      if (!(await testProxy(proxy))) {
        continue;
      }

      console.log(`[CookieManager] Proxy passed basic test. Launching browser on: ${proxy}`);

      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          `--proxy-server=${proxy}`,
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

        console.log('[CookieManager] Navigating to YouTube (up to 60s timeout)...');
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

        currentWorkingProxy = proxy;
        success = true;
        console.log('[CookieManager] Successfully generated and saved new cookies!');
        
        await browser.close();
        break; // Stop iterating through proxies because we succeeded

      } catch (err: any) {
        console.warn(`[CookieManager] Puppeteer failed on proxy ${proxy}: ${err.message}`);
        console.log(`[CookieManager] Closing browser and trying next proxy...`);
        await browser.close();
      }
    }

    if (!success) {
      console.error('[CookieManager] All 15 proxy attempts failed to extract cookies. Will retry in 10 minutes.');
    }

  } catch (error: any) {
    console.error('[CookieManager] Fatal error during refresh cycle:', error.message);
  } finally {
    isRefreshing = false;
  }
}

/**
 * Returns the latest working proxy that generated the current cookies.
 */
export function getActiveProxy(): string | null {
  return currentWorkingProxy;
}

/**
 * Returns the path to the cached cookies.txt file, if it exists.
 */
export function getActiveCookieFile(): string | null {
  if (fs.existsSync(COOKIE_FILE)) {
    return COOKIE_FILE;
  }
  return null;
}

/**
 * Starts the automated 10-minute refresh cycle.
 */
export function startCookieManagerLoop(): void {
  // Run immediately on boot
  refreshYouTubeCookies();
  
  // Schedule every 10 minutes (600,000 ms)
  setInterval(() => {
    refreshYouTubeCookies();
  }, 10 * 60 * 1000);
}
