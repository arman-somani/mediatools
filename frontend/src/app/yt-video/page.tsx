'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { apiUrl } from '@/lib/api';
import { isValidYouTubeUrl, getYouTubeVideoId, formatFileSize } from '@/lib/utils';
import Image from 'next/image';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgressCircle from '@/components/ProgressCircle';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';

type VideoQuality = '360p' | '480p' | '720p' | '1080p' | '4K' | '8K';



export default function YtVideoPage() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<VideoQuality>('720p');
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ title?: string; thumbnail?: string } | null>(null);
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
          sendNotification('Audio Ready! 🎵', 'Your audio file has finished converting and is ready to save.');
        } else if (conv.status === 'failed') {
          clearInterval(pollRef.current!);
          setStatus('failed');
          setError(conv.errorMessage || 'Download failed');
        }
      } catch { clearInterval(pollRef.current!); }
    }, 2500);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleDownload = async () => {
    startTimeRef.current = Date.now();
    if (!isValidYouTubeUrl(url)) { setError('Please enter a valid YouTube URL'); return; }
    requestNotificationPermission();
    setError(''); setStatus('processing'); setProgress(0); setConversionTime(null);
    try {
      const { data } = await api.post('/convert/youtube-Video', { url, videoQuality: quality });
      setJobId(data.data.jobId);
      if (data.data.title) setVideoInfo({ title: data.data.title });
      poll(data.data.jobId);
    } catch (err: unknown) {
      setStatus('failed');
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to start download');
    }
  };

  const reset = () => {
    setUrl(''); setStatus('idle'); setProgress(0);
    setJobId(''); setVideoInfo(null); setFileSize(null); setError(''); setConversionTime(null);
  };

  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center mb-12 pt-8">
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4 text-white">
            Download <span className="text-gradient">YouTube Video</span>
          </h1>
          <p className="text-white max-w-2xl mx-auto text-lg">
            Paste any YouTube Video Link, select preferred quality, and download the full video as an MP4 file.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="w-full">
          <div className="glass-panel p-5 sm:p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

            <AnimatePresence mode="wait">
              {status === 'idle' || status === 'failed' ? (
                <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 space-y-8">

                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-white/40 transition-colors duration-200 group-focus-within:text-brand-purple">
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); setError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                      placeholder="Search YouTube or paste URL..."
                      className="url-input-field"
                    />
                  </div>

                  <AnimatePresence>
                    {(isSearching || searchResults.length > 0) && !isValidYouTubeUrl(url) && url.length > 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute w-full mt-2 bg-[#1E1B2E]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[400px] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar"
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
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {thumbnailPreview && url && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-2xl relative border border-white/10 aspect-video w-full bg-black"
                      >
                        <Image src={thumbnailPreview} alt="YouTube thumbnail" fill className="object-cover opacity-60" unoptimized />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                          <span className="flex items-center gap-2 text-white font-medium">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Valid YouTube Link
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Controls: quality + button on same row, perfectly aligned */}
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Quality selector */}
                    <div className="flex-1">
                      <label className="quality-label">VIDEO QUALITY</label>
                      <div className="quality-track">
                        {(['360p', '480p', '720p', '1080p', '4K', '8K'] as VideoQuality[]).map(q => (
                          <button
                            key={q}
                            onClick={() => setQuality(q)}
                            className={`quality-btn${quality === q ? ' active' : ''}`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Button ? aligned to quality track top using invisible spacer label */}
                    <div className="flex flex-col justify-start">
                      <label className="quality-label opacity-0 select-none">BTN</label>
                      <button
                        onClick={handleDownload}
                        disabled={!url}
                        className={`min-w-[200px] h-[46px] rounded-xl font-semibold text-base transition-all duration-300 flex-shrink-0 ${!url ? 'bg-white/5 text-white/40 cursor-not-allowed' : 'btn-primary'}`}
                      >
                        Download Video </button>
                    </div>
                  </div>

                </motion.div>

              ) : status === 'processing' ? (
                <ProgressCircle
                  progress={progress}
                  statusText="Downloading & Encoding..."
                  subText={`Fetching ${quality} video - wait for a while for larger files.`}
                />

              ) : (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center flex flex-col items-center">
                  {videoInfo?.thumbnail && (
                    <div className="w-full max-w-sm aspect-video relative rounded-2xl overflow-hidden border border-white/10 mb-8 shadow-2xl">
                      <Image src={videoInfo.thumbnail} alt="thumbnail" fill className="object-cover" unoptimized />
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 shadow-sm">
                          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {!videoInfo?.thumbnail && (
                    <div className="w-24 h-24 bg-brand-violet/10 rounded-full flex items-center justify-center mb-6 border border-brand-violet/20 shadow-[0_0_40px_rgba(124,58,237,0.2)]">
                      <svg width="40" height="40" fill="none" stroke="#7c3aed" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  <h3 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 sm:mb-3">Video is Ready!</h3>
                  {videoInfo?.title && (
                    <p className="max-w-sm w-full line-clamp-2 mb-2 text-xs sm:text-sm text-white px-4">{videoInfo.title}</p>
                  )}
                  <p className="text-white mb-4 text-base sm:text-lg px-2">Your high-quality {quality} Video is ready to download.</p>
                  {fileSize && (
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm font-medium mb-8 px-4 py-2 rounded-lg bg-white/5 text-white">
                      <span>Actual Size: <strong className="text-brand-cyan">{formatFileSize(fileSize)}</strong></span>
                      {conversionTime !== null && (
                        <span className="hidden sm:inline">|</span>
                      )}
                      {conversionTime !== null && (
                        <span>Time Taken: <strong className="text-brand-cyan">{conversionTime}s</strong></span>
                      )}
                    </div>
                  )}
                  {!fileSize && <div className="mb-8" />}

                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                    <a
                      href={apiUrl(`/api/convert/download/${jobId}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <button className="w-full font-semibold rounded-xl flex items-center justify-center gap-2 h-14 transition-all duration-300 btn-primary">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Video </button>
                    </a>
                    <button onClick={reset} className="glass-panel hover:bg-white/5 border border-white/20 text-white transition-all h-14 w-full sm:w-auto px-8 whitespace-nowrap">
                      Download Another
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="glass-panel p-8 rounded-2xl max-w-md w-full text-center relative"
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}
