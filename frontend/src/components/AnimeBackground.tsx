'use client';

import { useEffect, useRef } from 'react';
import anime from 'animejs';

export default function AnimeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const numOrbs = 15;
    
    // Clear existing orbs in case of re-render
    container.innerHTML = '';

    const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#3b82f6'];

    for (let i = 0; i < numOrbs; i++) {
      const orb = document.createElement('div');
      
      const size = Math.random() * 200 + 50;
      const bg = colors[Math.floor(Math.random() * colors.length)];
      
      orb.style.width = `${size}px`;
      orb.style.height = `${size}px`;
      orb.style.background = bg;
      orb.style.position = 'absolute';
      orb.style.borderRadius = '50%';
      orb.style.filter = 'blur(80px)';
      orb.style.opacity = '0.15';
      
      // Random starting positions
      const startX = Math.random() * window.innerWidth;
      const startY = Math.random() * window.innerHeight;
      
      orb.style.left = `${startX}px`;
      orb.style.top = `${startY}px`;
      
      orb.classList.add('anime-orb');
      container.appendChild(orb);
    }

    // Animate all orbs continuously
    anime({
      targets: '.anime-orb',
      translateX: () => anime.random(-300, 300),
      translateY: () => anime.random(-300, 300),
      scale: () => anime.random(0.8, 1.5),
      duration: () => anime.random(6000, 12000),
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutQuad'
    });

    return () => {
      anime.remove('.anime-orb');
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-gradient-to-b from-[#0a0a0a] to-[#121212]"
    />
  );
}
