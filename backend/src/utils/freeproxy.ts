import fs from 'fs';
import path from 'path';

let cachedProxies: string[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getFreeProxies(): Promise<string[]> {
  const now = Date.now();
  if (cachedProxies.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedProxies;
  }

  const urls = [
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
    'https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=http&anonymity=elite,anonymous&timeout=10000'
  ];

  try {
    const fetchPromises = urls.map(async (url) => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const text = await resp.text();
        return text.split('\n').map(p => p.trim()).filter(p => p.length > 0 && p.includes(':'));
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    const allProxies = results.flat();
    
    if (allProxies.length === 0) {
      throw new Error('All proxy sources failed to return proxies');
    }

    // Deduplicate
    const uniqueProxies = Array.from(new Set(allProxies));

    // Add http:// prefix if missing
    cachedProxies = uniqueProxies.map(p => p.startsWith('http') ? p : `http://${p}`);
    lastFetchTime = now;
    console.log(`[FreeProxy] Fetched ${cachedProxies.length} unique proxies from GitHub & ProxyScrape`);
    return cachedProxies;
  } catch (error) {
    console.warn('[FreeProxy] Failed to fetch proxy list:', error);
    return cachedProxies; // return stale cache if available
  }
}

export async function getRandomFreeProxies(count: number = 2): Promise<string[]> {
  const proxies = await getFreeProxies();
  if (proxies.length === 0) return [];
  
  // Shuffle array
  const shuffled = [...proxies].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
