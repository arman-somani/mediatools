'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileAudio, UploadCloud } from 'lucide-react';
import api, { audioApi, audioApiUrl } from '@/lib/api';
import { pollConversion, describeFailure } from '@/lib/conversion';
import { formatFileSize } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgressCircle from '@/components/ProgressCircle';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import AnimeReveal from '@/components/AnimeReveal';
import AnimeHover from '@/components/AnimeHover';

import PageHeader from '@/components/ui/PageHeader';
import ToolPanel from '@/components/ui/ToolPanel';
import QualitySelector, { type QualityOption } from '@/components/ui/QualitySelector';
import CompletionCard from '@/components/ui/CompletionCard';
import ErrorDialog from '@/components/ui/ErrorDialog';

type Quality = '128' | '192' | '320';
type Status = 'idle' | 'queued' | 'uploading' | 'processing' | 'completed' | 'downloading' | 'failed';

export default function ConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<Quality>('192');
  const [status, setStatus] = useState<Status>('idle');
  const [queuePosition, setQueuePosition] = useState(0);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [conversionTime, setConversionTime] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const cancelPollRef = useRef<(() => void) | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) { setFile(accepted[0]); setError(''); setStatus('idle'); setJobId(''); }
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

  const pollStatus = (id: string) => {
    cancelPollRef.current?.();
    cancelPollRef.current = pollConversion({
      client: audioApi,
      jobId: id,
      toAbsolute: audioApiUrl,
      handlers: {
        onQueued: (position) => {
          setStatus('queued');
          setQueuePosition(position);
        },
        onProgress: (value) => {
          setStatus('processing');
          setProgress(value);
        },
        onCompleted: (url, snapshot) => {
          setStatus('completed');
          setProgress(100);
          if (startTimeRef.current) {
            setConversionTime(Math.round((Date.now() - startTimeRef.current) / 1000));
          }
          setFileSize(snapshot.fileSize ?? null);
          setDownloadUrl(url);
          sendNotification('Conversion Complete! 🔄', 'Your local file has finished converting and is ready to save.');
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
    if (!file) return;
    requestNotificationPermission();
    setStatus('uploading'); setProgress(0); setError(''); setCanRetry(false); setJobId(''); setDownloadUrl(''); setFileSize(null); setConversionTime(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('quality', quality);

    try {
      const { data } = await audioApi.post('/convert/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      const newJobId: string = data.data.jobId;
      setJobId(newJobId);
      setStatus('processing');
      setProgress(0);
      pollStatus(newJobId);
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
    setFile(null); setStatus('idle'); setProgress(0);
    setJobId(''); setDownloadUrl(''); setFileSize(null);
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
          icon={<FileAudio className="w-5 h-5" />}
          eyebrow="Local Converter"
          title={
            <>
              High-Fidelity <span className="text-gradient">Audio Extraction</span>
            </>
          }
          subtitle="Drop your video file below. Our cloud cluster will extract the Audio track without losing quality."
          accent="fuchsia"
        />

        <AnimeReveal delay={100} direction="up" className="w-full mt-12">
          <ToolPanel accent="fuchsia">
            {status === 'idle' || status === 'failed' ? (
              <div className="relative z-10 space-y-8">
                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-fuchsia-400 bg-fuchsia-400/5 scale-[1.01] drag-active-pulse' : 'border-white/10 bg-black/[0.02] hover:border-white/20 hover:bg-black/[0.04]'}`}
                >
                  <input {...getInputProps()} />
                  {file ? (
                    <div key="file" className="animate-in zoom-in-95 fade-in duration-300">
                      <div className="w-20 h-20 mx-auto bg-fuchsia-400/20 rounded-2xl flex items-center justify-center mb-6 border border-fuchsia-400/30 shadow-[0_0_30px_rgba(232,121,249,0.2)]">
                        <FileAudio className="w-10 h-10 text-fuchsia-300" />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">{file.name}</h3>
                      <p className="text-white/70 font-medium">{formatFileSize(file.size)}</p>
                    </div>
                  ) : (
                    <div key="empty" className="animate-in fade-in duration-300">
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6 border transition-all duration-300 ${isDragActive ? 'bg-fuchsia-400/10 border-fuchsia-400/30 text-fuchsia-400 shadow-[0_0_15px_rgba(232,121,249,0.3)]' : 'bg-white/5 border-white/10 text-white/50'}`}>
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{isDragActive ? 'Drop to upload' : 'Drag & drop your video'}</h3>
                      <p className="text-white/50 text-sm">or click to browse files (MP4, AVI, MKV up to 250MB)</p>
                    </div>
                  )}
                </div>

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
                    <AnimeHover scaleHover={file ? 1.05 : 1} scaleTap={file ? 0.95 : 1}>
                      <button
                        onClick={handleConvert}
                        disabled={!file}
                        className={`w-full min-w-[160px] h-[46px] rounded-xl font-semibold transition-colors duration-300 ${!file ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed' : 'btn-primary'}`}
                      >
                        Convert to Audio
                      </button>
                    </AnimeHover>
                  </div>
                </div>

              </div>
            ) : status === 'processing' || status === 'uploading' || status === 'queued' || status === 'downloading' ? (
              <ProgressCircle
                progress={progress}
                statusText={status === 'queued' ? `Queued (Position: ${queuePosition})` : status === 'uploading' ? 'Uploading File...' : status === 'downloading' ? 'Downloading Audio...' : 'Converting Audio...'}
                subText={status === 'queued' ? 'Waiting for other conversions to finish...' : status === 'downloading' ? 'Saving file to your device.' : `Please wait while we process your file.`}
              />
            ) : (
              <CompletionCard
                accent="fuchsia"
                heading="Conversion Complete!"
                message="Your Audio file is successfully extracted and ready for download."
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
          title={canRetry ? 'Conversion Did Not Complete' : 'This File Cannot Be Converted'}
          message={error}
          actionLabel={canRetry ? 'Try Again' : 'Choose A Different File'}
          onClose={() => { setError(''); setCanRetry(false); setStatus('idle'); }}
        />
      </div>
    </ProtectedRoute>
  );
}
