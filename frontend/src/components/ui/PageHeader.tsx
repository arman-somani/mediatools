import type { ReactNode } from 'react';

export type Accent = 'violet' | 'rose' | 'cyan' | 'fuchsia' | 'emerald';

export const ACCENTS: Record<Accent, { from: string; to: string; glow: string; text: string; soft: string }> = {
  violet: { from: '#7c3aed', to: '#c084fc', glow: 'rgba(168,85,247,0.7)', text: 'text-violet-300', soft: 'rgba(139,92,246,0.18)' },
  rose: { from: '#e11d48', to: '#fb7185', glow: 'rgba(244,63,94,0.65)', text: 'text-rose-300', soft: 'rgba(244,63,94,0.16)' },
  cyan: { from: '#0891b2', to: '#67e8f9', glow: 'rgba(34,211,238,0.6)', text: 'text-cyan-300', soft: 'rgba(34,211,238,0.15)' },
  fuchsia: { from: '#a21caf', to: '#f0abfc', glow: 'rgba(217,70,239,0.65)', text: 'text-fuchsia-300', soft: 'rgba(217,70,239,0.16)' },
  emerald: { from: '#059669', to: '#6ee7b7', glow: 'rgba(52,211,153,0.6)', text: 'text-emerald-300', soft: 'rgba(52,211,153,0.15)' },
};

interface PageHeaderProps {
  icon?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: Accent;
  align?: 'center' | 'left';
  className?: string;
}

export default function PageHeader({ icon, eyebrow, title, subtitle, accent = 'violet', align = 'center', className = '' }: PageHeaderProps) {
  const a = ACCENTS[accent];
  const centered = align === 'center';
  return (
    <header className={`w-full ${centered ? 'text-center flex flex-col items-center' : ''} ${className}`}>
      {eyebrow && (
        <span className="chip mb-6 anim-fade-up">
          <span className="chip-dot text-white" style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})`, boxShadow: `0 0 14px ${a.glow}` }}>
            {icon}
          </span>
          {eyebrow}
        </span>
      )}
      <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.05] text-white mb-4 anim-fade-up" style={{ animationDelay: '60ms' }}>
        {title}
      </h1>
      {subtitle && (
        <p className={`text-muted text-base sm:text-lg leading-relaxed max-w-2xl ${centered ? 'mx-auto' : ''} anim-fade-up`} style={{ animationDelay: '120ms' }}>
          {subtitle}
        </p>
      )}
    </header>
  );
}
