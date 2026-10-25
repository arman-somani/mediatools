'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Clapperboard } from 'lucide-react';
import api, { videoApi, videoApiUrl } from '@/lib/api';
import { isValidYouTubeUrl, getYouTubeVideoId } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { useConversionJob, isRunning } from '@/lib/useConversionJob';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';

import PageHeader from '@/components/ui/PageHeader';
import ToolPanel from '@/components/ui/ToolPanel';
import UrlInput, { YouTubeSearchResults, YouTubePreview } from '@/components/ui/UrlInput';
import QualitySelector, { type QualityOption } from '@/components/ui/QualitySelector';
import CompletionCard from '@/components/ui/CompletionCard';
import FailureNotice from '@/components/ui/FailureNotice';
import ProgressMeter from '@/components/ProgressMeter';

type VideoQuality = '360p' | '480p' | '720p' | '1080p' | '4K' | '8K';

const STAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  sending: { title: 'Starting the job…', subtitle: 'Handing your link to the download worker.' },
  queued: { title: 'Waiting for a free worker', subtitle: 'Jobs run in the order they arrive — usually a short wait.' },
  processing: { title: 'Fetching the video', subtitle: 'Downloading the stream at the quality you picked.' },
  finalizing: { title: 'Almost there', subtitle: 'Generating a high-speed download link.' },
};

export default function YtVideoPage() {
  const { user } = useAuthStore();
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<VideoQuality>('720p');
  const [searchResults, setSearchResults] = useState<{ videoId: string; title: string; thumbnail: string; channelTitle?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { state, start, reset } = useConversionJob({
    client: videoApi,
    toAbsolute: videoApiUrl,
    intervalMs: 2500,
    notification: { title: 'Video ready', body: 'Your video file has finished downloading and is ready to save.' },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryUrl = params.get('url');
    if (queryUrl) setUrl(queryUrl);
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

  const handleDownload = () => {
    if (!isValidYouTubeUrl(url)) {
      window.alert('Please enter a valid YouTube URL, or type a search phrase.');
      return;
    }
    start(async ({ signal }) => {
      const { data } = await videoApi.post(
        '/convert/universal',
        { url, videoQuality: quality, type: 'youtube-Video' },
        { signal },
      );
      if (!data.success || !data.data?.jobId) throw new Error('Invalid response from server');
      return { jobId: data.data.jobId, title: data.data.title, thumbnail: data.data.thumbnail };
    });
  };

  const qualityOptions: QualityOption<VideoQuality>[] = ['360p', '480p', '720p', '1080p', '4K', '8K'].map((q) => ({
    value: q as VideoQuality,
    locked: (q === '4K' || q === '8K') && user?.role !== 'admin' && !user?.isPremium,
  }));

  return (
    <ProtectedRoute>
      <PageWrapper>
        <div className="w-full max-w-3xl mx-auto px-6 py-20 md:py-28">
          <PageHeader
            index="003"
            label="YOUTUBE VIDEO"
            title="YouTube to MP4."
            subtitle="Paste a link and pick a resolution from 360p to 8K. The video lands as-is — no re-encode."
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
                  qualityLabel={state.producedQuality ? `${state.producedQuality} MP4` : `${quality} MP4`}
                  downloadUrl={state.downloadUrl}
                  downloadLabel="Download video"
                  onDownload={() => window.open(state.downloadUrl, '_blank')}
                  resetLabel="Download another"
                  onReset={() => {
                    setUrl('');
                    reset();
                  }}
                />
              ) : isRunning(state.phase) ? (
                <ProgressMeter
                  phase={state.phase}
                  progress={state.progress}
                  queuePosition={state.queuePosition}
                  title={STAGE_COPY[state.phase]?.title ?? 'Working…'}
                  subtitle={state.title || STAGE_COPY[state.phase]?.subtitle || ''}
                />
              ) : (
                <div className="space-y-7">
                  {state.phase === 'failed' && state.error && (
                    <FailureNotice failure={state.error} onDismiss={() => reset()} />
                  )}

                  <UrlInput
                    id="yt-video-url"
                    placeholder="Search YouTube or paste URL…"
                    value={url}
                    onChange={(v) => setUrl(v)}
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

                  {thumbnailPreview && <YouTubePreview src={thumbnailPreview} />}

                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <QualitySelector
                        label="VIDEO QUALITY"
                        options={qualityOptions}
                        value={quality}
                        onSelect={setQuality}
                        onLocked={() => toast('4K and 8K are reserved for Premium accounts.')}
                      />
                    </div>
                    <button onClick={handleDownload} disabled={!url} className="btn-primary btn-lg sm:w-52 sm:mt-[25px]">
                      <Clapperboard className="w-4 h-4" />
                      Download video
                    </button>
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
