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
 * Validates a proxy by sending a quick HEAD request to YouTube.
 */
async function testProxy(proxyUrl: string): Promise<boolean> {
  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const res = await fetch('https://www.youtube.com', {
      agent: agent as any,
      method: 'HEAD',
      timeout: 5000,
    });
    return res.ok;
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

    // Shuffle and find a working proxy
    const shuffled = [...proxies].sort(() => 0.5 - Math.random());
    let workingProxy: string | null = null;

    for (const proxy of shuffled.slice(0, 15)) { // Test up to 15 proxies
      if (await testProxy(proxy)) {
        workingProxy = proxy;
        break;
      }
    }

    if (!workingProxy) {
      console.warn('[CookieManager] Could not find a working proxy for cookie extraction.');
      isRefreshing = false;
      return;
    }

    console.log(`[CookieManager] Selected working proxy: ${workingProxy}`);

    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        `--proxy-server=${workingProxy}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      
      // Block unnecessary resources to speed up load
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      console.log('[CookieManager] Navigating to YouTube...');
      await page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Optional: click accept cookies if a consent dialog appears (European IPs)
      try {
        const acceptButtonSelector = 'button[aria-label="Accept all"]';
        await page.waitForSelector(acceptButtonSelector, { timeout: 3000 });
        await page.click(acceptButtonSelector);
        await new Promise(r => setTimeout(r, 2000)); // wait for cookies to settle
      } catch {
        // No consent dialog found, which is fine
      }

      const cookies = await page.cookies();
      if (cookies.length === 0) {
        throw new Error('No cookies extracted from page');
      }

      const netscapeCookies = formatCookiesToNetscape(cookies);
      fs.writeFileSync(COOKIE_FILE, netscapeCookies, 'utf8');

      currentWorkingProxy = workingProxy;
      console.log('[CookieManager] Successfully generated and saved new cookies!');
    } finally {
      await browser.close();
      console.log('[CookieManager] Browser closed.');
    }

  } catch (error: any) {
    console.error('[CookieManager] Failed to refresh cookies:', error.message);
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
