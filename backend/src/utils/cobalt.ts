import fs from 'fs';
import path from 'path';

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
    const resp = await fetch('https://instances.cobalt.tools/api/instances', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    } as any);

    if (!resp.ok) throw new Error(`Status ${resp.status}`);

    const data: CobaltInstance[] = await resp.json();
    
    // Filter for recent, high-score instances
    const filtered = data
      .filter(i => i.score > 85 && i.version.startsWith('10.'))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Cache the results
    instancesCache = { instances: filtered, timestamp: now };
    console.log(`Fetched ${filtered.length} working Cobalt instances`);
    
    return filtered;
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
      reqBody.videoQuality = quality || '720';
      reqBody.videoCodec = 'h264';
      reqBody.audioCodec = 'aac';
      reqBody.filenamePattern = 'pretty';
    }

    console.log(`Trying Cobalt instance: ${instance.domain}`);
    
    const cobaltResp = await fetch(cobaltUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000,
      body: JSON.stringify(reqBody),
    } as any);

    if (!cobaltResp.ok) {
      throw new Error(`Cobalt returned ${cobaltResp.status}`);
    }

    const data: CobaltResponse = await cobaltResp.json();

    if (data.error) {
      throw new Error(`Cobalt error: ${data.error}`);
    }

    if (!data.url) {
      throw new Error('No download URL in response');
    }

    console.log(`SUCCESS from ${instance.domain}!`);
    return data;
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
          const headResp = await fetch(result.url, {
            method: 'HEAD',
            timeout: 5000,
          } as any);
          
          if (headResp.ok || headResp.status === 206) {
            console.log(`Download URL verified: ${result.url.slice(0, 80)}`);
            return result.url;
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
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://cobalt.tools/',
      'Range': 'bytes=0-',
    },
    timeout: 30000,
  } as any);

  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status}`);
  }

  if (!resp.body) {
    throw new Error('No response body');
  }

  return resp.body as any;
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
