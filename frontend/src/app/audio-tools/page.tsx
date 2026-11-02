'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  FileAudio,
  Scissors,
  Gauge,
  Volume2,
  Layers,
  Tags,
  UploadCloud,
  CheckCircle2,
  Download,
  RotateCcw,
  Play,
  Pause,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  GripVertical,
  X,
} from 'lucide-react';
import PageWrapper from '@/components/PageWrapper';
import PageHeader from '@/components/ui/PageHeader';
import QueueModal from '@/components/ui/QueueModal';
import ProgressMeter from '@/components/ProgressMeter';
import FailureNotice from '@/components/ui/FailureNotice';
import api, { apiUrl } from '@/lib/api';

type ToolType = 'converter' | 'trimmer' | 'speed' | 'volume' | 'merger' | 'metadata';

const TABS: { id: ToolType; label: string; icon: any; desc: string }[] = [
  { id: 'converter', label: 'Converter', icon: FileAudio, desc: 'Convert audio to MP3, WAV, AAC, FLAC, OGG & more' },
  { id: 'trimmer', label: 'Trimmer', icon: Scissors, desc: 'Cut, slice, and trim audio clips with fade in/out' },
  { id: 'speed', label: 'Speed', icon: Gauge, desc: 'Change tempo from 0.5x to 2.5x without altering pitch' },
  { id: 'volume', label: 'Volume', icon: Volume2, desc: 'Boost volume up to 300% or auto-normalize loudness' },
  { id: 'merger', label: 'Merger', icon: Layers, desc: 'Combine multiple audio tracks into a single MP3' },
  { id: 'metadata', label: 'Metadata', icon: Tags, desc: 'Edit ID3 tags (Title, Artist, Album) & Cover Art' },
];

export default function AudioToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolType>('converter');

  // Common file states
