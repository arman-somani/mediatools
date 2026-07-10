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

    const pingServer = async () => {
      try {
        await api.get('/health', { timeout: 5000 });
        if (isMounted) {
          setServerReady(true);
          setHasCheckedServer(true);
        }
      } catch (error) {
        if (isMounted) {
          // Keep polling every 5 seconds until server wakes up
          setTimeout(pingServer, 5000);
        }
      }
    };

    pingServer();

    return () => {
      isMounted = false;
    };
  }, [setServerReady, setHasCheckedServer]);

  return null;
}
