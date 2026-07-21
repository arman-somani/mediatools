import fs from 'fs';
import path from 'path';

const WARP_PROXY = 'socks5://127.0.0.1:1080';

export async function getFreeProxies(): Promise<string[]> {
  // Directly return the Cloudflare WARP proxy instead of scraping unreliable GitHub proxies
  return [WARP_PROXY];
}

export async function getRandomFreeProxies(count: number = 1): Promise<string[]> {
  // Always return the WARP proxy
  return [WARP_PROXY];
}
