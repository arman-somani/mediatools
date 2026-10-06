'use client';
import { useEffect } from 'react';
import { TriangleAlert, RotateCcw } from 'lucide-react';

interface ErrorDialogProps {
  open: boolean;
  title: string;
  message: string;
  actionLabel: string;
  onClose: () => void;
}

export default function ErrorDialog({ open, title, message, actionLabel, onClose }: ErrorDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md anim-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="error-dialog-title"
    >
      <div className="glass-strong p-7 sm:p-8 max-w-md w-full text-center anim-scale-in">
        <div className="glass-clip">
          <div className="glow-orb w-56 h-56 -top-20 left-1/2 -translate-x-1/2" style={{ background: 'rgba(244,63,94,0.25)', opacity: 1 }} />
        </div>
        <div className="relative">
          <div className="icon-tile w-16 h-16 mx-auto mb-5" style={{ '--tile-glow': 'rgba(244,63,94,0.6)' } as React.CSSProperties}>
            <TriangleAlert className="w-7 h-7 text-rose-300" />
          </div>
          <h3 id="error-dialog-title" className="text-xl sm:text-2xl font-bold text-white mb-2">{title}</h3>
          <p className="text-muted mb-7 leading-relaxed break-words">{message}</p>
          <button id="error-dialog-action" onClick={onClose} className="btn-glass w-full h-12" autoFocus>
            <RotateCcw className="w-4 h-4" />
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
