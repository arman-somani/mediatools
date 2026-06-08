'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { isValidYouTubeUrl } from '@/lib/utils';
import Image from 'next/image';

type Quality = '128' | '192' | '320';

interface Video {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
}

interface DownloadState {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  progress: number;
  jobId?: string;
  error?: string;
}

export default function PlaylistDownloader() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('192');
  const [status, setStatus] = useState<'idle' | 'fetching' | 'fetched' | 'failed'>('idle');
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});

  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    return () => {
      Object.values(pollRefs.current).forEach(clearInterval);
    };
  }, []);

  const fetchPlaylist = async () => {
    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }
    setError('');
    setStatus('fetching');
    try {
      const { data } = await api.post('/convert/youtube-playlist/metadata', { url });
      setVideos(data.data.mp4s);
      setStatus('fetched');
    } catch (err: any) {
      setStatus('failed');
      setError(err.response?.data?.message || 'Failed to fetch playlist');
    }
  };

  const poll = (videoId: string, jobId: string) => {
    pollRefs.current[videoId] = setInterval(async () => {
      try {
        const { data } = await api.get(`/convert/status/${jobId}`);
        const conv = data.data;
        setDownloads(prev => ({
          ...prev,
          [videoId]: {
            ...prev[videoId],
            progress: Math.round(conv.progress || 0),
            status: conv.status === 'completed' || conv.status === 'failed' ? conv.status : 'processing',
            error: conv.errorMessage,
          },
        }));
        if (conv.status === 'completed' || conv.status === 'failed') {
          clearInterval(pollRefs.current[videoId]);
        }
      } catch {
        clearInterval(pollRefs.current[videoId]);
      }
    }, 2000);
  };

  const downloadVideo = async (video: Video) => {
    setDownloads(prev => ({ ...prev, [video.id]: { status: 'processing', progress: 0 } }));
    try {
      const { data } = await api.post('/convert/youtube', { url: video.url, quality });
      const jobId = data.data.jobId;
      setDownloads(prev => ({ ...prev, [video.id]: { status: 'processing', progress: 0, jobId } }));
      poll(video.id, jobId);
    } catch (err: any) {
      setDownloads(prev => ({
        ...prev,
        [video.id]: { status: 'failed', progress: 0, error: err.response?.data?.message || 'Failed to start' },
      }));
    }
  };

  const convertAll = () => {
    const targetVideos = selectedIds.size > 0 ? videos.filter(v => selectedIds.has(v.id)) : videos;
    targetVideos.forEach(video => {
      const dl = downloads[video.id];
      if (!dl || dl.status === 'failed') downloadVideo(video);
    });
  };

  const downloadAll = () => {
    const targetVideos = selectedIds.size > 0 ? videos.filter(v => selectedIds.has(v.id)) : videos;
    const completedVideos = targetVideos.filter(v => downloads[v.id]?.status === 'completed');
    completedVideos.forEach((video, index) => {
      const jobId = downloads[video.id].jobId;
      if (jobId) {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = `${process.env.NEXT_PUBLIC_API_URL}/api/convert/download/${jobId}`;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, index * 500);
      }
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleAllSelection = () => {
    if (selectedIds.size === videos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(videos.map(v => v.id)));
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 relative z-10">
        <div className="w-10 h-10 rounded-full bg-brand-purple/20 flex items-center justify-center border border-brand-purple/30">
          <svg width="20" height="20" fill="none" stroke="var(--color-brand-purple)" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Playlist Downloader</h2>
          <p className="text-sm text-white/60">Download multiple songs easily</p>
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 space-y-6 flex-1 flex flex-col">

        {/* URL Input */}
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-10 transition-colors group-focus-within:text-brand-purple">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && fetchPlaylist()}
            placeholder="Paste Playlist URL..."
            className="url-input-field"
          />
        </div>

        {/* Quality + Load button */}
        <div className="flex flex-col sm:flex-row items-end gap-6">
          <div className="w-full flex-1">
            <label className="quality-label">GLOBAL QUALITY</label>
            <div className="quality-track">
              {(['128', '192', '320'] as Quality[]).map(q => (
                <button key={q} onClick={() => setQuality(q)} className={`quality-btn${quality === q ? ' active' : ''}`}>
                  {q}k
                </button>
              ))}
            </div>
          </div>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={fetchPlaylist}
            disabled={!url || status === 'fetching'}
            className={`w-full sm:w-auto min-w-[160px] h-[54px] rounded-xl font-semibold transition-all duration-300 ${!url ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}
          >
            {status === 'fetching' ? 'Loading...' : 'Load Playlist'}
          </motion.button>
        </div>

        {/* Playlist section */}
        {status === 'fetched' && videos.length > 0 && (
          <div className="flex flex-col gap-4">
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={convertAll}
                className="flex-1 bg-black/5 hover:bg-brand-purple hover:text-white text-white font-semibold py-3 rounded-xl transition-all duration-200 border border-white/10 hover:border-brand-purple hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]"
              >
                Convert {selectedIds.size > 0 ? `Selected (${selectedIds.size})` : 'All'}
              </motion.button>
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={downloadAll}
                className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-semibold py-3 rounded-xl transition-all duration-200 border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                Download {selectedIds.size > 0 ? `Selected (${selectedIds.size})` : 'All'} Completed
              </motion.button>
            </div>

            {/* Select All bar */}
            <motion.div
              whileHover={{ y: -2 }}
              onClick={toggleAllSelection}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all duration-200 ${selectedIds.size > 0
                ? 'bg-brand-purple/10 border-brand-purple/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${selectedIds.size > 0 ? 'bg-brand-purple shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'border-2 border-black/30'}`}>
                  {selectedIds.size === videos.length && videos.length > 0 && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                  {selectedIds.size > 0 && selectedIds.size < videos.length && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  )}
                </div>
                <span className={`text-sm font-semibold ${selectedIds.size > 0 ? 'text-brand-purple' : 'text-white'}`}>
                  {selectedIds.size === videos.length && videos.length > 0 ? 'Deselect All' : 'Select All'}
                </span>
              </div>
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-md ${selectedIds.size > 0 ? 'bg-brand-purple/20 text-brand-purple' : 'bg-white/10 text-white'}`}>
                {selectedIds.size} / {videos.length}
              </div>
            </motion.div>

            {/* Video list */}
            <div className="flex-1 max-h-[400px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
              {videos.map((video, idx) => {
                const download = downloads[video.id];
                const isProcessing = download?.status === 'processing';
                const isCompleted = download?.status === 'completed';
                const isSelected = selectedIds.has(video.id);

                return (
                  <motion.div
                    key={video.id + idx}
                    whileHover={{ y: -2 }}
                    className={`border rounded-xl p-3 flex items-center gap-3 transition-all duration-200 ${isSelected
                      ? 'border-brand-purple/50 bg-brand-purple/5 shadow-[0_0_12px_rgba(168,85,247,0.1)]'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                  >
                    {/* Checkbox */}
                    <div
                      onClick={() => toggleSelection(video.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${isSelected ? 'bg-brand-purple shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'border-2 border-black/30 hover:border-brand-purple'}`}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-14 h-10 relative rounded-md overflow-hidden flex-shrink-0 bg-black cursor-pointer" onClick={() => toggleSelection(video.id)}>
                      <Image src={video.thumbnail} alt={video.title} fill className="object-cover" unoptimized />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{video.title}</p>
                      {isProcessing && (
                        <div className="w-full bg-white/10 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div className="bg-brand-purple h-full rounded-full transition-all duration-300" style={{ width: `${download.progress}%` }} />
                        </div>
                      )}
                      {download?.error && <p className="text-xs text-red-500 mt-1">Video is not available or cannot be converted.</p>}
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL}/api/convert/download/${download.jobId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-3 bg-emerald-500/20 text-emerald-600 rounded-lg text-xs font-semibold flex items-center hover:bg-emerald-500/30 transition-colors"
                        >
                          Download
                        </a>
                      ) : isProcessing ? (
                        <div className="h-9 px-3 bg-white/5 text-white rounded-lg text-xs font-medium flex items-center border border-white/10">
                          {download.progress}%
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => downloadVideo(video)}
                          className="h-9 px-3 rounded-lg text-xs font-semibold transition-all bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                        >
                          Convert
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        <style dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.25); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(168,85,247,0.5); }
        `}} />
      </div>

      {/* Error Modal */}
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
              className="bg-white#111] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                <svg width="32" height="32" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Error Occurred</h3>
              <p className="text-white/70 mb-8">
                Playlist can't be converted for Audio , or playlist is not available. Please check the URL you pasted.
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
    </>
  );
}
