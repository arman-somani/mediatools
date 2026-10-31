'use client';
import { useEffect, useRef } from 'react';
import api from '@/lib/api';
import { useServerStore } from '@/lib/store';

export default function ServerWakeup() {
  const { setServerReady, setHasCheckedServer } = useServerStore();
  const checking = useRef(false);

  useEffect(() => {
    if (checking.current) return;
    checking.current = true;
    
    let isMounted = true;
    let pollTimer: NodeJS.Timeout | null = null;
    let keepAliveTimer: NodeJS.Timeout | null = null;

    const pingServer = async () => {
      try {
        await api.get('/health', { timeout: 8000 });
        if (isMounted) {
          setServerReady(true);
          setHasCheckedServer(true);
        }
      } catch {
        if (isMounted) {
          // Keep polling every 4 seconds until server wakes up
          pollTimer = setTimeout(pingServer, 4000);
        }
      }
    };

    pingServer();

    // While any tab is open, keep sending a heartbeat every 4 minutes so the cloud backend stays warm
    keepAliveTimer = setInterval(() => {
      api.get('/health', { timeout: 10000 }).catch(() => {});
    }, 4 * 60 * 1000);

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    };
  }, [setServerReady, setHasCheckedServer]);

  return null;
}
