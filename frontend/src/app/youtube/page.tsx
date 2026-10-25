'use client';

import { useEffect, useRef, useState } from 'react';
import { Music } from 'lucide-react';
import api, { audioApi, audioApiUrl } from '@/lib/api';
import { isValidYouTubeUrl, getYouTubeVideoId } from '@/lib/utils';
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

type Quality = '128' | '192' | '320';

const STAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  sending: { title: 'Starting the job…', subtitle: 'Handing your link to the extraction worker.' },
  queued: { title: 'Waiting for a free worker', subtitle: 'Jobs run in the order they arrive — usually a short wait.' },
  processing: { title: 'Fetching the audio', subtitle: 'Pulling the best available audio stream from YouTube.' },
  finalizing: { title: 'Almost there', subtitle: 'Generating a high-speed download link.' },
};

export default function YouTubePage() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('192');
  const [searchResults, setSearchResults] = useState<{ videoId: string; title: string; thumbnail: string; channelTitle?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { state, start, reset } = useConversionJob({
    client: audioApi,
    toAbsolute: audioApiUrl,
    intervalMs: 2000,
    notification: { title: 'Audio ready', body: 'Your audio file has finished converting and is ready to save.' },
  });

  // Deep-link support: /youtube?url=… pre-fills the field.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryUrl = params.get('url');
    if (queryUrl) setUrl(queryUrl);
  }, []);

  // Non-URL input triggers a YouTube search after a short debounce.
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

  const handleConvert = () => {
    if (!isValidYouTubeUrl(url)) {
      window.alert('Please enter a valid YouTube URL, or type a search phrase.');
      return;
    }
    start(async ({ signal }) => {
      const { data } = await audioApi.post('/convert/youtube', { url, quality }, { signal });
      return { jobId: data.data.jobId, title: data.data.title, thumbnail: data.data.thumbnail };
    });
  };

  const qualityOptions: QualityOption<Quality>[] = [
    { value: '128', label: '128k' },
    { value: '192', label: '192k' },
    { value: '320', label: '320k' },
  ];

  return (
    <ProtectedRoute>
      <PageWrapper>
        <div className="w-full max-w-3xl mx-auto px-6 py-20 md:py-28">
          <PageHeader
            index="002"
            label="YOUTUBE AUDIO"
            title="YouTube to MP3."
            subtitle="Paste a link, or type what you are looking for and pick it from the search results."
          />

          <AnimeReveal delay={80} direction="up" className="mt-12">
            <ToolPanel>
              {state.phase === 'completed' ? (
                <CompletionCard
                  heading="Audio is ready"
                  thumbnail={state.thumbnail}
                  mediaTitle={state.title}
                  fileSize={state.fileSize}
                  durationSec={state.durationSec}
                  qualityLabel={`${quality} kbps MP3`}
                  downloadUrl={state.downloadUrl}
                  downloadLabel="Download audio"
                  onDownload={() => window.open(state.downloadUrl, '_blank')}
                  resetLabel="Convert another"
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
                    <FailureNotice
                      failure={state.error}
                      onDismiss={() => reset()}
                    />
                  )}

                  <UrlInput
                    id="youtube-audio-url"
                    placeholder="Search YouTube or paste URL…"
                    value={url}
                    onChange={(v) => setUrl(v)}
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

                  {thumbnailPreview && (
                    <YouTubePreview src={thumbnailPreview} />
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <QualitySelector label="OUTPUT QUALITY" options={qualityOptions} value={quality} onSelect={setQuality} />
                    </div>
                    <button onClick={handleConvert} disabled={!url} className="btn-primary btn-lg sm:w-52 sm:mt-[25px]">
                      <Music className="w-4 h-4" />
                      Convert audio
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
