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

  useEffect(() => {
    if (!textRef.current) return;

    // Wrap every letter in a span
    const element = textRef.current;
    element.innerHTML = text.replace(/\S/g, "<span class='anime-letter inline-block opacity-0 translate-y-4'>$&</span>");

    const targets = element.querySelectorAll('.anime-letter');

    anime({
      targets,
      translateY: [20, 0],
      opacity: [0, 1],
      easing: 'easeOutExpo',
      duration: 1200,
      delay: anime.stagger(30, { start: delayOffset })
    });

  }, [text, delayOffset]);

  return (
    <span ref={textRef} className={`inline-block ${className}`}>
      {text}
    </span>
  );
}
