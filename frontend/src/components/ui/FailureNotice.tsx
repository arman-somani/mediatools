'use client';

import { TriangleAlert, X } from 'lucide-react';
import type { FailureInfo } from '@/lib/conversion';

interface FailureNoticeProps {
  failure: FailureInfo;
  title?: string;
  onDismiss: () => void;
}

/**
 * Inline failure readout. The old design threw a modal at the user for every
 * failed conversion, which hid the form right when they needed to change the
 * input; this keeps the failure next to the controls that caused it.
 */
export default function FailureNotice({ failure, title, onDismiss }: FailureNoticeProps) {
  return (
    <div className="alert alert-error anim-fade-up" role="alert">
      <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[13.5px]">
          {title ?? (failure.retriable ? 'That attempt did not go through' : 'This one cannot be converted')}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed break-words">{failure.message}</p>
        {failure.retriable && (
          <p className="mt-1.5 text-[12px] text-fg-subtle">You can press the button again to retry.</p>
        )}
      </div>
      <button onClick={onDismiss} aria-label="Dismiss" className="btn-icon !w-6 !h-6 shrink-0 -mr-1 -mt-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
