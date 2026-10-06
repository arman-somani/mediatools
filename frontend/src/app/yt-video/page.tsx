'use client';
import { useState, useEffect, useRef } from 'react';
import { YouTubeIcon } from '@/components/icons';
import api, { videoApi, videoApiUrl } from '@/lib/api';
import { pollConversion, describeFailure } from '@/lib/conversion';
import { isValidYouTubeUrl, getYouTubeVideoId, formatFileSize } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgressCircle from '@/components/ProgressCircle';
import AnimeReveal from '@/components/AnimeReveal';
import AnimeHover from '@/components/AnimeHover';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import { useAuthStore } from '@/lib/store';

import PageHeader from '@/components/ui/PageHeader';
import ToolPanel from '@/components/ui/ToolPanel';
import UrlInput, { YouTubeSearchResults, YouTubePreview } from '@/components/ui/UrlInput';
import QualitySelector, { type QualityOption } from '@/components/ui/QualitySelector';
import CompletionCard from '@/components/ui/CompletionCard';
import ErrorDialog from '@/components/ui/ErrorDialog';

type VideoQuality = '360p' | '480p' | '720p' | '1080p' | '4K' | '8K';

export default function YtVideoPage() {
  const { user } = useAuthStore();
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<VideoQuality>('720p');
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'uploading' | 'completed' | 'downloading' | 'failed'>('idle');
  const [queuePosition, setQueuePosition] = useState(0);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [conversionTime, setConversionTime] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState<{ title?: string; thumbnail?: string } | null>(null);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const startTimeRef = useRef<number | null>(null);
  const cancelPollRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryUrl = params.get('url');
      if (queryUrl) setUrl(queryUrl);
    }
  }, []);

  useEffect(() => {
    if (!url || isValidYouTubeUrl(url)) {
      setSearchResults([]);
      return;
    }
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get(`/search/youtube?q=${encodeURIComponent(url)}`);
        setSearchResults(data.data || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [url]);

  const videoId = url ? getYouTubeVideoId(url) : null;
  const thumbnailPreview = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

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
        onCompleted: (url, snapshot) => {
          setStatus('completed');
          setProgress(100);
          if (startTimeRef.current) {
            setConversionTime(Math.round((Date.now() - startTimeRef.current) / 1000));
          }
          setVideoInfo({ title: snapshot.youtubeTitle, thumbnail: snapshot.youtubeThumbnail });
          if (snapshot.videoQuality) setQuality(snapshot.videoQuality as typeof quality);
          setFileSize(snapshot.fileSize ?? null);
          setDownloadUrl(url);
          sendNotification('Video Ready! 🎬', 'Your video file has finished converting and is ready to save.');
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

  const handleDownload = async () => {
    startTimeRef.current = Date.now();
    if (!isValidYouTubeUrl(url)) { setError('Please enter a valid YouTube URL'); return; }
    requestNotificationPermission();
    setError(''); setCanRetry(false); setStatus('processing'); setProgress(0); setDownloadUrl(''); setConversionTime(null);
    try {
      const { data } = await videoApi.post('/convert/universal', { url, videoQuality: quality, type: 'youtube-Video' });

      if (data.success && data.data?.jobId) {
        setJobId(data.data.jobId);
        poll(data.data.jobId);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: unknown) {
      setStatus('failed');
      const failure = describeFailure(err);
      setError(failure.message);
      setCanRetry(failure.retriable);
    }
  };

  const downloadFile = () => {
    if (downloadUrl) window.open(downloadUrl, '_blank');
  };

  const reset = () => {
    cancelPollRef.current?.();
    setUrl(''); setStatus('idle'); setProgress(0);
    setJobId(''); setDownloadUrl(''); setVideoInfo(null); setFileSize(null);
    setError(''); setCanRetry(false); setConversionTime(null);
  };

  const qualityOptions: QualityOption<VideoQuality>[] = ['360p', '480p', '720p', '1080p', '4K', '8K'].map(q => ({
    value: q as VideoQuality,
    locked: (q === '4K' || q === '8K') && user?.role !== 'admin' && !user?.isPremium
  }));

  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        <PageHeader
          icon={<YouTubeIcon className="w-5 h-5" />}
          eyebrow="YouTube Video"
          title={
            <>
              Download <span className="text-gradient">YouTube Video</span>
            </>
          }
          subtitle="Paste any YouTube Video Link, select preferred quality, and download the full video file."
          accent="cyan"
        />

        <AnimeReveal delay={100} direction="up" className="w-full mt-12">
          <ToolPanel accent="cyan">
            {status === 'idle' || status === 'failed' ? (
              <div key="input" className="relative z-10 space-y-8 flex-1 animate-in fade-in duration-300">
                
                <UrlInput
                  id="yt-video-url"
                  placeholder="Search YouTube or paste URL..."
                  value={url}
                  onChange={(v) => { setUrl(v); setError(''); }}
                  onEnter={handleDownload}
                  searchable
                >
                  {(isSearching || searchResults.length > 0) && !isValidYouTubeUrl(url) && url.length > 2 && (
                    <YouTubeSearchResults
                      isSearching={isSearching}
                      results={searchResults}
                      onPick={(id) => {
                        setUrl(`https://www.youtube.com/watch?v=${id}`);
                        setSearchResults([]);
                      }}
                    />
                  )}
                </UrlInput>

                {thumbnailPreview && url && (
                  <YouTubePreview src={thumbnailPreview} />
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <QualitySelector
                      label="VIDEO QUALITY"
                      options={qualityOptions}
                      value={quality}
                      onSelect={setQuality}
                      onLocked={() => alert('4K and 8K qualities are reserved for Premium users.')}
                    />
                  </div>

                  <div className="flex flex-col justify-start">
                    <label className="quality-label opacity-0 select-none">BTN</label>
                    <AnimeHover scaleHover={url ? 1.02 : 1} scaleTap={url ? 0.96 : 1}>
                      <button
                        onClick={handleDownload}
                        disabled={!url}
                        className={`w-full min-w-[200px] h-[46px] rounded-xl font-semibold transition-all duration-300 ${!url ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed' : 'btn-primary'}`}
                      >
                        Download Video
                      </button>
                    </AnimeHover>
                  </div>
                </div>

              </div>
            ) : status === 'processing' || status === 'uploading' || status === 'queued' || status === 'downloading' ? (
              <ProgressCircle
                progress={progress}
                statusText={status === 'queued' ? `Queued (Position: ${queuePosition})` : status === 'uploading' ? "Your link is getting ready..." : status === 'downloading' ? "Downloading Video..." : "Fetching Video..."}
                subText={status === 'queued' ? 'Waiting for other conversions to finish...' : status === 'uploading' ? "Generating high-speed CDN link" : status === 'downloading' ? "Saving file to your device." : "Fetching highest quality video securely"}
              />
            ) : (
              <CompletionCard
                accent="cyan"
                heading="Video is Ready!"
                message={
                  <>
                    Your high-quality <strong className="text-cyan-300">{quality}</strong> Video is ready to download.
                  </>
                }
                thumbnail={videoInfo?.thumbnail}
                mediaTitle={videoInfo?.title}
                fileSize={fileSize}
                conversionTime={conversionTime}
                downloadLabel="Download Video"
                onDownload={downloadFile}
                resetLabel="Download Another"
                onReset={reset}
              />
            )}
          </ToolPanel>
        </AnimeReveal>
        
        <ErrorDialog
          open={!!error}
          title={canRetry ? 'Download Did Not Complete' : 'This Video Cannot Be Downloaded'}
          message={error}
          actionLabel={canRetry ? 'Try Again' : 'Try A Different Video'}
          onClose={() => { setError(''); setCanRetry(false); setStatus('idle'); }}
        />
      </div>
    </ProtectedRoute>
  );
}
