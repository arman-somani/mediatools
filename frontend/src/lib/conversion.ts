import type { AxiosInstance } from 'axios';

/**
 * Conversion job polling, in one place.
 *
 * The converter, youtube, yt-video and universal pages each carried their own
 * copy of this loop. The copies had drifted, but they shared one defect:
 *
 *     } catch { clearInterval(pollRef.current!); }
 *
 * Any failure at all — a dropped connection, a cold-start timeout, a 500 —
 * silently stopped polling and left the UI sitting on "processing" forever with
 * no message and no way forward. That single line is the "it just hangs"
 * symptom. A transient error has to be retried and a terminal one has to be
 * reported; swallowing both is the one option that cannot work.
 *
 * This module also owns the distinction between the two kinds of failure the
 * API now reports, so every page explains itself the same way.
 */

/** Status values the API reports for a conversion. */
export type JobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'uploading'
  | 'completed'
  | 'failed';

export interface ConversionSnapshot {
  jobId: string;
  status: JobStatus;
  progress: number;
  queuePosition: number;
  fileSize: number | null;
  /** The quality actually produced, which can be lower than the one requested. */
  videoQuality?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
  errorMessage?: string;
  /** Signed, expiring download link. Issued by the API, never built by hand. */
  downloadUrl: string | null;
  gofileUrl: string | null;
  cdnUrl: string | null;
}

/** The API's typed extraction failure codes. */
export type FailureCode =
  | 'BOT_CHECK'
  | 'RATE_LIMITED'
  | 'AGE_RESTRICTED'
  | 'PRIVATE'
  | 'MEMBERS_ONLY'
  | 'GEO_BLOCKED'
  | 'UNAVAILABLE'
  | 'NOT_YET_AVAILABLE'
  | 'LIVE_STREAM'
  | 'FORMAT_UNAVAILABLE'
  | 'UNSUPPORTED_URL'
  | 'TOO_LONG'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Plain-language copy for each failure, written to tell the user whether the
 * problem is theirs, the video's, or ours, and whether retrying is worth it.
 * A generic "Conversion failed" for all fifteen cases is what made the site
 * feel broken even when it was behaving correctly.
 */
const FAILURE_COPY: Record<FailureCode, string> = {
  BOT_CHECK:
    'YouTube is asking this server to prove it is not a bot, so it refused the download. '
    + 'This is tied to the server address rather than to you or this video. Trying again in a few minutes sometimes works.',
  RATE_LIMITED:
    'YouTube is temporarily rate-limiting this server. Please wait a few minutes and try again.',
  AGE_RESTRICTED:
    'This video is age-restricted and cannot be downloaded without a signed-in YouTube session.',
  PRIVATE: 'This video is private, so it cannot be accessed.',
  MEMBERS_ONLY: 'This video is for channel members only.',
  GEO_BLOCKED: 'This video is not available in the region where this server runs.',
  UNAVAILABLE: 'This video has been removed or does not exist.',
  NOT_YET_AVAILABLE: 'This is a scheduled premiere that has not started yet.',
  LIVE_STREAM:
    'This is a live stream. Downloads are only supported once the stream has ended and been processed.',
  FORMAT_UNAVAILABLE:
    'No downloadable version of this video was offered in the quality you asked for. Try a lower quality.',
  UNSUPPORTED_URL: 'That link is not one we can download from. Check the URL and try again.',
  TOO_LONG: 'This video is longer than the maximum this service allows.',
  NETWORK:
    'The server could not reach YouTube. This is usually temporary — please try again.',
  TIMEOUT: 'The download took too long and was stopped. Shorter or lower-quality files are more reliable.',
  UNKNOWN: 'The download failed for an unexpected reason. Please try again.',
};

/** Failures where retrying the same request has a realistic chance. */
const RETRIABLE: ReadonlySet<FailureCode> = new Set<FailureCode>([
  'BOT_CHECK',
  'RATE_LIMITED',
  'NETWORK',
  'TIMEOUT',
  'UNKNOWN',
]);

export interface FailureInfo {
  code: FailureCode;
  message: string;
  retriable: boolean;
}

interface ApiErrorShape {
  response?: { status?: number; data?: { code?: string; message?: string; retriable?: boolean } };
  code?: string;
  message?: string;
}

/** Turns anything thrown by axios into something worth showing a user. */
export function describeFailure(error: unknown): FailureInfo {
  const err = error as ApiErrorShape;
  const body = err?.response?.data;

  const rawCode = body?.code;
  if (rawCode && rawCode in FAILURE_COPY) {
    const code = rawCode as FailureCode;
    return {
      code,
      message: body?.message || FAILURE_COPY[code],
      retriable: body?.retriable ?? RETRIABLE.has(code),
    };
  }

  // Axios surfaces its own timeout as ECONNABORTED/ETIMEDOUT with no response.
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
    return { code: 'TIMEOUT', message: FAILURE_COPY.TIMEOUT, retriable: true };
  }

  const status = err?.response?.status;
  if (status === undefined) {
    return {
      code: 'NETWORK',
      message: 'Could not reach the server. Check your connection and try again.',
      retriable: true,
    };
  }
  if (status === 401) {
    return { code: 'UNKNOWN', message: 'Your session has expired. Please sign in again.', retriable: false };
  }
  if (status === 403) {
    return { code: 'UNKNOWN', message: body?.message || 'You do not have access to this item.', retriable: false };
  }
  if (status === 404) {
    return { code: 'UNAVAILABLE', message: body?.message || 'This job no longer exists.', retriable: false };
  }
  if (status === 410) {
    return {
      code: 'UNKNOWN',
      message: 'That download link has expired. Please run the conversion again.',
      retriable: false,
    };
  }
  if (status === 429) {
    return { code: 'RATE_LIMITED', message: body?.message || FAILURE_COPY.RATE_LIMITED, retriable: true };
  }
  if (status >= 500) {
    return { code: 'NETWORK', message: body?.message || FAILURE_COPY.NETWORK, retriable: true };
  }
  return { code: 'UNKNOWN', message: body?.message || FAILURE_COPY.UNKNOWN, retriable: false };
}

