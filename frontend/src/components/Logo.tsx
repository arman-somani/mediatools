import Link from 'next/link';

/** Brand mark: a simple waveform glyph on an accent tile. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[6px] bg-accent text-accent-fg shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 16 16" fill="none">
        <path d="M2 7v2M5 4.5v7M8 2.5v11M11 5v6M14 7v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 shrink-0 ${className}`} aria-label="MediaTools home">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-fg">MediaTools</span>
    </Link>
  );
}
