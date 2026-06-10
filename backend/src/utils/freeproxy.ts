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

  try {
    const resp = await fetch('https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=http&anonymity=elite,anonymous&timeout=10000');
    if (!resp.ok) {
      throw new Error(`Failed to fetch free proxies: ${resp.statusText}`);
    }
    const text = await resp.text();
    const proxies = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    
    // Add http:// prefix if missing
    cachedProxies = proxies.map(p => p.startsWith('http') ? p : `http://${p}`);
    lastFetchTime = now;
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
