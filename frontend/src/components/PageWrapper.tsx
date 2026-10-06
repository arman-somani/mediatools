'use client';

/**
 * Page entrance. Opacity-only on purpose: a lingering transform on this
 * wrapper would become the containing block for `position: fixed` children
 * (modals) and break their full-screen overlay.
 */
export default function PageWrapper({ children }: { children: React.ReactNode }) {
  return <div className="w-full h-full anim-fade-in">{children}</div>;
}
