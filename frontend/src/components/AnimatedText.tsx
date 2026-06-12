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

    // Wrap every non-space character in a span, preserve spaces as-is
    element.innerHTML = text
      .split('')
      .map((char) =>
        char === ' '
          ? ' '
          : `<span class="anime-letter" style="display:inline-block;opacity:0;transform:translateY(20px)">${char}</span>`
      )
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

  }, [text, delayOffset]);

  return (
    <span ref={textRef} className={`inline ${className}`}>
      {text}
    </span>
  );
}
