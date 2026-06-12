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
      const chars = word.split('').map((char) => {
        return `<span class="anime-letter" style="position:relative; opacity:0; top:20px; display:inline-block;">${char}</span>`;
      }).join('');
      
      return `<span class="anime-word" style="display:inline-block; white-space:nowrap;">${chars}</span>`;
    }).join(' ');

    const targets = element.querySelectorAll('.anime-letter');
    const wordTargets = element.querySelectorAll('.anime-word');

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
        wordTargets.forEach((el) => {
          (el as HTMLElement).style.display = 'inline';
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
