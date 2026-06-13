'use client';
import { motion } from 'framer-motion';
import ProtectedRoute from '@/components/ProtectedRoute';
import Image from 'next/image';

export default function SetupEnginePage() {
  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center mb-12 pt-8">
          <div className="w-24 h-24 bg-brand-cyan/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-brand-cyan/20 shadow-[0_0_40px_rgba(45,212,191,0.2)]">
            <svg width="48" height="48" fill="none" stroke="#2dd4bf" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight mb-4 text-white">
            Almost <span className="text-gradient">Done!</span>
          </h1>
          <p className="text-white max-w-2xl mx-auto text-lg text-white/70">
            Download the MediaTools Engine to enable native background downloads directly from your browser.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="w-full max-w-lg">
          <div className="glass-panel p-8 relative overflow-hidden flex flex-col items-center text-center">
            
            <div className="mb-8 space-y-4">
              <div className="flex items-center gap-4 text-white">
                <div className="w-8 h-8 rounded-full bg-brand-cyan/20 flex items-center justify-center text-brand-cyan font-bold">1</div>
                <div className="text-left">
                  <h4 className="font-semibold text-lg">Download the Engine</h4>
                  <p className="text-sm text-white/50">A tiny background helper application.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-white">
                <div className="w-8 h-8 rounded-full bg-brand-cyan/20 flex items-center justify-center text-brand-cyan font-bold">2</div>
                <div className="text-left">
                  <h4 className="font-semibold text-lg">Run the Installer</h4>
                  <p className="text-sm text-white/50">It installs instantly in less than a second.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-white">
                <div className="w-8 h-8 rounded-full bg-brand-cyan/20 flex items-center justify-center text-brand-cyan font-bold">3</div>
                <div className="text-left">
                  <h4 className="font-semibold text-lg">Start Downloading</h4>
                  <p className="text-sm text-white/50">The extension will automatically activate.</p>
                </div>
              </div>
            </div>

            <a href="/install_media_tools.exe" download className="btn-primary w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-brand-cyan/20 transition-all hover:scale-[1.02] flex items-center justify-center">
              Download MediaTools Engine
            </a>
            <p className="text-xs text-white/30 mt-4">For Windows 10/11 • Run install_media_tools.exe</p>
          </div>
        </motion.div>

      </div>
    </ProtectedRoute>
  );
}
