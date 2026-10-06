'use client';
import { useState, useEffect, useRef } from 'react';
import { MonitorPlay } from 'lucide-react';
import api, { videoApi, videoApiUrl } from '@/lib/api';
import { pollConversion, describeFailure } from '@/lib/conversion';
import { formatFileSize } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgressCircle from '@/components/ProgressCircle';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import { useAuthStore } from '@/lib/store';
import AnimeReveal from '@/components/AnimeReveal';
import AnimeHover from '@/components/AnimeHover';

import PageHeader from '@/components/ui/PageHeader';
import ToolPanel from '@/components/ui/ToolPanel';
import UrlInput from '@/components/ui/UrlInput';
import QualitySelector, { type QualityOption } from '@/components/ui/QualitySelector';
import CompletionCard from '@/components/ui/CompletionCard';
import ErrorDialog from '@/components/ui/ErrorDialog';

export default function UniversalPage() {
  const { user } = useAuthStore();
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('720p');
  const [preflightInfo, setPreflightInfo] = useState<{ title: string; thumbnail: string; resolution: string; sizeBytes: number } | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'uploading' | 'completed' | 'failed'>('idle');
  const [queuePosition, setQueuePosition] = useState(0);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ title?: string; thumbnail?: string; sizeBytes?: number; } | null>(null);
  const [error, setError] = useState('');
  const [conversionTime, setConversionTime] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const cancelPollRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryUrl = params.get('url');
      if (queryUrl) setUrl(queryUrl);
    }
  }, []);

  const poll = (id: string) => {
    cancelPollRef.current?.();
    cancelPollRef.current = pollConversion({
      client: videoApi,
      jobId: id,
      toAbsolute: videoApiUrl,
      intervalMs: 2500,
      handlers: {
        onQueued: (position) => {
          setStatus('queued');
          setQueuePosition(position);
        },
        onProgress: (value, snapshot) => {
          setStatus(snapshot.status === 'uploading' ? 'uploading' : 'processing');
          setProgress(value);
        },
        onCompleted: (downloadLink, snapshot) => {
          setStatus('completed');
          setProgress(100);
          if (startTimeRef.current) {
            setConversionTime(Math.round((Date.now() - startTimeRef.current) / 1000));
          }
          setVideoInfo({ title: snapshot.youtubeTitle, thumbnail: snapshot.youtubeThumbnail });
          setFileSize(snapshot.fileSize ?? null);
          setDownloadUrl(downloadLink);
          sendNotification('Download Complete! 🎉', 'Your video has finished downloading and is ready to save.');
        },
        onFailed: (failure) => {
          setStatus('failed');
          setError(failure.message);
          setCanRetry(failure.retriable);
        },
      },
    });
  };

  useEffect(() => () => cancelPollRef.current?.(), []);

  const handleCheckInfo = async () => {
    if (!url.startsWith('http')) { setError('Please enter a valid URL starting with http:// or https://'); return; }
    setError('');
    setCanRetry(false);
    setIsFetchingInfo(true);
    try {
      const { data } = await api.get(`/extractor/info?url=${encodeURIComponent(url)}`);
      const info = data.data;
      const bestVideo = info.formats?.video?.[0];
      setPreflightInfo({
        title: info.title || 'Video',
        thumbnail: info.thumbnail || '',
        resolution: bestVideo?.quality || 'Best Available',
        sizeBytes: bestVideo?.size ?? 0,
      });
    } catch (err: unknown) {
      const failure = describeFailure(err);
      setError(failure.message);
      setCanRetry(failure.retriable);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleDownload = async () => {
    startTimeRef.current = Date.now();
    if (!url.startsWith('http')) { setError('Please enter a valid URL starting with http:// or https://'); return; }
    requestNotificationPermission();
    setError(''); setCanRetry(false); setStatus('processing'); setProgress(0); setDownloadUrl(''); setConversionTime(null);
    try {
      const { data } = await videoApi.post('/convert/universal', { url, videoQuality: quality });
      setJobId(data.data.jobId);
      if (data.data.title) setVideoInfo({ title: data.data.title });
      poll(data.data.jobId);
    } catch (err: unknown) {
      setStatus('failed');
      const failure = describeFailure(err);
      setError(failure.message);
      setCanRetry(failure.retriable);
    }
  };

  const reset = () => {
    cancelPollRef.current?.();
    setUrl(''); setStatus('idle'); setProgress(0);
    setJobId(''); setDownloadUrl(''); setVideoInfo(null); setFileSize(null);
    setError(''); setCanRetry(false); setPreflightInfo(null); setConversionTime(null);
  };

  const qualityOptions: QualityOption<string>[] = ['360p', '480p', '720p', '1080p', '4K', '8K'].map(q => ({
    value: q,
    locked: (q === '4K' || q === '8K') && user?.role !== 'admin' && !user?.isPremium
  }));

  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        <PageHeader
          icon={<MonitorPlay className="w-5 h-5" />}
          eyebrow="Universal Downloader"
          title={
            <>
              Universal <span className="text-gradient">Downloader</span>
            </>
          }
          subtitle="Paste a link of Instagram, TikTok, Reddit, or any Video URL and download the video."
          accent="violet"
        />

        <AnimeReveal delay={100} direction="up" className="w-full mt-12">
          <ToolPanel accent="violet">
            {status === 'idle' || status === 'failed' ? (
              <div key="input" className="relative z-10 space-y-8 animate-in fade-in duration-300">
                
                <UrlInput
                  id="universal-url"
                  placeholder="https://www.instagram.com/p/..."
                  value={url}
                  onChange={(v) => { setUrl(v); setError(''); setPreflightInfo(null); }}
                  onEnter={() => {
                    if (preflightInfo) handleDownload();
                    else handleCheckInfo();
                  }}
                />

                <QualitySelector
                  label="VIDEO QUALITY"
                  options={qualityOptions}
                  value={quality}
                  onSelect={setQuality}
                  onLocked={() => alert('4K and 8K qualities are reserved for Premium users.')}
                />

                {preflightInfo && (
                  <div className="overflow-hidden rounded-2xl relative border border-white/10 w-full bg-black/40 mt-6 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="p-4 sm:p-6 flex flex-col items-center text-center gap-2">
                      <div className="w-16 h-16 bg-brand-cyan/10 rounded-full flex items-center justify-center mb-2 border border-brand-cyan/20">
                        <MonitorPlay className="w-8 h-8 text-cyan-400" />
                      </div>
                      <h3 className="text-base sm:text-xl font-bold text-white line-clamp-2">{preflightInfo.title}</h3>
                      {preflightInfo.sizeBytes > 0 && (
                        <div className="flex flex-wrap gap-2 sm:gap-4 text-sm font-medium mt-2">
                          <span className="bg-brand-cyan/10 px-4 py-2 rounded-xl text-brand-cyan border border-brand-cyan/20">
                            Actual Size: {formatFileSize(preflightInfo.sizeBytes)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-center mt-6">
                  {!preflightInfo ? (
                    <button
                      onClick={handleCheckInfo}
                      disabled={!url || isFetchingInfo}
                      className={`w-[280px] h-14 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${!url ? 'bg-white/5 text-white/40 cursor-not-allowed' : 'btn-primary'}`}
                    >
                      {isFetchingInfo ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Checking...
                        </>
                      ) : 'Check Video Info'}
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                      <AnimeHover scaleHover={1.02} scaleTap={0.96} className="w-full sm:w-[280px]">
                        <button
                          onClick={handleDownload}
                          disabled={!url}
                          className="w-full h-14 rounded-xl font-semibold text-lg transition-all duration-300 btn-primary"
                        >
                          Download Video
                        </button>
                      </AnimeHover>
                      <AnimeHover scaleHover={1.02} scaleTap={0.96} className="w-full sm:w-[200px]">
                        <button
                          onClick={reset}
                          className="w-full h-14 rounded-xl font-semibold text-base transition-all duration-300 glass-panel hover:bg-white/5 border border-white/20 text-white"
                        >
                          Convert Another
                        </button>
                      </AnimeHover>
                    </div>
                  )}
                </div>

              </div>
            ) : status === 'processing' || status === 'uploading' || status === 'queued' ? (
              <ProgressCircle
                progress={progress}
                statusText={status === 'queued' ? `Queued (Position: ${queuePosition})` : status === 'uploading' ? "Finalizing high-speed link..." : "Downloading Video..."}
                subText={status === 'queued' ? 'Waiting for other conversions to finish...' : status === 'uploading' ? "Generating high-speed CDN link" : "Fetching highest quality video securely"}
              />
            ) : (
              <CompletionCard
                accent="violet"
                heading="Video is Ready!"
                message={
                  <>
                    Your <strong className="text-violet-300">Highest Quality</strong> Video is ready to download.
                  </>
                }
                thumbnail={videoInfo?.thumbnail || preflightInfo?.thumbnail}
                mediaTitle={videoInfo?.title}
                fileSize={fileSize}
                conversionTime={conversionTime}
                downloadLabel="Download Video"
                onDownload={() => { if (downloadUrl) window.open(downloadUrl, '_blank'); }}
                resetLabel="Download Another"
                onReset={reset}
              />
            )}
          </ToolPanel>
        </AnimeReveal>

        <ErrorDialog
          open={!!error}
          title={canRetry ? 'Download Did Not Complete' : 'This Link Cannot Be Downloaded'}
          message={error}
          actionLabel={canRetry ? 'Try Again' : 'Try A Different Link'}
          onClose={() => { setError(''); setCanRetry(false); setStatus('idle'); }}
        />
      </div>
    </ProtectedRoute>
  );
}

