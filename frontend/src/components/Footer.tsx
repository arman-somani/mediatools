'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative border-t border-black/[0.07] mt-16 md:mt-24 transition-colors duration-300"
      style={{ background: 'var(--card-bg)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-brand-purple/5 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-12 md:py-16 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-10 md:gap-12 mb-12 md:mb-16">

          {/* Logo & About */}
          <div className="col-span-2 sm:col-span-3 md:col-span-2">
            <Link href="/dashboard" className="flex items-center gap-2 mb-4 group w-fit">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-violet to-brand-cyan flex items-center justify-center text-white flex-shrink-0">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-white">
                Media<span className="text-white/40">TOOlkit</span>
              </span>
            </Link>

            <p className="text-white/50 text-sm md:text-base leading-relaxed mb-6 max-w-sm">
              The most advanced, high-quality audio extraction suite on the web.
              Convert Video and YouTube videos to Audio  instantly.
            </p>

            <div className="flex items-center gap-4 text-white/50 flex-wrap">
              <a href="https://instagram.com/arman_somani" target="_blank" rel="noopener noreferrer" className="hover:text-brand-purple transition-colors text-xs md:text-sm font-medium tracking-wide">
                INSTAGRAM
              </a>
              <a href="https://github.com/arman-somani/mediatools" target="_blank" rel="noopener noreferrer" className="hover:text-brand-purple transition-colors text-xs md:text-sm font-medium tracking-wide">
                GITHUB
              </a>
              <Link href="/contact" className="hover:text-brand-purple transition-colors text-xs md:text-sm font-medium tracking-wide">
                CONTACT
              </Link>
            </div>
          </div>

          {/* Tools */}
          <div className="col-span-1">
            <h4 className="font-semibold text-white mb-4 text-sm md:text-base tracking-wide">Tools</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/converter" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  Video to Audio
                </Link>
              </li>
              <li>
                <Link href="/youtube" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  YouTube to Audio
                </Link>
              </li>
              <li>
                <Link href="/yt-video" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  YouTube to Video
                </Link>
              </li>
              <li>
                <Link href="/universal" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  Universal Downloader
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="col-span-1">
            <h4 className="font-semibold text-white mb-4 text-sm md:text-base tracking-wide">Resources</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/feedback" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  Feedback
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  Contact Us
                </Link>
              </li>
              <li>
                <a href="https://github.com/arman-somani/mediatools" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="col-span-1 sm:col-span-1">
            <h4 className="font-semibold text-white mb-4 text-sm md:text-base tracking-wide">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="text-white/50 hover:text-white transition-colors text-sm md:text-base">
                  DMCA
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-8 border-t border-black/[0.07] flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <p className="text-white/40 text-xs md:text-sm">
            © {new Date().getFullYear()} MediaTools. All rights reserved.
          </p>
          <div className="flex items-center gap-2 justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white/50 text-xs md:text-sm">
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}