'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Globe, LoaderCircle, MonitorPlay } from 'lucide-react';
import api, { videoApi, videoApiUrl } from '@/lib/api';
import { describeFailure, type FailureInfo } from '@/lib/conversion';
import { formatFileSize } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { useConversionJob, isRunning } from '@/lib/useConversionJob';
import { useServerQueue } from '@/lib/useServerQueue';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';

import PageHeader from '@/components/ui/PageHeader';
import ToolPanel from '@/components/ui/ToolPanel';
import UrlInput from '@/components/ui/UrlInput';
import QualitySelector, { type QualityOption } from '@/components/ui/QualitySelector';
import CompletionCard from '@/components/ui/CompletionCard';
import FailureNotice from '@/components/ui/FailureNotice';
import QueuePanel from '@/components/ui/QueuePanel';
import ProgressMeter from '@/components/ProgressMeter';

interface PreflightInfo {
  title: string;
  thumbnail: string;
  resolution: string;
  sizeBytes: number;
}

const STAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  sending: { title: 'Starting the job…', subtitle: 'Handing your link to the download worker.' },
  queued: { title: 'Waiting for a free worker', subtitle: 'Jobs run in the order they arrive — usually a short wait.' },
  processing: { title: 'Downloading the video', subtitle: 'Pulling the best stream for the quality you picked.' },
  finalizing: { title: 'Almost there', subtitle: 'Generating a high-speed download link.' },
};

