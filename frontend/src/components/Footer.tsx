'use client';

import Link from 'next/link';
import { AudioLines, Mail } from 'lucide-react';
import { GitHubIcon, InstagramIcon } from '@/components/icons';

const columns = [
  {
    title: 'Tools',
    links: [
      { label: 'Video to Audio', href: '/converter' },
      { label: 'YouTube to MP3', href: '/youtube' },
      { label: 'YouTube to MP4', href: '/yt-video' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Feedback', href: '/feedback' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'GitHub Repository', href: 'https://github.com/arman-somani/', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'DMCA', href: '/dmca' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative z-10 px-3 sm:px-5 pb-5 mt-16 md:mt-24">
      <div className="glass mx-auto max-w-6xl px-6 sm:px-10 pt-12 pb-8 overflow-hidden">
        <div className="glass-clip">
          <div className="glow-orb w-80 h-80 -bottom-40 -left-20" style={{ background: 'rgba(139,92,246,0.18)', opacity: 1 }} />
          <div className="glow-orb w-80 h-80 -top-40 -right-20" style={{ background: 'rgba(34,211,238,0.12)', opacity: 1 }} />
        </div>

        <div className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 w-fit">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_20px_rgba(168,85,247,0.45),inset_0_1px_0_rgba(255,255,255,0.45)]">
                <AudioLines className="w-5 h-5 text-white" strokeWidth={2.4} />
              </span>
              <span className="font-display font-bold text-lg tracking-tight text-white">
                Media<span className="text-white/45">TOOlkit</span>
              </span>
            </Link>

            <p className="text-muted text-sm leading-relaxed mb-6 max-w-sm">
              The most advanced, high-quality Audio extraction suite on the web.
              Convert Videos to Audio instantly.
            </p>

            <div className="flex items-center gap-2">
              <a href="https://instagram.com/arman_somani" target="_blank" rel="noopener noreferrer" className="btn-icon" aria-label="Instagram">
                <InstagramIcon className="w-4 h-4" />
              </a>
              <a href="https://github.com/arman-somani/" target="_blank" rel="noopener noreferrer" className="btn-icon" aria-label="GitHub">
                <GitHubIcon className="w-4 h-4" />
              </a>
              <Link href="/contact" className="btn-icon" aria-label="Contact">
                <Mail className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="col-span-1">
              <h4 className="font-semibold text-white mb-4 text-sm tracking-wide">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {'external' in l && l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm text-white/55 hover:text-white transition-colors">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-sm text-white/55 hover:text-white transition-colors">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider relative mb-6" />

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-white/40 text-xs sm:text-sm">
            © {new Date().getFullYear()} MediaTools. All rights reserved.
          </p>
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-emerald-400/[0.08] border border-emerald-400/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            <span className="text-emerald-200/80 text-xs font-medium">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}