'use client';
import { motion } from 'framer-motion';

interface ProgressCircleProps {
  progress: number;
  statusText: string;
  subText?: string;
}

export default function ProgressCircle({ progress, statusText, subText }: ProgressCircleProps) {
  const fillPercentage = Math.max(0, Math.min(progress, 100));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-12 flex-1 flex flex-col items-center justify-center text-center">
      <div className="relative w-40 h-40 mb-8 rounded-full border-[4px] border-white/10 bg-black/40 overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)] flex items-center justify-center">
        
        {/* The Water */}
        <motion.div
          className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-brand-cyan/80 to-brand-purple/80"
          initial={{ height: '0%' }}
          animate={{ height: `${fillPercentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Waves */}
          <div className="absolute top-0 left-1/2 w-[300px] h-[300px] bg-black/40 rounded-[40%] animate-spin-slow mix-blend-overlay pointer-events-none"></div>
          <div className="absolute top-0 left-1/2 w-[300px] h-[300px] bg-black/20 rounded-[45%] animate-spin-slow-reverse mix-blend-overlay pointer-events-none"></div>
        </motion.div>
        
        {/* Percentage Text */}
        <div className="relative z-10 drop-shadow-lg">
          <span className="text-4xl font-bold font-display text-white tracking-tighter">{Math.round(progress)}%</span>
        </div>
      </div>
      
      <h3 className="text-2xl font-display font-bold mb-2 text-white drop-shadow-md">
        {statusText}
      </h3>
      {subText && (
        <p className="text-white/60 text-sm sm:text-base px-4 max-w-sm w-full leading-relaxed break-words">
          {subText}
        </p>
      )}
    </motion.div>
  );
}
