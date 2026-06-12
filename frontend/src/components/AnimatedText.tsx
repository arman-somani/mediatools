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
    
    // Split text into words to prevent breaking a word in half on mobile
    const words = text.split(' ');
    
    element.innerHTML = words.map((word) => {
      // For each word, split into letters.
      // We use display: inline-block for letters so transform works.
      // However, if we need text-gradient to work, transform and inline-block break background-clip.
      // We will use position: relative and top instead of transform, and avoid inline-block if possible.
      // Actually, setting display:inline-block on the word, and inline-block on the letter is fine for word-breaking.
      const chars = word.split('').map((char) => {
        // Use position relative and top for animation to preserve text gradients which break on transforms
        return `<span class="anime-letter" style="position:relative; opacity:0; top:20px; display:inline-block;">${char}</span>`;
      }).join('');
      
      return `<span style="display:inline-block; white-space:nowrap;">${chars}</span>`;
    }).join(' ');

    const targets = element.querySelectorAll('.anime-letter');

    anime({
      targets,
      top: ['20px', '0px'],
      opacity: [0, 1],
      easing: 'easeOutExpo',
      duration: 1200,
      delay: anime.stagger(30, { start: delayOffset }),
      complete: () => {
        // After animation, remove inline-block and position relative so background-clip gradients render perfectly
        targets.forEach((el) => {
          (el as HTMLElement).style.display = 'inline';
          (el as HTMLElement).style.position = 'static';
        });
      }
    });

  }, [text, delayOffset]);

  return (
    <span ref={textRef} className={`inline ${className}`}>
      {text}
    </span>
  );
}
