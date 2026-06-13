'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { isValidYouTubeUrl, getYouTubeVideoId, formatFileSize } from '@/lib/utils';
import Image from 'next/image';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageWrapper from '@/components/PageWrapper';

export default function YtVideoPage() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [videoInfo, setVideoInfo] = useState<{ title?: string; thumbnail?: string } | null>(null);
  const [error, setError] = useState('');
  const [formats, setFormats] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleFetchLinks = async () => {
    if (!isValidYouTubeUrl(url)) { setError('Please enter a valid YouTube URL'); return; }
    setError(''); setStatus('processing'); setVideoInfo(null); setFormats([]);
    try {
      const { data } = await api.get(`/extractor/get-urls?url=${encodeURIComponent(url)}`);
      setVideoInfo({ title: data.title, thumbnail: data.thumbnail });
      setFormats(data.formats || []);
      setStatus('completed');
    } catch (err: unknown) {
      setStatus('failed');
      const msg = (err as any)?.response?.data?.message || (err as any).message;
      setError(msg || 'Failed to fetch direct links');
    }
  };

  const reset = () => {
    setUrl(''); setStatus('idle'); setVideoInfo(null); setError(''); setFormats([]);
  };

  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center mb-12 pt-8">
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4 text-white">
            YouTube <span className="text-gradient">Direct Downloader</span>
          </h1>
          <p className="text-white max-w-2xl mx-auto text-lg">
            Client-side direct downloads. Bypass server limits and download straight from YouTube's CDN.
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
                      onKeyDown={(e) => e.key === 'Enter' && handleFetchLinks()}
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

                  <div className="flex justify-center">
                    <button
                      onClick={handleFetchLinks}
                      disabled={!url}
                      className={`min-w-[200px] h-[46px] rounded-xl font-semibold text-base transition-all duration-300 flex-shrink-0 ${!url ? 'bg-white/5 text-white/40 cursor-not-allowed' : 'btn-primary w-full'}`}
                    >
                      Extract Direct Links
                    </button>
                  </div>
                </motion.div>

              ) : status === 'processing' ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-6">
                  <div className="w-16 h-16 border-4 border-brand-cyan/20 border-t-brand-cyan rounded-full animate-spin" />
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">Resolving URLs...</h3>
                    <p className="text-white/60">Fetching direct streaming links from YouTube CDN.</p>
                  </div>
                </div>

              ) : (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-4 flex flex-col items-center w-full">
                  {videoInfo?.thumbnail && (
                    <div className="w-full max-w-sm aspect-video relative rounded-2xl overflow-hidden border border-white/10 mb-6 shadow-2xl">
                      <Image src={videoInfo.thumbnail} alt="thumbnail" fill className="object-cover" unoptimized />
                    </div>
                  )}

                  <h3 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 text-center">Ready to Download</h3>
                  {videoInfo?.title && (
                    <p className="max-w-md w-full line-clamp-2 mb-6 text-sm text-center text-white px-4">{videoInfo.title}</p>
                  )}

                  <div className="w-full flex flex-col gap-3 mb-8">
                    {formats.length === 0 ? (
                      <div className="p-4 bg-white/5 rounded-xl text-center text-white/60">No suitable formats found.</div>
                    ) : (
                      formats.map((format, idx) => {
                        // Construct download attribute filename safely
                        const filename = `${videoInfo?.title?.replace(/[^\w\s]/gi, '') || 'video'}_${format.qualityLabel}.${format.mimeType.split(';')[0].split('/')[1] || 'mp4'}`;
                        
                        return (
                          <a 
                            key={idx} 
                            href={`${format.url}&title=${encodeURIComponent(filename)}`} 
                            download={filename}
                            className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                          >
                            <div className="flex flex-col">
                              <span className="text-white font-semibold text-lg flex items-center gap-2">
                                {format.hasVideo ? (
                                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-brand-cyan"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                ) : (
                                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-brand-purple"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                                )}
                                {format.qualityLabel}
                              </span>
                              <span className="text-white/50 text-xs mt-1">
                                {format.mimeType.split(';')[0]} {format.contentLength ? `• ${formatFileSize(Number(format.contentLength))}` : ''}
                              </span>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-brand-cyan/20 flex items-center justify-center group-hover:bg-brand-cyan transition-colors">
                              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </div>
                          </a>
                        );
                      })
                    )}
                  </div>

                  <button onClick={reset} className="glass-panel hover:bg-white/5 border border-white/20 text-white transition-all h-12 w-full max-w-sm rounded-xl font-medium">
                    Try Another Video
                  </button>
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
                <h3 className="text-2xl font-bold text-white mb-2">Extraction Failed</h3>
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
