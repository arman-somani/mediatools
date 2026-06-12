'use client';

import React, { useEffect, useRef } from 'react';
import anime from 'animejs';

interface AnimatedTextProps {
  text: string;
  className?: string;
  delayOffset?: number;
}

export default function AnimatedText({ text, className = '', delayOffset = 0 }: AnimatedTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!textRef.current || animatedRef.current) return;
    animatedRef.current = true;

    const element = textRef.current;
    const isGradient = className.includes('text-gradient');

    // Build letter spans with inline styles for initial hidden state
    element.innerHTML = text
      .split('')
      .map((char) => {
        if (char === ' ') return '&nbsp;';
        // If the parent has text-gradient, each letter needs the gradient styles too
        const gradientStyle = isGradient
          ? 'background:linear-gradient(to right,#7c3aed,#a855f7,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;'
          : '';
        return `<span class="anime-letter" style="display:inline-block;opacity:0;transform:translateY(20px);${gradientStyle}">${char}</span>`;
      })
      .join('');

    const targets = element.querySelectorAll('.anime-letter');

    anime({
      targets,
      translateY: [20, 0],
      opacity: [0, 1],
      easing: 'easeOutExpo',
      duration: 1200,
      delay: anime.stagger(30, { start: delayOffset }),
    });

  }, [text, delayOffset, className]);

  return (
    <span ref={textRef} className="inline">
      {text}
    </span>
  );
}
