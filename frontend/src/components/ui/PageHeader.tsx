import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Zero-padded index, e.g. "001" — reads like a numbered chapter plate. */
  index: string;
  /** Short mono label, e.g. "LOCAL CONVERTER". */
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}

export default function PageHeader({ index, label, title, subtitle, className = '' }: PageHeaderProps) {
  return (
    <header className={`w-full anim-fade-up ${className}`}>
      <p className="mono-label">
        <span className="text-accent">{index}</span>
        <span className="mx-2 text-fg-subtle/60">/</span>
        {label}
      </p>
      <h1
        className="font-display font-bold text-4xl sm:text-5xl tracking-tight leading-[1.02] text-fg mt-4 anim-fade-up"
        style={{ animationDelay: '60ms' }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="text-muted text-base sm:text-lg leading-relaxed max-w-xl mt-4 anim-fade-up"
          style={{ animationDelay: '120ms' }}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}