/** Copy for a status the API reported as `failed`. */
export function describeJobFailure(snapshot: ConversionSnapshot): FailureInfo {
  const raw = snapshot.errorMessage || '';
  const match = (Object.keys(FAILURE_COPY) as FailureCode[]).find(code => raw.includes(code));
  if (match) {
    return { code: match, message: FAILURE_COPY[match], retriable: RETRIABLE.has(match) };
  }
  return { code: 'UNKNOWN', message: raw || FAILURE_COPY.UNKNOWN, retriable: true };
}

export interface PollHandlers {
  /** Fired on every successful poll, before the status-specific handler. */
  onSnapshot?: (snapshot: ConversionSnapshot) => void;
  onQueued?: (queuePosition: number, snapshot: ConversionSnapshot) => void;
  onProgress?: (progress: number, snapshot: ConversionSnapshot) => void;
  /** `downloadUrl` is absolute and already carries its signature. */
  onCompleted: (downloadUrl: string, snapshot: ConversionSnapshot) => void;
  onFailed: (failure: FailureInfo, snapshot?: ConversionSnapshot) => void;
}

export interface PollOptions {
  client: AxiosInstance;
  jobId: string;
  /** Makes an API-relative path absolute for the correct backend host. */
  toAbsolute: (path: string) => string;
  handlers: PollHandlers;
  intervalMs?: number;
  /** Give up after this long rather than polling a stuck job forever. */
  maxDurationMs?: number;
  /** Consecutive transient failures tolerated before reporting one. */
  maxTransientFailures?: number;
}

/**
 * Polls a conversion until it finishes, fails, or the deadline passes.
 *
 * Returns a cancel function; call it from a React cleanup so a job stops being
 * polled when the component unmounts.
 */
export function pollConversion(options: PollOptions): () => void {
  const {
    client,
    jobId,
    toAbsolute,
    handlers,
    intervalMs = 1500,
    maxDurationMs = 20 * 60 * 1000,
    maxTransientFailures = 5,
  } = options;

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let transientFailures = 0;
  const startedAt = Date.now();

  const stop = () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  // A timeout chain rather than setInterval. With setInterval, a poll slower
  // than the interval overlaps the next one, and on a cold-starting free
  // instance that stacks requests until they all time out together.
  const schedule = () => {
    if (cancelled) return;
    timer = setTimeout(tick, intervalMs);
  };

  const tick = async () => {
    if (cancelled) return;

    if (Date.now() - startedAt > maxDurationMs) {
      stop();
      handlers.onFailed({
        code: 'TIMEOUT',
        message: 'This conversion is taking much longer than expected and has been stopped. '
          + 'Please try again, or try a lower quality.',
        retriable: true,
      });
      return;
    }

    try {
      const { data } = await client.get(`/convert/status/${encodeURIComponent(jobId)}`);
      if (cancelled) return;

      const snapshot = data?.data as ConversionSnapshot | undefined;
      if (!snapshot) throw new Error('Malformed status response');

      transientFailures = 0;
      handlers.onSnapshot?.(snapshot);

      const progress = Math.round(Number(snapshot.progress) || 0);

      if (snapshot.status === 'completed') {
        stop();
        // Prefer whatever the API issued. Building `/api/convert/download/<id>`
        // on the client used to work only because that endpoint had no
        // authorisation at all; it now requires the signed link that arrives
        // here, so a hand-built URL is rejected.
        const link = snapshot.downloadUrl || snapshot.cdnUrl || snapshot.gofileUrl;
        if (!link) {
          handlers.onFailed({
            code: 'UNKNOWN',
            message: 'The conversion finished but no download link was returned. Please try again.',
            retriable: true,
          }, snapshot);
          return;
        }
        handlers.onCompleted(link.startsWith('http') ? link : toAbsolute(link), snapshot);
        return;
      }

      if (snapshot.status === 'failed') {
        stop();
        handlers.onFailed(describeJobFailure(snapshot), snapshot);
        return;
      }

      if (snapshot.status === 'queued') {
        handlers.onQueued?.(Number(snapshot.queuePosition) || 0, snapshot);
      } else {
        handlers.onProgress?.(progress, snapshot);
      }

      schedule();
    } catch (error) {
      if (cancelled) return;

      const failure = describeFailure(error);

      // Terminal: the job is gone or we are not allowed to see it. Retrying
      // cannot change the answer.
      if (!failure.retriable) {
        stop();
        handlers.onFailed(failure);
        return;
      }

      // Transient: a blip while a long conversion runs should not throw away
      // the job. Back off and keep watching, and only surface an error once it
      // is clear the server is genuinely not answering.
      transientFailures += 1;
      if (transientFailures >= maxTransientFailures) {
        stop();
        handlers.onFailed({
          ...failure,
          message: `${failure.message} (the server stopped responding after ${transientFailures} attempts)`,
        });
        return;
      }

      timer = setTimeout(tick, Math.min(intervalMs * 2 ** transientFailures, 15_000));
    }
  };

  void tick();
  return stop;
}
