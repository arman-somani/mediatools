'use client';

import { useEffect, useRef, useState } from 'react';
import type { AxiosInstance } from 'axios';

/**
 * Live view of the server-wide conversion queue.
 *
 * Conversions run strictly one at a time, so while someone else is
 * downloading, every new user waits. This hook polls GET /convert/queue and
 * lets the UI say so honestly — "now downloading <title>, you are next" —
 * instead of leaving people to guess why their job has not started.
 *
 * Polling is best-effort: this panel is informational, so any failure
 * (cold start, timeout, restart) is swallowed and simply leaves the last
 * known state on screen.
 */

export interface QueueCurrentJob {
  id: string;
  title: string;
  type: string;
  progress: number;
  startedAt: number;
}

export interface ServerQueueState {
  busy: boolean;
  waiting: number;
  current: QueueCurrentJob | null;
}

const INITIAL: ServerQueueState = { busy: false, waiting: 0, current: null };

export function useServerQueue({
  client,
  intervalMs = 6000,
  enabled = true,
}: {
  client: AxiosInstance;
  intervalMs?: number;
  enabled?: boolean;
}): ServerQueueState {
  const [state, setState] = useState<ServerQueueState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Timeout chain like pollConversion: setInterval would overlap requests
    // on a cold-starting instance and stack them until they all time out.
    const tick = async () => {
      try {
        const { data } = await client.get('/convert/queue');
        if (cancelled) return;
        const snapshot = data?.data as ServerQueueState | undefined;
        if (snapshot && typeof snapshot.busy === 'boolean') {
          setState(snapshot);
        }
        timer = setTimeout(tick, intervalMs);
      } catch {
        if (cancelled) return;
        // Back off and retry quietly; keep showing the last known state.
        timer = setTimeout(tick, Math.min(intervalMs * 2, 15_000));
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, intervalMs, enabled]);

  return state;
}
