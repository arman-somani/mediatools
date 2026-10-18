'use client';

import { useEffect, useRef } from 'react';

interface AnimeRevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
  className?: string;
  staggerDelay?: number;
}

/**
 * Subtle fade/slide-in when the element scrolls into view.
 * Pure CSS transition driven by one IntersectionObserver; no per-frame JS.
 * When `staggerDelay` is set, direct children reveal one after another.
 */
export default function AnimeReveal({
  children,
  delay = 0,
  className = '',
  staggerDelay = 0,
}: AnimeRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets: HTMLElement[] = staggerDelay > 0
      ? (Array.from(el.children) as HTMLElement[])
      : [el];

    targets.forEach((t, i) => {
      t.classList.add('reveal');
      t.style.transitionDelay = `${delay + i * staggerDelay}ms`;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          targets.forEach((t) => t.classList.add('is-visible'));
          observer.disconnect();
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, staggerDelay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