const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const moveFile = (fromIndex: number, toIndex: number) => {
    setSelectedFiles((prev) => {
      const item = prev[fromIndex];
      const newFiles = [...prev];
      newFiles.splice(fromIndex, 1);
      newFiles.splice(toIndex, 0, item);
      return newFiles;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIdx(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== index) moveFile(fromIndex, index);
    setDragIdx(null);
  };
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tool 1: Converter settings
  const [targetFormat, setTargetFormat] = useState('mp3');
  const [targetBitrate, setTargetBitrate] = useState('320');

  // Tool 2: Trimmer settings
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [fadeIn, setFadeIn] = useState<number>(0);
  const [fadeOut, setFadeOut] = useState<number>(0);

  // Tool 3: Speed settings
  const [speed, setSpeed] = useState<number>(1.25);

  // Tool 4: Volume settings
  const [volumePct, setVolumePct] = useState<number>(150);
  const [normalize, setNormalize] = useState<boolean>(false);

  // Tool 6: Metadata settings
  const [metaTitle, setMetaTitle] = useState('');
  const [metaArtist, setMetaArtist] = useState('');
  const [metaAlbum, setMetaAlbum] = useState('');
  const [metaYear, setMetaYear] = useState('');
  const [metaGenre, setMetaGenre] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Processing & Queue states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [estimatedWait, setEstimatedWait] = useState<number>(5);
  const [progress, setProgress] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState<string>('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle URL deep link (?tool=trimmer, etc.)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tool = params.get('tool') as ToolType;
      if (tool && TABS.some((t) => t.id === tool)) {
        setActiveTab(tool);
      }
    }
  }, []);

  // Update audio element when file changes
  useEffect(() => {
    if (!selectedFile) {
      setAudioUrl(null);
      setAudioDuration(0);
      setIsPlaying(false);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setAudioUrl(url);

    const a = new Audio(url);
    a.onloadedmetadata = () => {
      const dur = Math.round(a.duration);
      setAudioDuration(dur);
      setTrimStart(0);
      setTrimEnd(dur || 30);
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  // Handle cover preview
  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  // Polling loop
  useEffect(() => {
    if (!jobId || isCompleted || error) return;

    const poll = async () => {
      try {
        const { data } = await api.get(`/audio-tools/status/${jobId}`);
        const snap = data?.data;
        if (!snap) return;

        if (snap.queuePosition > 0) {
          setQueuePosition(snap.queuePosition);
          setEstimatedWait(snap.estimatedWaitSeconds || snap.queuePosition * 5);
        } else {
          setQueuePosition(0);
        }

        setProgress(snap.progress || 0);

        if (snap.status === 'completed') {
          setIsCompleted(true);
          setDownloadUrl(snap.downloadUrl ? apiUrl(snap.downloadUrl) : null);
          setOutputFilename(snap.outputFilename || 'audio.mp3');
          setFileSize(snap.fileSize || null);
          return;
        }

        if (snap.status === 'failed') {
          setError(snap.errorMessage || 'Operation failed. Please try again.');
          return;
        }

        pollTimerRef.current = setTimeout(poll, 1200);
      } catch (err: any) {
        pollTimerRef.current = setTimeout(poll, 2000);
      }
    };

    pollTimerRef.current = setTimeout(poll, 1000);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [jobId, isCompleted, error]);

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const resetAll = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setSelectedFile(null);
    setSelectedFiles([]);
    setJobId(null);
    setQueuePosition(0);
    setProgress(0);
    setIsCompleted(false);
    setDownloadUrl(null);
    setError(null);
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();

      let endpoint = '';
      if (activeTab === 'converter') {
        if (!selectedFile) throw new Error('Please select an audio file');
        endpoint = '/audio-tools/convert';
        formData.append('file', selectedFile);
        formData.append('format', targetFormat);
        formData.append('bitrate', targetBitrate);
      } else if (activeTab === 'trimmer') {
        if (!selectedFile) throw new Error('Please select an audio file');
        endpoint = '/audio-tools/trim';
        formData.append('file', selectedFile);
        formData.append('startTime', String(trimStart));
        formData.append('endTime', String(trimEnd));
        formData.append('fadeIn', String(fadeIn));
        formData.append('fadeOut', String(fadeOut));
      } else if (activeTab === 'speed') {
        if (!selectedFile) throw new Error('Please select an audio file');
        endpoint = '/audio-tools/speed';
        formData.append('file', selectedFile);
        formData.append('speed', String(speed));
      } else if (activeTab === 'volume') {
        if (!selectedFile) throw new Error('Please select an audio file');
        endpoint = '/audio-tools/volume';
        formData.append('file', selectedFile);
        formData.append('volume', String(volumePct));
        formData.append('normalize', String(normalize));
      } else if (activeTab === 'merger') {
        if (selectedFiles.length < 2) throw new Error('Please select at least 2 audio files to merge');
        endpoint = '/audio-tools/merge';
        selectedFiles.forEach((f) => formData.append('files', f));
      } else if (activeTab === 'metadata') {
        if (!selectedFile) throw new Error('Please select an audio file');
        endpoint = '/audio-tools/metadata';
        formData.append('file', selectedFile);
        if (coverFile) formData.append('cover', coverFile);
        formData.append('title', metaTitle);
        formData.append('artist', metaArtist);
        formData.append('album', metaAlbum);
        formData.append('year', metaYear);
        formData.append('genre', metaGenre);
      }

      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!data?.data?.jobId) throw new Error('Failed to start processing');

      setJobId(data.data.jobId);
      if (data.data.queuePosition > 0) {
        setQueuePosition(data.data.queuePosition);
        setEstimatedWait(data.data.estimatedWaitSeconds || data.data.queuePosition * 5);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper>
      <div className="container-page py-10 max-w-4xl">
        <PageHeader
          index="004"
          label="AUDIO STUDIO"
          title="Audio Studio Tools"
          subtitle="Fast, zero-quality-loss audio utilities. Convert formats, trim clips, alter speed & volume, merge tracks, or edit metadata."
        />

        {/* Tab Selector */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-1.5 rounded-2xl bg-surface-2/60 border border-line">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (!jobId) setActiveTab(tab.id);
                }}
                disabled={!!jobId}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-accent text-bg shadow-lg shadow-accent/20 scale-[1.02]'
                    : 'text-fg-muted hover:text-fg hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Tool Subtitle */}
        <div className="mt-4 px-2 text-center text-xs text-fg-subtle">
          {TABS.find((t) => t.id === activeTab)?.desc}
        </div>

        {/* Queue Notice Modal */}
        <QueueModal
          isOpen={queuePosition > 0}
          queuePosition={queuePosition}
          estimatedWaitSeconds={estimatedWait}
          onCancel={resetAll}
        />

        {/* Error Alert */}
        {error && (
          <div className="mt-6">
            <FailureNotice
              failure={{ code: 'UNKNOWN', message: error, retriable: true }}
              onDismiss={resetAll}
            />
          </div>
        )}

        {/* Processing State */}
        {jobId && !isCompleted && !error && (
          <div className="card-glass mt-6 p-6 sm:p-8 rounded-2xl border border-line">
            <ProgressMeter
              phase={queuePosition > 0 ? 'queued' : 'processing'}
              progress={progress}
              queuePosition={queuePosition}
              title={`Processing ${TABS.find((t) => t.id === activeTab)?.label}`}
              subtitle="Applying FFmpeg filter optimizations in background..."
            />
          </div>
        )}

        {/* Completed State */}
        {isCompleted && downloadUrl && (
          <div className="card-glass mt-6 p-6 sm:p-8 rounded-2xl border border-success/30 bg-surface/90 anim-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 border border-success/30 text-success">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="mono-label !text-[11px] text-success">SUCCESSFULLY PROCESSED</span>
                <h3 className="text-xl font-bold text-fg truncate max-w-md">{outputFilename}</h3>
              </div>
            </div>

            {fileSize && (
              <p className="mt-3 text-xs text-fg-muted">
                File size: {(fileSize / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={downloadUrl}
                download={outputFilename}
                className="btn-accent btn-md flex-1 sm:flex-none"
              >
                <Download className="w-4 h-4 mr-2" />
                Download File
              </a>
              <button
                type="button"
                onClick={resetAll}
                className="btn-secondary btn-md"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Process Another
              </button>
            </div>
          </div>
        )}

        {/* Main Work Area (Visible when not actively processing) */}
        {!jobId && !isCompleted && (
          <div className="card-glass mt-6 p-6 sm:p-8 rounded-2xl border border-line">
            {/* File Upload Zone */}
            {activeTab !== 'merger' ? (
              <div>
                <label className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
                  Select Audio File
                </label>
                <div
                  onClick={() => document.getElementById('single-audio-input')?.click()}
                  className="border-2 border-dashed border-line hover:border-accent/60 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-surface-2/40 hover:bg-surface-2/80"
                >
                  <input
                    id="single-audio-input"
                    type="file"
                    accept="audio/*,.mp3,.wav,.aac,.m4a,.flac,.ogg,.opus,.wma"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                    }}
                    className="hidden"
                  />
                  <UploadCloud className="w-10 h-10 mx-auto text-fg-subtle mb-3" />
                  <p className="text-sm font-semibold text-fg">
                    {selectedFile ? selectedFile.name : 'Click or drop audio file here'}
                  </p>
                  <p className="text-xs text-fg-muted mt-1">
                    Supports MP3, WAV, AAC, M4A, FLAC, OGG, OPUS (up to 100MB)
                  </p>
                </div>

                {/* Audio Preview if available */}
                {audioUrl && (
                  <div className="mt-4 p-3.5 rounded-xl bg-surface-2 border border-line flex items-center justify-between gap-3">
                    <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
                    <button
                      type="button"
                      onClick={togglePlayAudio}
                      className="btn-icon !h-9 !w-9 rounded-lg bg-surface-3 hover:text-accent"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-fg truncate">{selectedFile?.name}</p>
                      <p className="text-[11px] text-fg-subtle">Duration: ~{audioDuration}s</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="btn-icon !h-8 !w-8 text-fg-subtle hover:text-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Merger Multi-File Upload */
              <div>
                <label className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
                  Select Multiple Audio Files to Merge
                </label>
                <div
                  onClick={() => document.getElementById('multi-audio-input')?.click()}
                  className="border-2 border-dashed border-line hover:border-accent/60 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-surface-2/40 hover:bg-surface-2/80"
                >
                  <input
                    id="multi-audio-input"
                    type="file"
                    multiple
                    accept="audio/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        setSelectedFiles((prev) => [...prev, ...newFiles].slice(0, 10));
                      }
                    }}
                    className="hidden"
                  />
                  <Plus className="w-8 h-8 mx-auto text-fg-subtle mb-2" />
                  <p className="text-sm font-semibold text-fg">Click to choose 2 to 10 audio files</p>
                  <p className="text-xs text-fg-muted mt-1">Files will be concatenated in order into one track</p>
                </div>

{selectedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-surface-2 border border-line flex items-center justify-between text-xs cursor-grab"
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        style={{ userSelect: 'none' }}
                      >
                        <span className="font-mono text-accent font-semibold mr-2">#{idx + 1}</span>
                        {dragIdx !== null && dragIdx === idx && (
                          <GripVertical
                            className="w-3 h-3 text-fg-muted"
                          />
                        )}
                        <span className="truncate flex-1 font-medium">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="btn-icon !h-7 !w-7 text-fg-subtle hover:text-danger ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tool-specific Controls */}
            <div className="mt-6 pt-6 border-t border-line">
              {/* 1. Converter Controls */}
              {activeTab === 'converter' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-fg-muted mb-2">TARGET FORMAT</label>
                    <select
                      value={targetFormat}
                      onChange={(e) => setTargetFormat(e.target.value)}
                      className="input w-full"
                    >
                      <option value="mp3">MP3 (Universal)</option>
                      <option value="wav">WAV (Uncompressed)</option>
                      <option value="aac">AAC (Apple / High Efficiency)</option>
                      <option value="m4a">M4A (High Quality)</option>
                      <option value="flac">FLAC (Lossless Studio)</option>
                      <option value="ogg">OGG (Vorbis)</option>
                      <option value="opus">OPUS (Modern Low-Bitrate)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-fg-muted mb-2">AUDIO BITRATE</label>
                    <select
                      value={targetBitrate}
                      onChange={(e) => setTargetBitrate(e.target.value)}
                      className="input w-full"
                      disabled={targetFormat === 'wav' || targetFormat === 'flac'}
                    >
                      <option value="320">320 kbps (High Quality)</option>
                      <option value="256">256 kbps (Standard)</option>
                      <option value="192">192 kbps (Medium)</option>
                      <option value="128">128 kbps (Compact)</option>
                      <option value="64">64 kbps (Voice)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 2. Trimmer Controls */}
              {activeTab === 'trimmer' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">START TIME (SECONDS)</label>
                      <input
                        type="number"
                        min="0"
                        max={trimEnd}
                        step="0.5"
                        value={trimStart}
                        onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
                        className="input w-full font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">END TIME (SECONDS)</label>
                      <input
                        type="number"
                        min={trimStart}
                        step="0.5"
                        value={trimEnd}
                        onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
                        className="input w-full font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">FADE IN (SEC)</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={fadeIn}
                        onChange={(e) => setFadeIn(parseFloat(e.target.value) || 0)}
                        className="input w-full font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">FADE OUT (SEC)</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={fadeOut}
                        onChange={(e) => setFadeOut(parseFloat(e.target.value) || 0)}
                        className="input w-full font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Speed Controls */}
              {activeTab === 'speed' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-fg-muted">SPEED MULTIPLIER</label>
                    <span className="font-mono text-base font-bold text-accent">{speed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
step="0.5"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-fg-subtle mt-1 font-mono">
                    <span>0.5x</span>
                    <span>1x</span>
                    <span>1.5x</span>
                    <span>2x</span>
                    <span>2.5x</span>
                  </div>
                </div>
              )}

              {/* 4. Volume Controls */}
              {activeTab === 'volume' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
  <label className="text-xs font-semibold text-fg-muted">OUTPUT VOLUME</label>
  <span className="font-mono text-base font-bold text-accent">{volumePct}%</span>
</div>

                    <input
                      type="range"
                      min="0"
                      max="4"
                      step="1"
                      value={[50, 100, 150, 200, 300].indexOf(volumePct)}
                      onChange={(e) => setVolumePct([50, 100, 150, 200, 300][parseInt(e.target.value)])}
                      disabled={normalize}
                      className="w-full accent-accent cursor-pointer disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[11px] text-fg-subtle mt-1 font-mono">
                      <span>50%</span>
                      <span>100%</span>
                      <span>150%</span>
                      <span>200%</span>
                      <span>300%</span>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-2 border border-line cursor-pointer">
                    <input
                      type="checkbox"
                      checked={normalize}
                      onChange={(e) => setNormalize(e.target.checked)}
                      className="checkbox"
                    />
                    <div>
                      <p className="text-xs font-semibold text-fg">Auto-Normalize (EBU R128 Standard)</p>
                      <p className="text-[11px] text-fg-muted">Automatically levels quiet and loud parts evenly.</p>
                    </div>
                  </label>
                </div>
              )}

              {/* 5. Merger Controls */}
              {activeTab === 'merger' && (
                <div className="text-xs text-fg-muted">
                  The files will be merged seamlessly into a 320 kbps MP3 track.
                </div>
              )}

              {/* 6. Metadata Controls */}
              {activeTab === 'metadata' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">TRACK TITLE</label>
                      <input
                        type="text"
                        placeholder="Song Title"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">ARTIST</label>
                      <input
                        type="text"
                        placeholder="Artist Name"
                        value={metaArtist}
                        onChange={(e) => setMetaArtist(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">ALBUM</label>
                      <input
                        type="text"
                        placeholder="Album Name"
                        value={metaAlbum}
                        onChange={(e) => setMetaAlbum(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">YEAR</label>
                      <input
                        type="text"
                        placeholder="2026"
                        value={metaYear}
                        onChange={(e) => setMetaYear(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-fg-muted mb-1.5">GENRE</label>
                      <input
                        type="text"
                        placeholder="Pop / Rock / Lo-fi"
                        value={metaGenre}
                        onChange={(e) => setMetaGenre(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fg-muted mb-1.5">ALBUM COVER ART (OPTIONAL)</label>
                    <div className="flex items-center gap-4">
                      {coverPreview && (
                        <div className="relative">
                          <img
                            src={coverPreview}
                            alt="Cover Art"
                            className="w-16 h-16 rounded-xl object-cover border border-line"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCoverFile(null);
                              setCoverPreview(null);
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          if (e.target.files?.[0]) setCoverFile(e.target.files[0]);
                        }}
                        className="text-xs text-fg-muted file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-surface-3 file:text-fg hover:file:bg-white/10"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    (activeTab === 'merger' ? selectedFiles.length < 2 : !selectedFile)
                  }
                  className="btn-accent btn-lg w-full sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting Job...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Execute {TABS.find((t) => t.id === activeTab)?.label}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

