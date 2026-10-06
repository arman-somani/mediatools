import type { CSSProperties, ReactNode } from 'react';
import { ACCENTS, type Accent } from './PageHeader';

interface ToolPanelProps {
  accent?: Accent;
  children: ReactNode;
  className?: string;
}

/**
 * The main frosted card each tool lives in. Decorative glows sit in their
 * own clipped layer so absolutely-positioned children (search dropdowns)
 * are never cut off by the panel edge.
 */
export default function ToolPanel({ accent = 'violet', children, className = '' }: ToolPanelProps) {
  const a = ACCENTS[accent];
  return (
    <div
      className={`glass-strong p-5 sm:p-8 md:p-10 anim-fade-up ${className}`}
      style={{ '--accent-glow': a.glow, animationDelay: '160ms' } as CSSProperties}
    >
      <div className="glass-clip">
        <div className="glow-orb w-72 h-72 -top-24 -right-20" style={{ background: a.soft, opacity: 1 }} />
        <div className="glow-orb w-60 h-60 -bottom-24 -left-16" style={{ background: 'rgba(99,102,241,0.12)', opacity: 1 }} />
        <div className="absolute inset-x-10 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${a.to}, transparent)`, opacity: 0.6 }} />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
