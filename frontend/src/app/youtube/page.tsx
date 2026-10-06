'use client';
import { useState, useEffect, useRef } from 'react';
import { Music } from 'lucide-react';
import api, { audioApi, audioApiUrl } from '@/lib/api';
import { pollConversion, describeFailure } from '@/lib/conversion';
import { isValidYouTubeUrl, getYouTubeVideoId, formatFileSize } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgressCircle from '@/components/ProgressCircle';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import AnimeReveal from '@/components/AnimeReveal';
import AnimeHover from '@/components/AnimeHover';

import PageHeader from '@/components/ui/PageHeader';
import ToolPanel from '@/components/ui/ToolPanel';
import UrlInput, { YouTubeSearchResults, YouTubePreview } from '@/components/ui/UrlInput';
import QualitySelector, { type QualityOption } from '@/components/ui/QualitySelector';
import CompletionCard from '@/components/ui/CompletionCard';
import ErrorDialog from '@/components/ui/ErrorDialog';

type Quality = '128' | '192' | '320';

export default function YouTubePage() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('192');
  const [status, setStatus] = useState<'idle' | 'queued' | 'processing' | 'uploading' | 'completed' | 'downloading' | 'failed'>('idle');
  const [queuePosition, setQueuePosition] = useState(0);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ title?: string; thumbnail?: string } | null>(null);
  const [error, setError] = useState('');
  const [conversionTime, setConversionTime] = useState<number | null>(null);

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
      client: audioApi,
      jobId: id,
      toAbsolute: audioApiUrl,
      intervalMs: 2000,
      handlers: {
        onQueued: (position) => {
          setStatus('queued');
          setQueuePosition(position);
        },
        onProgress: (value, snapshot) => {
          setStatus(snapshot.status === 'uploading' ? 'uploading' : 'processing');
          setProgress(value);
        },
        onCompleted: (downloadUrl, snapshot) => {
          setStatus('completed');
          setProgress(100);
          if (startTimeRef.current) {
            setConversionTime(Math.round((Date.now() - startTimeRef.current) / 1000));
          }
          setVideoInfo({ title: snapshot.youtubeTitle, thumbnail: snapshot.youtubeThumbnail });
          setFileSize(snapshot.fileSize ?? null);
          setDownloadUrl(downloadUrl);
          sendNotification('Audio Ready! 🎵', 'Your audio file has finished converting and is ready to save.');
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

  const handleConvert = async () => {
    startTimeRef.current = Date.now();
    if (!isValidYouTubeUrl(url)) { setError('Please enter a valid YouTube URL'); return; }
    requestNotificationPermission();
    setError(''); setCanRetry(false); setStatus('processing'); setProgress(0); setDownloadUrl(''); setConversionTime(null);
    try {
      const { data } = await audioApi.post('/convert/youtube', { url, quality });
      setJobId(data.data.jobId);
      if (data.data.title) setVideoInfo({ title: data.data.title, thumbnail: data.data.thumbnail });
      poll(data.data.jobId);
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

  const qualityOptions: QualityOption<Quality>[] = [
    { value: '128', label: '128k' },
    { value: '192', label: '192k' },
    { value: '320', label: '320k' },
  ];

  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        <PageHeader
          icon={<Music className="w-5 h-5" />}
          eyebrow="YouTube Audio"
          title={
            <>
              Download <span className="text-gradient">YouTube Audio</span>
            </>
          }
          subtitle="Extract high-quality Audio from any YouTube video instantly."
          accent="rose"
        />

        <AnimeReveal delay={100} direction="up" className="w-full mt-12">
          <ToolPanel accent="rose">
            {status === 'idle' || status === 'failed' ? (
              <div key="input" className="relative z-10 space-y-8 flex-1 animate-in fade-in duration-300">
                
                <UrlInput
                  id="youtube-audio-url"
                  placeholder="Search YouTube or paste URL..."
                  value={url}
                  onChange={(v) => { setUrl(v); setError(''); }}
                  onEnter={handleConvert}
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
                      label="OUTPUT QUALITY"
                      options={qualityOptions}
                      value={quality}
                      onSelect={setQuality}
                    />
                  </div>

                  <div className="flex flex-col justify-start">
                    <label className="quality-label opacity-0 select-none">BTN</label>
                    <AnimeHover scaleHover={url ? 1.02 : 1} scaleTap={url ? 0.96 : 1}>
                      <button
                        onClick={handleConvert}
                        disabled={!url}
                        className={`w-full min-w-[160px] h-[46px] rounded-xl font-semibold transition-all duration-300 ${!url ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed' : 'btn-primary'}`}
                      >
                        Convert Audio
                      </button>
                    </AnimeHover>
                  </div>
                </div>

              </div>
            ) : status === 'processing' || status === 'uploading' || status === 'queued' || status === 'downloading' ? (
              <ProgressCircle
                progress={progress}
                statusText={status === 'queued' ? `Queued (Position: ${queuePosition})` : status === 'uploading' ? "Your link is getting ready..." : status === 'downloading' ? "Downloading Audio..." : "Fetching Audio..."}
                subText={status === 'queued' ? 'Waiting for other conversions to finish...' : status === 'uploading' ? "Generating high-speed CDN link" : status === 'downloading' ? "Saving file to your device." : "Fetching highest quality audio securely"}
              />
            ) : (
              <CompletionCard
                accent="rose"
                heading="Audio is Ready!"
                message={
                  <>
                    Your high-quality <strong className="text-rose-300">{quality}kbps</strong> Audio is ready to download.
                  </>
                }
                thumbnail={videoInfo?.thumbnail}
                mediaTitle={videoInfo?.title}
                fileSize={fileSize}
                conversionTime={conversionTime}
                downloadLabel="Download Audio"
                onDownload={downloadFile}
                resetLabel="Convert Another"
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
