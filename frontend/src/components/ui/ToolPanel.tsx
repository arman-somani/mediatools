import type { ReactNode } from 'react';

interface ToolPanelProps {
  children: ReactNode;
  className?: string;
}

/**
 * The console frame each tool sits in — a bordered surface with a lit top
 * edge and bracket corners. No glow layers: absolutely-positioned children
 * (search dropdowns) are free to overflow as before.
 */
export default function ToolPanel({ children, className = '' }: ToolPanelProps) {
  return (
    <div
      className={`console console-corners anim-fade-up ${className}`}
      style={{ animationDelay: '160ms', '--corner-color': 'rgb(255 255 255 / 0.3)' } as React.CSSProperties}
    >
      <div className="p-5 sm:p-8 md:p-10">{children}</div>
    </div>
  );
}
