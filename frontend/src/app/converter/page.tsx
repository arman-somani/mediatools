'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import api, { apiUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgressCircle from '@/components/ProgressCircle';
import PageWrapper from '@/components/PageWrapper';

type Quality = '128' | '192' | '320';
type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';



export default function ConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<Quality>('192');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [conversionTime, setConversionTime] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) { setFile(accepted[0]); setError(''); setStatus('idle'); setJobId(''); setOutputUrl(''); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'] },
    maxFiles: 1,
    maxSize: 250 * 1024 * 1024,
    onDropRejected: (r) => {
      const err = r[0]?.errors[0];
      if (err?.code === 'file-too-large') {
        setError('The video file is too large to convert check the size and try again');
      } else {
        setError(err?.message || 'File rejected');
      }
    },
  });

  const pollStatus = (jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/convert/status/${jobId}`);
        const conv = data.data;
        const totalProgress = 40 + Math.round((conv.progress || 0) * 0.6);
        setProgress(totalProgress);
        if (conv.status === 'completed') {
          clearInterval(pollRef.current!);
          setStatus('completed');
          setProgress(100);
          if (startTimeRef.current) setConversionTime(Math.round((Date.now() - startTimeRef.current) / 1000));
          setOutputUrl(conv.outputUrl || '');
          setFileSize(conv.fileSize || null);
        } else if (conv.status === 'failed') {
          clearInterval(pollRef.current!);
          setStatus('failed');
          setError(conv.errorMessage || 'Conversion failed');
        }
      } catch { clearInterval(pollRef.current!); }
    }, 1500);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleConvert = async () => {
    startTimeRef.current = Date.now();
    if (!file) return;
    setStatus('uploading'); setProgress(0); setError(''); setJobId(''); setOutputUrl(''); setFileSize(null); setConversionTime(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('quality', quality);

    try {
      const { data } = await api.post('/convert/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 40));
        },
      });
      const newJobId: string = data.data.jobId;
      setJobId(newJobId);
      setStatus('processing');
      pollStatus(newJobId);
    } catch (err: unknown) {
      setStatus('failed');
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Upload failed. Please try again.');
    }
  };

  const reset = () => { setFile(null); setStatus('idle'); setProgress(0); setJobId(''); setOutputUrl(''); setFileSize(null); setError(''); setConversionTime(null); };

  return (
    <ProtectedRoute>
      <PageWrapper>
        <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center mb-12 pt-8">
            <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4 text-white">
              High-Fidelity <span className="text-gradient">Audio Extraction</span>
            </h1>
            <p className="text-white max-w-2x.5 mx-auto text-lg">
              Drop your video file below. Our cloud cluster will extract the Audio track without losing quality.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="w-full">
            <div className="glass-panel p-8 md:p-12 relative overflow-hidden">
              {/* Subtle background glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

              {status === 'idle' || status === 'failed' ? (
                <div className="relative z-10 space-y-8">
                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-brand-purple bg-brand-purple/5 scale-[1.01]' : 'border-white/10 bg-black/[0.02] hover:border-black/20 hover:bg-black/[0.04]'}`}
                  >
                    <input {...getInputProps()} />
                    <AnimatePresence mode="wait">
                      {file ? (
                        <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                          <div className="w-20 h-20 mx-auto bg-brand-purple/20 rounded-2xl flex items-center justify-center mb-6 border border-brand-purple/30 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                            <svg width="40" height="40" fill="none" stroke="var(--color-brand-purple)" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-2">{file.name}</h3>
                          <p className="text-white font-medium">{formatFileSize(file.size)}</p>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2">{isDragActive ? 'Drop to upload' : 'Drag & drop your video'}</h3>
                          <p className="text-white text-sm">or click to browse files (MP4, AVI, MKV up to 250MB)</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Controls: quality + button on same row, perfectly aligned */}
                  <div className="flex flex-col md:flex-row gap-4">
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

                    {/* Button ? aligned to quality track top using invisible spacer label */}
                    <div className="flex flex-col justify-start">
                      <label className="quality-label opacity-0 select-none">BTN</label>
                      <motion.button
                        whileHover={file ? { scale: 1.05 } : {}}
                        whileTap={file ? { scale: 0.95 } : {}}
                        onClick={handleConvert}
                        disabled={!file}
                        className={`min-w-[160px] h-[46px] rounded-xl font-semibold transition-colors duration-300 ${!file ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]'}`}
                      >
                        Convert to Audio </motion.button>
                    </div>
                  </div>

                </div>
              ) : status === 'processing' || status === 'uploading' ? (
                <ProgressCircle
                  progress={progress}
                  statusText={status === 'uploading' ? 'Uploading & Analyzing...' : 'Converting Audio...'}
                  subText={`Please wait while we process your file.`}
                />
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center flex flex-col items-center">
                  <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                    <svg width="40" height="40" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-3xl font-display font-bold text-white mb-3">Conversion Complete!</h3>
                  <p className="text-white mb-2 text-lg">Your Audio file is successfully extracted and ready for download.</p>
                  {fileSize && (
                    <p className="text-sm font-medium mb-8 px-4 py-2 rounded-lg inline-block" style={{ background: 'var(--quality-track-bg)', color: 'var(--quality-btn-idle-color)' }}>
                      Actual Size: <strong className="text-brand-purple">{formatFileSize(fileSize)}</strong>
                      {conversionTime !== null && (
                        <> | Time Taken: <strong className="text-brand-purple">{conversionTime}s</strong></>
                      )}
                    </p>
                  )}
                  {!fileSize && <div className="mb-8" />}

                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                    <a href={apiUrl(`/api/convert/download/${jobId}`)} target="_blank" rel="noopener noreferrer" className="flex-1 block">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full btn-primary-glow flex items-center justify-center gap-2 h-14">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Audio </motion.button>
                    </a>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={reset} className="btn-secondary h-14 w-full sm:w-auto px-8 whitespace-nowrap bg-black/5 hover:bg-white/20 text-white">
                      Convert Another
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

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
                  <h3 className="text-2xl font-bold text-white mb-2">Upload or Conversion Failed</h3>
                  <p className="text-white/70 mb-8">
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
      </PageWrapper>
    </ProtectedRoute>
  );
}
