'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { pollConversion, describeFailure, type FailureInfo } from '@/lib/conversion';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';

/**
 * Client-side lifecycle of one conversion job.
 *
 *  idle → sending → (queued) → processing → finalizing → completed
 *                                                      ↘ failed
 *
 * `sending`    the request (and, for local files, the upload) is in flight
 * `finalizing` the server reports `uploading`, i.e. it is pushing the result to storage
 */
export type JobPhase = 'idle' | 'sending' | 'queued' | 'processing' | 'finalizing' | 'completed' | 'failed';

export interface JobState {
  phase: JobPhase;
  progress: number;
  queuePosition: number;
  startedAt: number | null;
  durationSec: number | null;
  downloadUrl: string;
  fileSize: number | null;
  title?: string;
  thumbnail?: string;
  producedQuality?: string;
  error: FailureInfo | null;
}

export interface StartResult {
  jobId: string;
  title?: string;
  thumbnail?: string;
}

export type StartFn = (ctx: {
  reportUpload: (pct: number) => void;
  signal: AbortSignal;
}) => Promise<StartResult>;

interface Options {
  client: AxiosInstance;
  toAbsolute: (path: string) => string;
  intervalMs?: number;
  notification: { title: string; body: string };
}

const INITIAL: JobState = {
  phase: 'idle',
  progress: 0,
  queuePosition: 0,
  startedAt: null,
  durationSec: null,
  downloadUrl: '',
  fileSize: null,
  error: null,
};

export const isRunning = (p: JobPhase) => p === 'sending' || p === 'queued' || p === 'processing' || p === 'finalizing';

export function useConversionJob({ client, toAbsolute, intervalMs, notification }: Options) {
  const [state, setState] = useState<JobState>(INITIAL);
  const cancelPollRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const baseTitleRef = useRef<string>('');

  const stopAll = useCallback(() => {
    cancelPollRef.current?.();
    cancelPollRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // Mirror progress in the browser tab so users can switch away while waiting.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!baseTitleRef.current) baseTitleRef.current = document.title;
    const base = baseTitleRef.current;
    if (isRunning(state.phase)) {
      const pct = state.phase === 'queued' ? 'Queued' : `${Math.round(state.progress)}%`;
      document.title = `${pct} · ${base}`;
    } else if (state.phase === 'completed') {
      document.title = `Ready · ${base}`;
    } else {
      document.title = base;
    }
  }, [state.phase, state.progress]);

  useEffect(() => () => {
    if (baseTitleRef.current) document.title = baseTitleRef.current;
  }, []);

  const start = useCallback(async (fn: StartFn) => {
    stopAll();
    requestNotificationPermission();
    const startedAt = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...INITIAL, phase: 'sending', startedAt });

    let result: StartResult;
    try {
      result = await fn({
        signal: controller.signal,
        reportUpload: (pct) => setState((s) => (s.phase === 'sending' ? { ...s, progress: pct } : s)),
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState((s) => ({ ...s, phase: 'failed', error: describeFailure(err) }));
      return;
    }
    if (controller.signal.aborted) return;
    abortRef.current = null;

    setState((s) => ({
      ...s,
      phase: 'processing',
      progress: 0,
      title: result.title ?? s.title,
      thumbnail: result.thumbnail ?? s.thumbnail,
    }));

    cancelPollRef.current = pollConversion({
      client,
      jobId: result.jobId,
      toAbsolute,
      intervalMs,
      handlers: {
        onQueued: (position) => setState((s) => ({ ...s, phase: 'queued', queuePosition: position })),
        onProgress: (value, snap) =>
          setState((s) => ({
            ...s,
            phase: snap.status === 'uploading' ? 'finalizing' : 'processing',
            progress: value,
          })),
        onCompleted: (url, snap) => {
          setState((s) => ({
            ...s,
            phase: 'completed',
            progress: 100,
            downloadUrl: url,
            fileSize: snap.fileSize ?? null,
            title: snap.youtubeTitle || s.title,
            thumbnail: snap.youtubeThumbnail || s.thumbnail,
            producedQuality: snap.videoQuality,
            durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
          }));
          sendNotification(notification.title, notification.body);
        },
        onFailed: (failure) => setState((s) => ({ ...s, phase: 'failed', error: failure })),
      },
    });
  }, [client, toAbsolute, intervalMs, notification.title, notification.body, stopAll]);

  /** Stop tracking the job and return to the form. */
  const cancel = useCallback(() => {
    stopAll();
    setState(INITIAL);
  }, [stopAll]);

  /** Close the error but keep the user's inputs. */
  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, phase: 'idle', error: null }));
  }, []);

  return { state, start, cancel, reset: cancel, dismissError };
}
