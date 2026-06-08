export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export function isValidYouTubeUrl(url: string): boolean {
  return getYouTubeVideoId(url) !== null;
}

export function isValidYouTubePlaylistUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
    return (host === 'youtube.com' || host === 'music.youtube.com') && Boolean(parsed.searchParams.get('list'));
  } catch {
    return /(?:youtube\.com|music\.youtube\.com)\/.*[?&]list=[0-9A-Za-z_-]+/.test(trimmed);
  }
}

export function getYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return /^[0-9A-Za-z_-]{11}$/.test(id || '') ? id : null;
    }

    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const watchId = parsed.searchParams.get('v');
      if (/^[0-9A-Za-z_-]{11}$/.test(watchId || '')) return watchId;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const possibleId = parts.find((part, index) =>
        ['shorts', 'embed', 'live'].includes(parts[index - 1]) && /^[0-9A-Za-z_-]{11}$/.test(part)
      );
      return possibleId || null;
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([0-9A-Za-z_-]{11})/);
    return match?.[1] || null;
  }

  return null;
}
