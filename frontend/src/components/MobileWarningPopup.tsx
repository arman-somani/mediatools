'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function MobileWarningPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasDismissed = localStorage.getItem('mobileWarningDismissed');
    
    if (isMobile && !hasDismissed) {
      // Delay slightly for better UX
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('mobileWarningDismissed', 'true');
    setIsOpen(false);
  };

  const goToConverter = () => {
    localStorage.setItem('mobileWarningDismissed', 'true');
    setIsOpen(false);
    router.push('/converter');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-panel p-6 sm:p-8 rounded-3xl max-w-sm w-full text-center relative border border-white/20 shadow-2xl"
          >
            {/* Warning Icon */}
            <div className="w-16 h-16 bg-brand-violet/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-violet/30 shadow-[0_0_30px_rgba(124,58,237,0.3)]">
              <svg width="32" height="32" fill="none" stroke="#a78bfa" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-3">Mobile Detected</h3>
            <p className="text-white/70 mb-8 text-sm">
              We noticed you're on a mobile device. While you can use the <strong className="text-white">MP4 to MP3 Converter</strong> here, you will need a <strong className="text-brand-cyan">Desktop or Laptop</strong> for full access to our advanced YouTube download tools and Chrome extensions.
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={goToConverter}
                className="w-full py-3.5 btn-primary rounded-xl font-bold text-white transition-transform hover:scale-[1.02] shadow-lg shadow-brand-violet/20"
              >
                Use Audio Converter
              </button>
              <button
                onClick={handleDismiss}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-medium rounded-xl transition-all"
              >
                Continue Anyway
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
