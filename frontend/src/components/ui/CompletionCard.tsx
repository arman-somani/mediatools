'use client';

import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Download, RotateCcw } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface CompletionCardProps {
  heading: string;
  thumbnail?: string;
  mediaTitle?: string;
  fileSize: number | null;
  durationSec: number | null;
  /** Human label of what was produced, e.g. "320 kbps MP3" or "1080p MP4". */
  qualityLabel?: string;
  /** Signed link — used by the copy action. The download button goes through onDownload. */
  downloadUrl: string;
  downloadLabel: string;
  onDownload: () => void;
  resetLabel: string;
  onReset: () => void;
}

export default function CompletionCard({
  heading,
  thumbnail,
  mediaTitle,
  fileSize,
  durationSec,
  qualityLabel,
  downloadUrl,
  downloadLabel,
  onDownload,
  resetLabel,
  onReset,
}: CompletionCardProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      toast.success('Download link copied — it expires, so use it soon.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link in this browser.');
    }
  };

  return (
    <div className="anim-fade-up" role="status">
      <div className="flex items-center gap-3 mb-6">
        <span className="tile !w-9 !h-9 !rounded-lg border-success/30 bg-success/10 text-success">
          <Check className="w-4.5 h-4.5" strokeWidth={2.5} />
        </span>
        <div>
          <p className="mono-label !text-success">READY</p>
          <h3 className="text-xl font-bold text-fg leading-tight">{heading}</h3>
        </div>
      </div>

      {thumbnail && (
        <div className="relative aspect-video rounded-xl overflow-hidden border border-line mb-5 anim-fade-in">
          <Image src={thumbnail} alt={mediaTitle || 'Media thumbnail'} fill className="object-cover" unoptimized />
        </div>
      )}
      {mediaTitle && (
        <p className="text-sm text-fg-muted line-clamp-2 mb-5">{mediaTitle}</p>
      )}

      {(fileSize !== null || durationSec !== null || qualityLabel) && (
        <dl className="card-inset px-4 py-2 mb-7">
          {fileSize !== null && fileSize > 0 && (
            <div className="stat-row">
              <dt className="mono-label">FILE SIZE</dt>
              <dd>{formatFileSize(fileSize)}</dd>
            </div>
          )}
          {durationSec !== null && (
            <div className="stat-row">
              <dt className="mono-label">TOOK</dt>
              <dd>{durationSec}s</dd>
            </div>
          )}
          {qualityLabel && (
            <div className="stat-row">
              <dt className="mono-label">OUTPUT</dt>
              <dd>{qualityLabel}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button id="download-result-btn" onClick={onDownload} className="btn-primary btn-lg flex-1">
          <Download className="w-4.5 h-4.5" strokeWidth={2.2} />
          {downloadLabel}
        </button>
        <button onClick={copyLink} className="btn-secondary btn-lg" title="Copy the signed download link">
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button id="reset-tool-btn" onClick={onReset} className="btn-ghost btn-lg">
          <RotateCcw className="w-4 h-4" />
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
