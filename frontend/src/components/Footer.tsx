'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative border-t border-black/[0.07] mt-24 transition-colors duration-300"
      style={{ background: 'var(--card-bg)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-brand-purple/5 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">

          {/* Logo & About */}
          <div className="md:col-span-1">
            <Link href="/dashboard" className="flex items-center gap-2 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-violet to-brand-cyan flex items-center justify-center text-white flex-shrink-0">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-white">
                Media<span className="text-white/40">Tools</span>
              </span>
            </Link>

            <p className="text-white/50 text-sm leading-relaxed mb-6">
              The most advanced, high-quality audio extraction suite on the web.
              Convert MP4 and YouTube videos to MP3 instantly.
            </p>

            <div className="flex items-center gap-4 text-white/50">
              <a href="https://instagram.com/arman_somani" target="_blank" rel="noopener noreferrer" className="hover:text-brand-purple transition-colors text-sm">
                INSTAGRAM
              </a>
              <a href="https://github.com/arman-somani/MEDIATOOLS" target="_blank" rel="noopener noreferrer" className="hover:text-brand-purple transition-colors text-sm">
                GitHub
              </a>
              <Link href="/contact" className="hover:text-brand-purple transition-colors text-sm">
                CONTACT
              </Link>
            </div>
          </div>

          {/* Tools */}
          <div>
            <h4 className="font-semibold text-white mb-4">Tools</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/converter" className="text-white/50 hover:text-white transition-colors text-sm">
                  MP4 to MP3
                </Link>
              </li>
              <li>
                <Link href="/youtube" className="text-white/50 hover:text-white transition-colors text-sm">
                  YouTube to MP3
                </Link>
              </li>
              <li>
                <Link href="/yt-video" className="text-white/50 hover:text-white transition-colors text-sm">
                  YouTube to MP4
                </Link>
              </li>
              <li>
                <Link href="/universal" className="text-white/50 hover:text-white transition-colors text-sm">
                  Universal Downloader
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/feedback" className="text-white/50 hover:text-white transition-colors text-sm">
                  Feedback
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-white/50 hover:text-white transition-colors text-sm">
                  Contact Us
                </Link>
              </li>
              <li>
                <a href="https://github.com/arman-somani/MEDIATOOLS" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors text-sm">
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-white/50 hover:text-white transition-colors text-sm">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-white/50 hover:text-white transition-colors text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="text-white/50 hover:text-white transition-colors text-sm">
                  DMCA
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-8 border-t border-black/[0.07] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} MediaTools. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white/50 text-sm">
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}