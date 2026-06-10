'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { apiUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import Image from 'next/image';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgressCircle from '@/components/ProgressCircle';

type ApiError = { response?: { data?: { message?: string } } };

const getQualityLabel = (resolution: string) => {
  if (!resolution || resolution === 'Best Available' || resolution === 'NA') return '';
  const match = resolution.match(/x(\d+)/);
  if (!match) return '';
  const h = parseInt(match[1]);
  if (h >= 4320) return ' (8K UHD)';
  if (h >= 2160) return ' (4K UHD)';
  if (h >= 1440) return ' (2K QHD)';
  if (h >= 1080) return ' (1080p HD)';
  if (h >= 720) return ' (720p HD)';
  if (h >= 480) return ' (480p SD)';
  return ` (${h}p)`;
};

export default function UniversalPage() {
  const [url, setUrl] = useState('');
  const [preflightInfo, setPreflightInfo] = useState<{ title: string; thumbnail: string; resolution: string; sizeBytes: number; videoUrl?: string } | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ title?: string; thumbnail?: string } | null>(null);
  const [error, setError] = useState('');
  const [conversionTime, setConversionTime] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryUrl = params.get('url');
      if (queryUrl) setUrl(queryUrl);
    }
  }, []);

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
          setError(conv.errorMessage || 'Download failed');
        }
      } catch { clearInterval(pollRef.current!); }
    }, 2500);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleCheckInfo = async () => {
    if (!url.startsWith('http')) { setError('Please enter a valid URL starting with http:// or https://'); return; }
    setError('');
    setIsFetchingInfo(true);
    try {
      const { data } = await api.post('/convert/universal/metadata', { url });
      setPreflightInfo(data.data);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || 'Failed to fetch video info');
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleDownload = async () => {
    startTimeRef.current = Date.now();
    if (!url.startsWith('http')) { setError('Please enter a valid URL starting with http:// or https://'); return; }
    setError(''); setStatus('processing'); setProgress(0); setConversionTime(null);
    try {
      const { data } = await api.post('/convert/universal', { url, videoQuality: '8K' });
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
    setJobId(''); setVideoInfo(null); setFileSize(null); setError(''); setPreflightInfo(null); setConversionTime(null);
  };

  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center mb-12 pt-8">
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4 text-white">
            Download <span className="text-gradient">Any Video</span>
          </h1>
          <p className="text-white max-w-4xl mx-auto text-lg">
            Paste a link of Instagram, TikTok, Reddit, or any Video URL and download the video as an Video file.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="w-full">
          <div className="glass-panel p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-violet/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

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
                      onChange={(e) => { setUrl(e.target.value); setError(''); setPreflightInfo(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (preflightInfo) handleDownload();
                          else handleCheckInfo();
                        }
                      }}
                      placeholder="https://www.instagram.com/p/..."
                      className="url-input-field"
                    />
                  </div>

                  <AnimatePresence>
                    {preflightInfo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-2xl relative border border-white/10 w-full bg-black/40 mt-6"
                      >
                        {preflightInfo.thumbnail && (
                          <div className="flex flex-col w-full">
                            <div className="w-full aspect-video relative">
                              <Image src={preflightInfo.thumbnail} alt="thumbnail" fill className="object-cover" unoptimized />
                            </div>
                            <div className="p-4 sm:p-6 bg-black/40 flex flex-col gap-2">
                              <h3 className="text-base sm:text-xl font-bold text-white line-clamp-2">{preflightInfo.title}</h3>
                              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm font-medium mt-1 sm:mt-2">
                                <span className="bg-white/10 px-3 py-1.5 rounded-lg text-brand-purple">Quality: {preflightInfo.resolution}{getQualityLabel(preflightInfo.resolution)}</span>
                                {preflightInfo.sizeBytes > 0 && <span className="bg-white/10 px-3 py-1.5 rounded-lg text-brand-cyan">Size: {formatFileSize(preflightInfo.sizeBytes)}</span>}
                              </div>
                            </div>
                          </div>
                        )}
                        {!preflightInfo.thumbnail && preflightInfo.videoUrl && (
                          <div className="flex flex-col w-full">
                            <div className="w-full aspect-video relative bg-black">
                              <video src={`${preflightInfo.videoUrl}#t=0.1`} preload="metadata" className="w-full h-full object-cover" muted playsInline />
                            </div>
                            <div className="p-4 sm:p-6 bg-black/40 flex flex-col gap-2">
                              <h3 className="text-base sm:text-xl font-bold text-white line-clamp-2">{preflightInfo.title}</h3>
                              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm font-medium mt-1 sm:mt-2">
                                <span className="bg-white/10 px-3 py-1.5 rounded-lg text-brand-purple">Quality: {preflightInfo.resolution}{getQualityLabel(preflightInfo.resolution)}</span>
                                {preflightInfo.sizeBytes > 0 && <span className="bg-white/10 px-3 py-1.5 rounded-lg text-brand-cyan">Size: {formatFileSize(preflightInfo.sizeBytes)}</span>}
                              </div>
                            </div>
                          </div>
                        )}
                        {!preflightInfo.thumbnail && !preflightInfo.videoUrl && (
                          <div className="p-4 sm:p-6 bg-black/40">
                            <h3 className="text-base sm:text-xl font-bold text-white mb-3 line-clamp-2">{preflightInfo.title}</h3>
                            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm font-medium">
                              <span className="bg-white/10 px-3 py-1.5 rounded-lg text-brand-purple">Quality: {preflightInfo.resolution}{getQualityLabel(preflightInfo.resolution)}</span>
                              {preflightInfo.sizeBytes > 0 && <span className="bg-white/10 px-3 py-1.5 rounded-lg text-brand-cyan">Size: {formatFileSize(preflightInfo.sizeBytes)}</span>}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex justify-center mt-6">
                    {!preflightInfo ? (
                      <button
                        onClick={handleCheckInfo}
                        disabled={!url || isFetchingInfo}
                        className={`w-[280px] h-14 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${!url ? 'bg-white/5 text-white/40 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] active:scale-95'}`}
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
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={handleDownload}
                          disabled={!url}
                          className={`w-full sm:w-[280px] h-14 rounded-xl font-semibold text-lg transition-all duration-300 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] active:scale-95`}
                        >
                          Download Video </motion.button>
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={reset}
                          className={`w-full sm:w-[200px] h-14 rounded-xl font-semibold text-base transition-all duration-300 bg-white/5 hover:bg-white/10 text-white border border-white/10 active:scale-95`}
                        >
                          Convert Another
                        </motion.button>
                      </div>
                    )}
                  </div>

                </motion.div>

              ) : status === 'processing' ? (
                <ProgressCircle
                  progress={progress}
                  statusText="Downloading & Encoding..."
                  subText={`Fetching highest quality video-this may take a while`}
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

                  <h3 className="text-3xl font-display font-bold text-white mb-3">Video is Ready!</h3>
                  {videoInfo?.title && (
                    <p className="max-w-sm truncate mb-2 text-sm text-white">{videoInfo.title}</p>
                  )}
                  <p className="text-white mb-2 text-lg">
                    Your <strong className="text-brand-purple">Highest Quality</strong> Video video is ready to download.
                  </p>
                  {fileSize && (
                    <p className="text-sm font-medium mb-8 px-4 py-2 rounded-lg inline-block bg-white/5 text-white">
                      Actual Size: <strong className="text-brand-purple">{formatFileSize(fileSize)}</strong>
                      {conversionTime !== null && (
                        <> | Time Taken: <strong className="text-brand-purple">{conversionTime}s</strong></>
                      )}
                    </p>
                  )}
                  {!fileSize && <div className="mb-8" />}

                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                    <a
                      href={apiUrl(`/api/convert/download/${jobId}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <button className="w-full font-semibold rounded-xl flex items-center justify-center gap-2 h-14 transition-all duration-300 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg active:scale-95">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Video </button>
                    </a>
                    <button onClick={reset} className="btn-secondary h-14 w-full sm:w-auto px-8 whitespace-nowrap bg-black/5 hover:bg-white/20 text-white">
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
