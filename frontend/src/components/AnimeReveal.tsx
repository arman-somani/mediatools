'use client';

import { useEffect, useRef } from 'react';
import anime from 'animejs';

interface AnimeRevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
  className?: string;
  staggerDelay?: number; // If children should stagger
}

export default function AnimeReveal({ 
  children, 
  delay = 0, 
  direction = 'up', 
  duration = 800,
  className = '',
  staggerDelay = 0
}: AnimeRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !animatedRef.current) {
          animatedRef.current = true;
          
          let translateY = 0;
          let translateX = 0;
          
          if (direction === 'up') translateY = 30;
          if (direction === 'down') translateY = -30;
          if (direction === 'left') translateX = 30;
          if (direction === 'right') translateX = -30;

          // If staggerDelay is set, we animate the children individually
          if (staggerDelay > 0) {
            anime({
              targets: ref.current?.children,
              opacity: [0, 1],
              translateY: translateY !== 0 ? [translateY, 0] : 0,
              translateX: translateX !== 0 ? [translateX, 0] : 0,
              delay: anime.stagger(staggerDelay, { start: delay }),
              duration,
              easing: 'easeOutElastic(1, .8)'
            });
          } else {
            anime({
              targets: ref.current,
              opacity: [0, 1],
              translateY: translateY !== 0 ? [translateY, 0] : 0,
              translateX: translateX !== 0 ? [translateX, 0] : 0,
              delay,
              duration,
              easing: 'easeOutElastic(1, .8)'
            });
          }
          
          observer.disconnect();
        }
      });
    }, { threshold: 0.1 });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [delay, direction, duration, staggerDelay]);

  return (
    <div ref={ref} className={`${className} ${staggerDelay === 0 ? 'opacity-0' : ''}`}>
      {children}
    </div>
  );
}
