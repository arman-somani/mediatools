'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { apiUrl } from '@/lib/api';
import { isValidYouTubeUrl, getYouTubeVideoId, formatFileSize } from '@/lib/utils';
import Image from 'next/image';
import PlaylistDownloader from '@/components/PlaylistDownloader';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgressCircle from '@/components/ProgressCircle';

type Quality = '128' | '192' | '320';



export default function YouTubePage() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('192');
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
        } else if (conv.status === 'failed') {
          clearInterval(pollRef.current!);
          setStatus('failed');
          setError(conv.errorMessage || 'Conversion failed');
        }
      } catch { clearInterval(pollRef.current!); }
    }, 2000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleConvert = async () => {
    startTimeRef.current = Date.now();
    if (!isValidYouTubeUrl(url)) { setError('Please enter a valid YouTube URL'); return; }
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

  const reset = () => { setUrl(''); setStatus('idle'); setProgress(0); setJobId(''); setVideoInfo(null); setFileSize(null); setError(''); setConversionTime(null); };

  return (
    <ProtectedRoute>
      <div className="w-full max-w-[90rem] mx-auto px-6 py-20 flex flex-col items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center mb-12 pt-8">
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4 text-white">
            Download <span className="text-gradient">YouTube Audio</span>
          </h1>
          <p className="text-white max-w-2xl mx-auto text-lg">
            Extract high-quality Audio from any YouTube video or entire playlists instantly.
          </p>
        </motion.div>

        <div className="w-full grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
          {/* LEFT COLUMN: SINGLE DOWNLOADER */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="w-full h-full">
            <div className="glass-panel p-8 md:p-10 relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-0 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none" />

              <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                  <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Single Audio Downloader</h2>
                  <p className="text-sm text-white">Download one specific video</p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {status === 'idle' || status === 'failed' ? (
                  <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 space-y-8 flex-1">

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

                    {/* Preview */}
                    <AnimatePresence>
                      {thumbnailPreview && url && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl relative border border-white/10 aspect-video w-full bg-black">
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
                        <motion.button
                          whileHover={url ? { y: -2 } : {}}
                          whileTap={url ? { scale: 0.96 } : {}}
                          onClick={handleConvert}
                          disabled={!url}
                          className={`min-w-[160px] h-[46px] rounded-xl font-semibold transition-all duration-300 ${!url ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}
                        >
                          Convert to Audio </motion.button>
                      </div>
                    </div>

                  </motion.div>
                ) : status === 'processing' ? (
                  <ProgressCircle
                    progress={progress}
                    statusText="Fetching & Converting..."
                    subText={videoInfo?.title}
                  />
                ) : (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex-1 text-center flex flex-col items-center">
                    {videoInfo?.thumbnail && (
                      <div className="w-full max-w-sm aspect-video relative rounded-2xl overflow-hidden border border-white/10 mb-8 shadow-2xl">
                        <Image src={videoInfo.thumbnail} alt="thumbnail" fill className="object-cover" unoptimized />
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 shadow-sm">
                            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </div>
                        </div>
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

                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm mx-auto">
                      <a href={apiUrl(`/api/convert/download/${jobId}`)} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] text-white font-semibold rounded-xl flex items-center justify-center gap-2 h-14 transition-all duration-300">
                          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Download Audio </motion.button>
                      </a>
                      <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} onClick={reset} className="btn-secondary h-14 w-full sm:w-auto px-8 whitespace-nowrap text-white">
                        Another
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* RIGHT COLUMN: PLAYLIST DOWNLOADER */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="w-full h-full">
            <div className="glass-panel p-5 sm:p-8 md:p-10 relative overflow-hidden h-full flex flex-col border-[2px] border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.1)] bg-gradient-to-b from-red-500/[0.03] to-transparent">
              {/* Highlight glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

              <PlaylistDownloader />
            </div>
          </motion.div>
        </div>

        {/* Error Dialog Modal */}
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
                className="bg-white#111] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative"
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
