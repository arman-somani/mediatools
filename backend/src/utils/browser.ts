import { addExtra } from 'puppeteer-extra';
import puppeteerCore from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

const puppeteer = addExtra(puppeteerCore as any);
puppeteer.use(StealthPlugin());

function formatNetscapeCookies(cookies: any[]) {
  let output = "# Netscape HTTP Cookie File\n";
  output += "# https://curl.haxx.se/rfc/cookie_spec.html\n";
  output += "# This is a generated file!  Do not edit.\n\n";

  for (const cookie of cookies) {
    const domain = cookie.domain;
    const includeSubDomain = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const cookiePath = cookie.path;
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expires = cookie.expires > 0 ? Math.floor(cookie.expires) : 0;
    const name = cookie.name;
    const value = cookie.value;
    output += `${domain}\t${includeSubDomain}\t${cookiePath}\t${secure}\t${expires}\t${name}\t${value}\n`;
  }
  return output;
}

export async function harvestCookies(url: string = 'https://www.youtube.com'): Promise<string> {
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
    
    // Fake user agent to look even more like a real user
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`[Browser] Navigating to ${url} to harvest cookies...`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Wait for a few seconds to let youtube set all the necessary consent/bot cookies
      await new Promise(r => setTimeout(r, 5000));
    } catch (e: any) {
      console.warn(`[Browser] Navigation timed out, but we will harvest whatever cookies we have...`);
    }

    const cookies = await page.cookies();
    if (!cookies || cookies.length === 0) {
      throw new Error("Failed to harvest cookies.");
    }

    const netscapeFormat = formatNetscapeCookies(cookies);
    
    // Save to a global cookies file
    const cookieDest = path.join(__dirname, '../../outputs', 'youtube_cookies.txt');
    
    // Ensure outputs directory exists
    const outputsDir = path.dirname(cookieDest);
    try {
      await fs.access(outputsDir);
    } catch {
      await fs.mkdir(outputsDir, { recursive: true });
    }

    await fs.writeFile(cookieDest, netscapeFormat, 'utf8');
    
    console.log(`[Browser] Harvested ${cookies.length} cookies successfully at ${cookieDest}.`);
    return cookieDest;

  } finally {
    await browser.close();
  }
}
