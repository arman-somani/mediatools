'use client';
import { useState, useEffect, useRef } from 'react';
import api, { apiUrl } from '@/lib/api';
import { isValidYouTubeUrl, getYouTubeVideoId, formatFileSize } from '@/lib/utils';
import Image from 'next/image';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageWrapper from '@/components/PageWrapper';
import ProgressCircle from '@/components/ProgressCircle';
import AnimeReveal from '@/components/AnimeReveal';
import AnimeHover from '@/components/AnimeHover';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';

type Quality = '128' | '192' | '320';



export default function YouTubePage() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('192');
  const [status, setStatus] = useState<'idle' | 'processing' | 'uploading' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ title?: string; thumbnail?: string } | null>(null);
  const [gofileUrl, setGofileUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [conversionTime, setConversionTime] = useState<number | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryUrl = params.get('url');
      if (queryUrl) setUrl(queryUrl);
    }
  }, []);
  
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const startTimeRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/convert/status/${id}`);
        const conv = data.data;
        setProgress(Math.round(conv.progress || 0));
        if (conv.status === 'completed') {
          clearInterval(pollRef.current!);
          setStatus('completed');
          setProgress(100);
          if (startTimeRef.current) setConversionTime(Math.round((Date.now() - startTimeRef.current) / 1000));
          setVideoInfo({ title: conv.youtubeTitle, thumbnail: conv.youtubeThumbnail });
          setFileSize(conv.fileSize || null);
          if (conv.gofileUrl) setGofileUrl(conv.gofileUrl);
          const finalUrl = conv.outputUrl || `/api/convert/download/${id}`;
          setJobId(finalUrl.startsWith('http') ? finalUrl : apiUrl(finalUrl));
          sendNotification('Audio Ready! 🎵', 'Your audio file has finished converting and is ready to save.');
        } else if (conv.status === 'failed') {
          clearInterval(pollRef.current!);
          setStatus('failed');
          setError(conv.errorMessage || 'Conversion failed');
        } else if (conv.status === 'uploading') {
          setStatus('uploading');
        } else {
          setStatus('processing');
        }
      } catch { clearInterval(pollRef.current!); }
    }, 2000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleConvert = async () => {
    startTimeRef.current = Date.now();
    if (!isValidYouTubeUrl(url)) { setError('Please enter a valid YouTube URL'); return; }
    requestNotificationPermission();
    setError(''); setStatus('processing'); setProgress(0); setConversionTime(null);
    try {
      const { data } = await api.post('/convert/youtube', { url, quality });
      setJobId(data.data.jobId);
      if (data.data.title) setVideoInfo({ title: data.data.title, thumbnail: data.data.thumbnail });
      poll(data.data.jobId);
    } catch (err: unknown) {
      setStatus('failed');
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to start conversion');
    }
  };

  const reset = () => { setUrl(''); setStatus('idle'); setProgress(0); setJobId(''); setVideoInfo(null); setFileSize(null); setGofileUrl(null); setError(''); setConversionTime(null); };

  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        <AnimeReveal direction="up" className="w-full text-center mb-12 pt-8">
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4 text-white">
            Download <span className="text-gradient">YouTube Audio</span>
          </h1>
          <p className="text-white max-w-2xl mx-auto text-lg">
            Extract high-quality Audio from any YouTube video instantly.
          </p>
        </AnimeReveal>

        <AnimeReveal delay={100} direction="up" className="w-full">
          <div className="glass-panel p-5 sm:p-8 md:p-12 relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                {status === 'idle' || status === 'failed' ? (
                  <div key="input" className="relative z-10 space-y-8 flex-1 animate-in fade-in duration-300">

                    {/* URL Input */}
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-10 transition-colors group-focus-within:text-brand-purple">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      </div>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
                        placeholder="Search YouTube or paste URL..."
                        className="url-input-field"
                      />
                    </div>

                    {(isSearching || searchResults.length > 0) && !isValidYouTubeUrl(url) && url.length > 2 && (
                        <div
                          className="absolute w-full mt-2 bg-[#1E1B2E]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[400px] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar animate-in slide-in-from-top-2 fade-in duration-300"
                        >
                          {isSearching && (
                            <div className="p-4 text-center text-white/50">Searching YouTube...</div>
                          )}
                          {!isSearching && searchResults.map((video) => (
                            <button
                              key={video.videoId}
                              onClick={() => {
                                setUrl(`https://www.youtube.com/watch?v=${video.videoId}`);
                                setSearchResults([]);
                              }}
                              className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors text-left"
                            >
                              <div className="w-32 aspect-video bg-black/50 rounded-lg overflow-hidden flex-shrink-0 relative">
                                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <h4 className="text-white font-medium text-sm line-clamp-2" dangerouslySetInnerHTML={{ __html: video.title }} />
                                <p className="text-white/50 text-xs mt-1">{video.channelTitle}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                    {/* Preview */}
                      {thumbnailPreview && url && (
                        <div className="overflow-hidden rounded-2xl relative border border-white/10 aspect-video w-full bg-black animate-in slide-in-from-bottom-2 fade-in duration-300">
                          <Image src={thumbnailPreview} alt="YouTube thumbnail" fill className="object-cover opacity-60" unoptimized />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                            <span className="flex items-center gap-2 text-white font-medium">
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Valid YouTube Link
                            </span>
                          </div>
                        </div>
                      )}

                    {/* Controls: quality + button on same row, perfectly aligned */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Quality selector */}
                      <div className="flex-1">
                        <label className="quality-label">OUTPUT QUALITY</label>
                        <div className="quality-track">
                          {(['128', '192', '320'] as Quality[]).map(q => (
                            <button
                              key={q}
                              onClick={() => setQuality(q)}
                              className={`quality-btn${quality === q ? ' active' : ''}`}
                            >
                              {q}k
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Button ? top aligned with quality track label */}
                      <div className="flex flex-col justify-start">
                        <label className="quality-label opacity-0 select-none">BTN</label>
                        <AnimeHover scaleHover={url ? 1.02 : 1} scaleTap={url ? 0.96 : 1}>
                          <button
                            onClick={handleConvert}
                            disabled={!url}
                            className={`w-full min-w-[160px] h-[46px] rounded-xl font-semibold transition-all duration-300 ${!url ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed' : 'btn-primary'}`}
                          >
                            Convert Audio </button>
                        </AnimeHover>
                      </div>
                    </div>

                  </div>
                ) : status === 'processing' || status === 'uploading' ? (
                <ProgressCircle
                  progress={progress}
                  statusText={status === 'uploading' ? "Your link is getting ready..." : "Downloading Audio..."}
                  subText={status === 'uploading' ? "Generating high-speed CDN link" : "Fetching highest quality audio securely"}
                />
                ) : (
                  <div key="done" className="py-8 flex-1 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                    {videoInfo?.thumbnail && (
                      <div className="w-full max-w-sm aspect-video relative rounded-2xl overflow-hidden border border-white/10 mb-8 shadow-2xl">
                        <Image src={videoInfo.thumbnail} alt="thumbnail" fill className="object-cover" unoptimized />
                      </div>
                    )}

                    <h3 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 sm:mb-3">Audio is Ready!</h3>
                    <p className="text-white mb-4 text-base sm:text-lg px-2">Your high-quality {quality}kbps Audio is ready to download.</p>
                    {fileSize && (
                      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm font-medium mb-8 px-4 py-2 rounded-lg" style={{ background: 'var(--quality-track-bg)', color: 'var(--quality-btn-idle-color)' }}>
                        <span>Actual Size: <strong className="text-red-400">{formatFileSize(fileSize)}</strong></span>
                        {conversionTime !== null && (
                          <span className="hidden sm:inline">|</span>
                        )}
                        {conversionTime !== null && (
                          <span>Time Taken: <strong className="text-red-400">{conversionTime}s</strong></span>
                        )}
                      </div>
                    )}
                    {!fileSize && <div className="mb-8" />}

                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg mx-auto">
                      <div className="flex flex-col gap-3 flex-1">
                        <AnimeHover scaleHover={1.02} scaleTap={0.96} className="w-full">
                          <button 
                            onClick={() => { window.open(jobId, '_blank'); }}
                            className="w-full font-semibold rounded-xl flex items-center justify-center gap-2 h-14 transition-all duration-300 btn-primary">
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download Audio 
                          </button>
                        </AnimeHover>
                      </div>
                      <AnimeHover scaleHover={1.02} scaleTap={0.96} className="w-full sm:w-auto">
                        <button onClick={reset} className="glass-panel hover:bg-white/5 border border-white/20 h-14 w-full px-8 whitespace-nowrap text-white transition-all">
                          Another
                        </button>
                      </AnimeHover>
                    </div>
                  </div>
                )}
          </div>
        </AnimeReveal>
        {/* Error Dialog Modal */}
          {error && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <div
                className="glass-panel p-8 rounded-2xl max-w-md w-full text-center relative animate-in fade-in zoom-in-95 duration-300"
              >
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                  <svg width="32" height="32" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Download Failed</h3>
                <p className="text-white mb-8">
                  {error}
                </p>
                <button
                  onClick={() => { setError(''); setStatus('idle'); }}
                  className="w-full py-3 bg-black/5 hover:bg-white/20 text-white font-semibold rounded-xl transition-all"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
      </div>
    </ProtectedRoute>
  );
}
