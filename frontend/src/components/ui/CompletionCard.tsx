'use client';
import Image from 'next/image';
import { Check, Download, RotateCcw, HardDrive, Clock } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import { ACCENTS, type Accent } from './PageHeader';

interface CompletionCardProps {
  accent?: Accent;
  heading: string;
  message: React.ReactNode;
  thumbnail?: string;
  mediaTitle?: string;
  fileSize: number | null;
  conversionTime: number | null;
  downloadLabel: string;
  onDownload: () => void;
  resetLabel: string;
  onReset: () => void;
}

export default function CompletionCard({
  accent = 'violet',
  heading,
  message,
  thumbnail,
  mediaTitle,
  fileSize,
  conversionTime,
  downloadLabel,
  onDownload,
  resetLabel,
  onReset,
}: CompletionCardProps) {
  const a = ACCENTS[accent];

  return (
    <div className="py-4 sm:py-6 flex flex-col items-center text-center anim-scale-in">
      {thumbnail ? (
        <div className="relative w-full max-w-md mb-8">
          <div className="absolute -inset-4 rounded-[2rem] blur-2xl opacity-60" style={{ background: `linear-gradient(135deg, ${a.soft}, rgba(99,102,241,0.15))` }} />
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
            <Image src={thumbnail} alt={mediaTitle || 'Media thumbnail'} fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-white">
              <span className="w-5 h-5 rounded-full bg-emerald-400/90 flex items-center justify-center">
                <Check className="w-3 h-3 text-emerald-950" strokeWidth={3} />
              </span>
              Ready
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mb-7">
          <div className="w-24 h-24 rounded-full flex items-center justify-center bg-emerald-400/10 border border-emerald-300/30 anim-ring-pulse">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-[0_0_40px_rgba(52,211,153,0.55),inset_0_1px_0_rgba(255,255,255,0.5)]">
              <Check className="w-8 h-8 text-emerald-950" strokeWidth={3} />
            </div>
          </div>
        </div>
      )}

      <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">{heading}</h3>
      {mediaTitle && (
        <p className="max-w-md w-full line-clamp-2 mb-2 text-sm text-white/80 px-4 font-medium">{mediaTitle}</p>
      )}
      <p className="text-muted mb-6 text-base sm:text-lg px-2">{message}</p>

      {(fileSize || conversionTime !== null) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {fileSize ? (
            <span className="stat-pill">
              <HardDrive className={`w-4 h-4 ${a.text}`} />
              Size <strong>{formatFileSize(fileSize)}</strong>
            </span>
          ) : null}
          {conversionTime !== null && (
            <span className="stat-pill">
              <Clock className={`w-4 h-4 ${a.text}`} />
              Time <strong>{conversionTime}s</strong>
            </span>
          )}
        </div>
      )}
      {!fileSize && conversionTime === null && <div className="mb-4" />}

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <button id="download-result-btn" onClick={onDownload} className="btn-primary download-btn-pulse flex-1 h-14 text-base">
          <Download className="w-5 h-5" strokeWidth={2.4} />
          {downloadLabel}
        </button>
        <button id="reset-tool-btn" onClick={onReset} className="btn-glass h-14 px-6">
          <RotateCcw className="w-4 h-4" />
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
