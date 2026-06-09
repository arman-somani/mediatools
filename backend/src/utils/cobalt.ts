// Ensure fetch and AbortController are available globally
declare const fetch: typeof global.fetch;
declare const AbortController: typeof global.AbortController;

interface CobaltInstance {
  domain: string;
  score: number;
  version: string;
  protocol?: string;
}

interface CobaltResponse {
  status?: 'tunnel' | 'redirect' | 'local-processing' | 'picker' | 'error';
  url?: string;
  tunnel?: string[];
  text?: string;
  error?: string | { code?: string; context?: unknown };
}

let instancesCache: { instances: CobaltInstance[], timestamp: number } | null = null;
const CACHE_TTL = 3600000; // 1 hour
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

function getConfiguredInstances(): CobaltInstance[] {
  return (process.env.COBALT_INSTANCES || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map((value, index) => {
      const parsed = value.match(/^(https?):\/\/(.+)$/i);
      return {
        domain: parsed ? parsed[2].replace(/\/$/, '') : value.replace(/\/$/, ''),
        protocol: parsed ? parsed[1].toLowerCase() : 'https',
        score: 100 - index,
        version: 'configured',
      };
    });
}

function normalizeRegistryInstance(item: any): CobaltInstance | null {
  if (item?.api) {
    const supportsYouTube = item.services?.youtube === true || item.services?.['youtube shorts'] === true;
    const needsAuth = item.info?.auth === true;
    if (!item.online || !supportsYouTube || needsAuth) return null;
    return {
      domain: String(item.api).replace(/\/$/, ''),
      protocol: item.protocol || 'https',
      score: Number(item.score || 0),
      version: String(item.version || 'unknown'),
    };
  }

  if (item?.domain) {
    return {
      domain: String(item.domain).replace(/\/$/, ''),
      protocol: 'https',
      score: Number(item.score || 0),
      version: String(item.version || 'unknown'),
    };
  }

  return null;
}

function cobaltBaseUrl(instance: CobaltInstance): string {
  return `${instance.protocol || 'https'}://${instance.domain}`;
}

function cobaltErrorMessage(error: CobaltResponse['error']): string {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  return error.code || JSON.stringify(error);
}

function cobaltAuthorizationHeader(): string | null {
  if (process.env.COBALT_AUTHORIZATION) return process.env.COBALT_AUTHORIZATION;
  if (process.env.COBALT_API_KEY) return `Api-Key ${process.env.COBALT_API_KEY}`;
  if (process.env.COBALT_BEARER_TOKEN) return `Bearer ${process.env.COBALT_BEARER_TOKEN}`;
  return null;
}

/**
 * Fetches available Cobalt instances from the registry
 */
async function fetchCobaltInstances(): Promise<CobaltInstance[]> {
  const now = Date.now();
  const configuredInstances = getConfiguredInstances();
  
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
      const resp = await fetch('https://instances.cobalt.best/api/instances.json', {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`Status ${resp.status}`);

      const data = (await resp.json()) as any[];
      
      // Filter for online, unauthenticated, YouTube-capable instances.
      const filtered = data
        .map(normalizeRegistryInstance)
        .filter((i): i is CobaltInstance => Boolean(i))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      // Cache the results
      const instances = [...configuredInstances, ...filtered];
      instancesCache = { instances, timestamp: now };
      console.log(`Fetched ${instances.length} Cobalt instances`);
      
      return instances;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  } catch (e: any) {
    console.error('Failed to fetch Cobalt instances:', e.message);
    
    // Return fallback hardcoded instances
    return [
      ...configuredInstances,
      { domain: 'cobalt-backend.canine.tools', score: 95, version: 'fallback', protocol: 'https' },
      { domain: 'capi.3kh0.net', score: 92, version: 'fallback', protocol: 'https' },
      { domain: 'cobalt-api.meowing.de', score: 90, version: 'fallback', protocol: 'https' },
      { domain: 'cobalt-api.kwiatekmiki.com', score: 85, version: 'fallback', protocol: 'https' },
      { domain: 'api.cobalt.tools', score: 60, version: 'fallback', protocol: 'https' },
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
    const cobaltUrl = `${cobaltBaseUrl(instance)}/`;
    
    const reqBody: any = {
      url,
      filenameStyle: 'pretty',
    };

    if (format === 'audio') {
      reqBody.downloadMode = 'audio';
      reqBody.audioFormat = 'mp3';
      reqBody.audioBitrate = quality || '192';
    } else {
      reqBody.downloadMode = 'auto';
      reqBody.videoQuality = normalizeVideoQuality(quality);
      reqBody.youtubeVideoCodec = 'h264';
      reqBody.youtubeVideoContainer = 'mp4';
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
          'User-Agent': USER_AGENT,
          ...(cobaltAuthorizationHeader() ? { Authorization: cobaltAuthorizationHeader() as string } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify(reqBody),
      });

      clearTimeout(timeoutId);

      if (!cobaltResp.ok) {
        let body = '';
        try { body = await cobaltResp.text(); } catch { /* ignore */ }
        throw new Error(`Cobalt returned ${cobaltResp.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
      }

      const data = (await cobaltResp.json()) as CobaltResponse;

      if (data.status === 'error' || data.error) {
        throw new Error(`Cobalt error: ${cobaltErrorMessage(data.error)}`);
      }

      const downloadUrl = data.url || (Array.isArray(data.tunnel) ? data.tunnel[0] : undefined);

      if (!downloadUrl) {
        throw new Error('No download URL in response');
      }

      console.log(`SUCCESS from ${instance.domain}!`);
      return { ...data, url: downloadUrl };
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
