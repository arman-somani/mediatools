import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

export async function refreshYouTubeCookies() {
    console.log('[Cookies] Refreshing YouTube cookies...');
    const cookiePath = path.resolve(process.cwd(), process.env.YOUTUBE_COOKIES || 'cookies.txt');
    if (fs.existsSync(cookiePath)) {
        try { fs.unlinkSync(cookiePath); } catch (e) {}
    }
    
    let executablePath = '';
    if (fs.existsSync('/usr/bin/chromium-browser')) {
        executablePath = '/usr/bin/chromium-browser';
    } else {
        executablePath = await chromium.executablePath();
    }

    const browser = await puppeteer.launch({
        args: [
            ...chromium.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: executablePath || undefined,
        headless: true,
        ignoreHTTPSErrors: true,
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2', timeout: 30000 });
        
        try {
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const rejectAll = btns.find(b => b.innerText.includes('Reject all') || b.innerText.includes('Accept all'));
                if (rejectAll) rejectAll.click();
            });
            await new Promise(r => setTimeout(r, 2000));
        } catch(e) {}

        const cookies = await page.cookies();
        
        let cookieStr = '# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n# This is a generated file!  Do not edit.\n\n';
        for (const cookie of cookies) {
            const domain = cookie.domain;
            const includesSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
            const cPath = cookie.path;
            const secure = cookie.secure ? 'TRUE' : 'FALSE';
            const expires = Math.round(cookie.expires || (Date.now()/1000 + 31536000));
            const name = cookie.name;
            const value = cookie.value;
            cookieStr += `${domain}\t${includesSubdomains}\t${cPath}\t${secure}\t${expires}\t${name}\t${value}\n`;
        }
        
        fs.writeFileSync(cookiePath, cookieStr);
        console.log(`[Cookies] Successfully saved ${cookies.length} cookies to ${cookiePath}`);
    } catch (err: any) {
        console.error('[Cookies] Failed to refresh cookies:', err.message);
    } finally {
        browser.close().catch(() => {});
    }
}

export async function interceptYoutubeStreams(url: string, type: 'video' | 'audio' = 'video'): Promise<{ videoUrl: string | null, audioUrl: string | null }> {
    let executablePath = '';
    
    // Use Colab's native chromium if available, otherwise use sparticuz
    if (fs.existsSync('/usr/bin/chromium-browser')) {
        executablePath = '/usr/bin/chromium-browser';
    } else {
        executablePath = await chromium.executablePath();
    }

    const browser = await puppeteer.launch({
        args: [
            ...chromium.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: executablePath || undefined,
        headless: true,
        ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    let videoUrl: string | null = null;
    let audioUrl: string | null = null;

    return new Promise(async (resolve, reject) => {
        // Maximum time to wait for the streams to appear
        const timeout = setTimeout(async () => {
            await browser.close().catch(() => {});
            resolve({ videoUrl, audioUrl });
        }, 15000);

        page.on('response', async (response: any) => {
            const reqUrl = response.url();
            if (reqUrl.includes('videoplayback')) {
                try {
                    const parsedUrl = new URL(reqUrl);
                    
                    // Strip chunking parameters to get the full continuous stream
                    parsedUrl.searchParams.delete('range');
                    parsedUrl.searchParams.delete('rn');
                    parsedUrl.searchParams.delete('rbuf');
                    
                    const mime = parsedUrl.searchParams.get('mime');
                    
                    if (mime && mime.startsWith('video/') && !videoUrl) {
                        videoUrl = parsedUrl.toString();
                        console.log('[Puppeteer] Intercepted Video Stream URL');
                    } else if (mime && mime.startsWith('audio/') && !audioUrl) {
                        audioUrl = parsedUrl.toString();
                        console.log('[Puppeteer] Intercepted Audio Stream URL');
                    }

                    // For audio extraction, we only need audioUrl. For universal, we need both.
                    const isDone = type === 'audio' ? !!audioUrl : (!!videoUrl && !!audioUrl);

                    if (isDone) {
                        clearTimeout(timeout);
                        await browser.close().catch(() => {});
                        resolve({ videoUrl, audioUrl });
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            }
        });

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            // Click play if needed (YouTube usually auto-plays, but just in case)
            await page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) video.play();
            });
        } catch (e) {
            console.warn('[Puppeteer] Navigation timed out or failed, but streams may have already been captured.');
        }
    });
}
