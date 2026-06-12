'use client';

import React, { useEffect, useRef } from 'react';
import anime from 'animejs';

export default function AnimeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create particles
    const particleCount = 40;
    const container = containerRef.current;
    container.innerHTML = ''; // Clean up

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div');
      p.classList.add('anime-particle');
      
      // Random initial positions and sizes
      const size = Math.random() * 4 + 2;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.background = Math.random() > 0.5 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(6, 182, 212, 0.4)';
      p.style.borderRadius = '50%';
      p.style.position = 'absolute';
      p.style.top = `${Math.random() * 100}%`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.filter = 'blur(1px)';
      
      container.appendChild(p);
    }

    const particles = container.querySelectorAll('.anime-particle');

    // Animate particles continuously using anime.js
    anime({
      targets: particles,
      translateX: () => anime.random(-100, 100),
      translateY: () => anime.random(-100, 100),
      scale: () => anime.random(0.5, 2),
      opacity: () => [0, anime.random(0.3, 0.8), 0],
      duration: () => anime.random(4000, 10000),
      delay: anime.stagger(200),
      easing: 'easeInOutQuad',
      direction: 'alternate',
      loop: true
    });

    return () => {
      anime.remove(particles);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden" 
      aria-hidden="true" 
    />
  );
}