export default function UniversalPage() {
  const { user } = useAuthStore();
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('720p');
  const [preflight, setPreflight] = useState<PreflightInfo | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [preflightError, setPreflightError] = useState<FailureInfo | null>(null);

  const { state, start, reset } = useConversionJob({
    client: videoApi,
    toAbsolute: videoApiUrl,
    intervalMs: 1200,
    notification: { title: 'Download complete', body: 'Your video has finished downloading and is ready to save.' },
  });

  // Server-wide queue view: shows what the single worker is doing right now.
  const serverQueue = useServerQueue({
    client: videoApi,
    enabled: state.phase !== 'processing' && state.phase !== 'finalizing',
  });

  // While our own job is queued, the meter's subtitle names the job ahead of us.
  const queuedSubtitle = serverQueue.busy && serverQueue.current
    ? `Now downloading: ${serverQueue.current.title} · ${Math.round(serverQueue.current.progress)}% — you are next.`
    : STAGE_COPY.queued.subtitle;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryUrl = params.get('url');
    if (queryUrl) setUrl(queryUrl);
  }, []);

  const handleCheckInfo = async () => {
    if (!url.startsWith('http')) {
      setPreflightError({ code: 'UNKNOWN', message: 'Enter a URL starting with http:// or https://', retriable: true });
      return;
    }
    setPreflightError(null);
    setIsFetchingInfo(true);
    try {
      const { data } = await api.get(`/extractor/info?url=${encodeURIComponent(url)}`);
      const info = data.data;
      const bestVideo = info.formats?.video?.[0];
      setPreflight({
        title: info.title || 'Video',
        thumbnail: info.thumbnail || '',
        resolution: bestVideo?.quality || 'Best available',
        sizeBytes: bestVideo?.size ?? 0,
      });
    } catch (err: unknown) {
      setPreflightError(describeFailure(err));
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleDownload = () => {
    if (!url.startsWith('http')) {
      setPreflightError({ code: 'UNKNOWN', message: 'Enter a URL starting with http:// or https://', retriable: true });
      return;
    }
    start(async ({ signal }) => {
      const { data } = await videoApi.post('/convert/universal', { url, videoQuality: quality }, { signal });
      return { jobId: data.data.jobId, title: data.data.title };
    });
  };

  const qualityOptions: QualityOption<string>[] = ['360p', '480p', '720p', '1080p', '4K', '8K'].map((q) => ({
    value: q,
    locked: (q === '4K' || q === '8K') && user?.role !== 'admin' && !user?.isPremium,
  }));

  return (
    <ProtectedRoute>
      <PageWrapper>
        <div className="w-full max-w-3xl mx-auto px-6 py-20 md:py-28">
          <PageHeader
            index="004"
            label="UNIVERSAL DOWNLOADER"
            title="Any platform, one box."
            subtitle="Instagram, TikTok, Twitter/X, Reddit and more. Paste the link, check the preview, download."
          />

          <AnimeReveal delay={80} direction="up" className="mt-12">
            <ToolPanel>
              {state.phase === 'completed' ? (
                <CompletionCard
                  heading="Video is ready"
                  thumbnail={state.thumbnail}
                  mediaTitle={state.title}
                  fileSize={state.fileSize}
                  durationSec={state.durationSec}
                  downloadUrl={state.downloadUrl}
                  downloadLabel="Download video"
                  onDownload={() => window.open(state.downloadUrl, '_blank')}
                  resetLabel="Download another"
                  onReset={() => {
                    setUrl('');
                    setPreflight(null);
                    reset();
                  }}
                />
              ) : isRunning(state.phase) ? (
                <ProgressMeter
                  phase={state.phase}
                  progress={state.progress}
                  queuePosition={state.queuePosition}
                  title={STAGE_COPY[state.phase]?.title ?? 'Working…'}
                  subtitle={state.phase === 'queued' && !state.title ? queuedSubtitle : (state.title || STAGE_COPY[state.phase]?.subtitle || '')}
                />
              ) : (
                <div className="space-y-7">
                  <QueuePanel queue={serverQueue} />
                  {state.phase === 'failed' && state.error && (
                    <FailureNotice failure={state.error} onDismiss={() => reset()} />
                  )}
                  {state.phase !== 'failed' && preflightError && (
                    <FailureNotice failure={preflightError} onDismiss={() => setPreflightError(null)} />
                  )}

                  <UrlInput
                    id="universal-url"
                    placeholder="https://www.instagram.com/p/…"
                    value={url}
                    onChange={(v) => {
                      setUrl(v);
                      setPreflight(null);
                      setPreflightError(null);
                    }}
                    onEnter={() => (preflight ? handleDownload() : handleCheckInfo())}
                  />

                  <QualitySelector
                    label="VIDEO QUALITY"
                    options={qualityOptions}
                    value={quality}
                    onSelect={setQuality}
                    onLocked={() => toast('4K and 8K are reserved for Premium accounts.')}
                  />

                  {preflight && (
                    <div className="card-inset p-5 flex items-center gap-4 anim-fade-up">
                      {preflight.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preflight.thumbnail}
                          alt=""
                          className="w-24 sm:w-32 aspect-video rounded-md object-cover border border-line shrink-0 bg-black/40"
                        />
                      ) : (
                        <span className="tile tile-lg shrink-0">
                          <MonitorPlay className="w-6 h-6" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="mono-label !text-[10px] mb-1">PREVIEW · {preflight.resolution.toUpperCase()}</p>
                        <h3 className="text-base font-semibold text-fg line-clamp-2 leading-snug">{preflight.title}</h3>
                        {preflight.sizeBytes > 0 && (
                          <p className="mono-label mt-1.5 !text-[10px]">{formatFileSize(preflight.sizeBytes).toUpperCase()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    {!preflight ? (
                      <button onClick={handleCheckInfo} disabled={!url || isFetchingInfo} className="btn-primary btn-lg sm:w-56">
                        {isFetchingInfo ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                        {isFetchingInfo ? 'Checking…' : 'Check video info'}
                      </button>
                    ) : (
                      <>
                        <button onClick={handleDownload} className="btn-primary btn-lg flex-1">
                          Download video
                        </button>
                        <button
                          onClick={() => {
                            setUrl('');
                            setPreflight(null);
                            reset();
                          }}
                          className="btn-secondary btn-lg sm:w-44"
                        >
                          Start over
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </ToolPanel>
          </AnimeReveal>
        </div>
      </PageWrapper>
    </ProtectedRoute>
  );
}
