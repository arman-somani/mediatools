'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileAudio, FileVideo, UploadCloud } from 'lucide-react';
import { audioApi, audioApiUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import { useConversionJob, isRunning } from '@/lib/useConversionJob';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';

import PageHeader from '@/components/ui/PageHeader';
import ToolPanel from '@/components/ui/ToolPanel';
import QualitySelector, { type QualityOption } from '@/components/ui/QualitySelector';
import CompletionCard from '@/components/ui/CompletionCard';
import FailureNotice from '@/components/ui/FailureNotice';
import ProgressMeter from '@/components/ProgressMeter';

type Quality = '128' | '192' | '320';

const MAX_BYTES = 250 * 1024 * 1024;

const STAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  sending: { title: 'Uploading your file…', subtitle: 'The upload progress is tracked below.' },
  queued: { title: 'Waiting for a free worker', subtitle: 'Jobs run in the order they arrive — usually a short wait.' },
  processing: { title: 'Extracting the audio track', subtitle: 'FFmpeg is pulling the audio out of your file.' },
  finalizing: { title: 'Almost there', subtitle: 'Generating a high-speed download link.' },
};

export default function ConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<Quality>('192');
  const { state, start, reset } = useConversionJob({
    client: audioApi,
    toAbsolute: audioApiUrl,
    notification: { title: 'Conversion complete', body: 'Your audio file is ready to save.' },
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'] },
    maxFiles: 1,
    maxSize: MAX_BYTES,
    onDropRejected: (r) => {
      const err = r[0]?.errors[0];
      window.alert(
        err?.code === 'file-too-large'
          ? 'That file is over the 250 MB limit — trim it down and try again.'
          : err?.message || 'File rejected',
      );
    },
  });

  const handleConvert = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('quality', quality);
    start(async ({ reportUpload, signal }) => {
      const { data } = await audioApi.post('/convert/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
        onUploadProgress: (e) => {
          if (e.total) reportUpload(Math.round((e.loaded / e.total) * 100));
        },
      });
      return { jobId: data.data.jobId };
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
            index="001"
            label="LOCAL CONVERTER"
            title="Video to audio."
            subtitle="Drop a file below. The audio track comes out untouched — same bitrate ceiling as the source, up to 320 kbps."
          />

          <AnimeReveal delay={80} direction="up" className="mt-12">
            <ToolPanel>
              {state.phase === 'completed' ? (
                <CompletionCard
                  heading="Audio extracted"
                  fileSize={state.fileSize}
                  durationSec={state.durationSec}
                  qualityLabel={`${quality} kbps MP3`}
                  downloadUrl={state.downloadUrl}
                  downloadLabel="Download audio"
                  onDownload={() => window.open(state.downloadUrl, '_blank')}
                  resetLabel="Convert another"
                  onReset={() => {
                    setFile(null);
                    reset();
                  }}
                />
              ) : isRunning(state.phase) ? (
                <ProgressMeter
                  phase={state.phase}
                  progress={state.progress}
                  queuePosition={state.queuePosition}
                  title={STAGE_COPY[state.phase]?.title ?? 'Working…'}
                  subtitle={STAGE_COPY[state.phase]?.subtitle ?? ''}
                />
              ) : (
                <div className="space-y-7">
                  {state.phase === 'failed' && state.error && (
                    <FailureNotice
                      failure={state.error}
                      title={state.error.retriable ? 'That attempt did not go through' : 'This file cannot be converted'}
                      onDismiss={reset}
                    />
                  )}

                  <div {...getRootProps()} className="dropzone p-10 sm:p-12 text-center cursor-pointer" data-active={isDragActive}>
                    <input {...getInputProps()} />
                    {file ? (
                      <div key="file" className="anim-fade-up">
                        <span className="tile tile-lg mx-auto mb-5 text-accent border-accent/25 bg-accent/5">
                          <FileAudio className="w-6 h-6" />
                        </span>
                        <h3 className="text-lg font-semibold text-fg mb-1">{file.name}</h3>
                        <p className="mono-label">{formatFileSize(file.size)} · CLICK TO REPLACE</p>
                      </div>
                    ) : (
                      <div key="empty" className="anim-fade-in">
                        <span className={`tile tile-lg mx-auto mb-5 ${isDragActive ? 'text-accent border-accent/40' : ''}`}>
                          <UploadCloud className="w-6 h-6" strokeWidth={1.75} />
                        </span>
                        <h3 className="text-lg font-semibold text-fg mb-1">
                          {isDragActive ? 'Drop it' : 'Drag a video in'}
                        </h3>
                        <p className="mono-label">OR CLICK TO BROWSE · MP4 AVI MKV WEBM · MAX 250 MB</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <QualitySelector label="OUTPUT QUALITY" options={qualityOptions} value={quality} onSelect={setQuality} />
                    </div>
                    <button onClick={handleConvert} disabled={!file} className="btn-primary btn-lg sm:w-52">
                      <FileVideo className="w-4 h-4" />
                      Convert
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
