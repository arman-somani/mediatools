'use client';

import { useRef } from 'react';
import anime from 'animejs';

interface AnimeHoverProps {
  children: React.ReactNode;
  className?: string;
  scaleHover?: number;
  scaleTap?: number;
}

export default function AnimeHover({ 
  children, 
  className = '', 
  scaleHover = 1.05, 
  scaleTap = 0.95 
}: AnimeHoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      scale: scaleHover,
      duration: 400,
      easing: 'easeOutElastic(1, .6)'
    });
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      scale: 1,
      duration: 600,
      easing: 'easeOutElastic(1, .5)'
    });
  };

  const handleMouseDown = () => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      scale: scaleTap,
      duration: 100,
      easing: 'easeOutQuad'
    });
  };

  const handleMouseUp = () => {
    if (!ref.current) return;
    anime({
      targets: ref.current,
      scale: scaleHover,
      duration: 400,
      easing: 'easeOutElastic(1, .6)'
    });
  };

  return (
    <div 
      ref={ref} 
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {children}
    </div>
  );
}
