'use client';

import { useEffect, useRef } from 'react';
import anime from 'animejs';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    
    // Initial mount animation
    anime({
      targets: wrapperRef.current,
      opacity: [0, 1],
      translateY: [20, 0],
      scale: [0.98, 1],
      duration: 800,
      easing: 'easeOutElastic(1, .8)',
    });
  }, []);

  return (
    <div ref={wrapperRef} className="w-full h-full opacity-0">
      {children}
    </div>
  );
}
