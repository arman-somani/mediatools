import fs from 'fs';
import path from 'path';

// Ensure fetch and AbortController are available globally
declare const fetch: typeof global.fetch;
declare const AbortController: typeof global.AbortController;

interface CobaltInstance {
  domain: string;
  score: number;
  version: string;
}

interface CobaltResponse {
  url?: string;
  text?: string;
  error?: string;
}

let instancesCache: { instances: CobaltInstance[], timestamp: number } | null = null;
const CACHE_TTL = 3600000; // 1 hour

function normalizeVideoQuality(quality?: string): string {
  const map: Record<string, string> = {
    '360p': '360',
    '480p': '480',
    '720p': '720',
    '1080p': '1080',
    '4K': '2160',
    '8K': '4320',
  };

  return map[quality || ''] || quality?.replace(/p$/i, '') || '720';
}

/**
 * Fetches available Cobalt instances from the registry
 */
async function fetchCobaltInstances(): Promise<CobaltInstance[]> {
  const now = Date.now();
  
  // Return cached instances if still valid
  if (instancesCache && (now - instancesCache.timestamp) < CACHE_TTL) {
    console.log('Using cached Cobalt instances');
    return instancesCache.instances;
  }

  try {
    console.log('Fetching fresh Cobalt instances...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const resp = await fetch('https://instances.cobalt.tools/api/instances', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`Status ${resp.status}`);

      const data = (await resp.json()) as CobaltInstance[];
      
      // Filter for recent, high-score instances
      const filtered = data
        .filter(i => i.score > 85 && i.version.startsWith('10.'))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      // Cache the results
      instancesCache = { instances: filtered, timestamp: now };
      console.log(`Fetched ${filtered.length} working Cobalt instances`);
      
      return filtered;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  } catch (e: any) {
    console.error('Failed to fetch Cobalt instances:', e.message);
    
    // Return fallback hardcoded instances
    return [
      { domain: 'co.wuk.sh', score: 100, version: '10.0' },
      { domain: 'api.cobalt.tools', score: 100, version: '10.0' },
      { domain: 'cobalt.q0.is', score: 95, version: '10.0' },
    ];
  }
}

/**
 * Downloads from a single Cobalt instance
 */
async function tryDownloadFromInstance(
  instance: CobaltInstance,
  url: string,
  format: 'audio' | 'video',
  quality?: string
): Promise<CobaltResponse> {
  try {
    const cobaltUrl = `https://${instance.domain}/api/json`;
    
    const reqBody: any = {
      url,
      downloadMode: format,
      vimeoDuplicate: false,
    };

    if (format === 'audio') {
      reqBody.audioFormat = 'mp3';
      reqBody.audioBitrate = quality || '192';
    } else {
      reqBody.videoQuality = normalizeVideoQuality(quality);
      reqBody.videoCodec = 'h264';
      reqBody.audioCodec = 'aac';
      reqBody.filenamePattern = 'pretty';
    }

    console.log(`Trying Cobalt instance: ${instance.domain}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const cobaltResp = await fetch(cobaltUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal,
        body: JSON.stringify(reqBody),
      });

      clearTimeout(timeoutId);

      if (!cobaltResp.ok) {
        throw new Error(`Cobalt returned ${cobaltResp.status}`);
      }

      const data = (await cobaltResp.json()) as CobaltResponse;

      if (data.error) {
        throw new Error(`Cobalt error: ${data.error}`);
      }

      if (!data.url) {
        throw new Error('No download URL in response');
      }

      console.log(`SUCCESS from ${instance.domain}!`);
      return data;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  } catch (e: any) {
    console.log(`Failed on ${instance.domain}: ${e.message}`);
    return { error: e.message };
  }
}

/**
 * Main method: tries multiple Cobalt instances until one works
 */
export async function downloadViaCobalt(
  youtubeUrl: string,
  format: 'audio' | 'video' = 'audio',
  quality?: string
): Promise<string> {
  const instances = await fetchCobaltInstances();

  if (instances.length === 0) {
    throw new Error('No Cobalt instances available');
  }

  // Try each instance
  for (const instance of instances) {
    try {
      const result = await tryDownloadFromInstance(instance, youtubeUrl, format, quality);
      
      if (result.url) {
        // Verify the URL is accessible
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          try {
            const headResp = await fetch(result.url, {
              method: 'HEAD',
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            if (headResp.ok || headResp.status === 206) {
              console.log(`Download URL verified: ${result.url.slice(0, 80)}`);
              return result.url;
            }
          } catch (e) {
            clearTimeout(timeoutId);
            throw e;
          }
        } catch (e: any) {
          console.warn(`URL verification failed: ${e.message}`);
        }

        // Try regular GET if HEAD fails
        return result.url;
      }
    } catch (e: any) {
      console.error(`Instance ${instance.domain} failed:`, e.message);
      continue;
    }
  }

  throw new Error('All Cobalt instances failed');
}

/**
 * Get download stream from a Cobalt download URL
 */
export async function downloadFromUrl(url: string): Promise<ReadableStream<Uint8Array>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cobalt.tools/',
        'Range': 'bytes=0-',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`Download failed: ${resp.status}`);
    }

    if (!resp.body) {
      throw new Error('No response body');
    }

    return resp.body as any;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Health check to verify Cobalt is working
 */
export async function checkCobaltHealth(): Promise<boolean> {
  try {
    const instances = await fetchCobaltInstances();
    
    for (const instance of instances.slice(0, 3)) {
      try {
        const result = await tryDownloadFromInstance(
          instance,
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          'audio'
        );
        
        if (result.url) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    return false;
  } catch (e: any) {
    console.error('Cobalt health check failed:', e.message);
    return false;
  }
}
