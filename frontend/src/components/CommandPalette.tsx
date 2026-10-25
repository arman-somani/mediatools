'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

/** Opens the palette from anywhere (e.g. the navbar button). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('mt:palette'));
}

interface Entry {
  label: string;
  hint: string;
  href: string;
  group: 'Tools' | 'Account' | 'Pages';
}

const TOOLS: Entry[] = [
  { label: 'Video to Audio', hint: 'Convert a local file', href: '/converter', group: 'Tools' },
  { label: 'YouTube to MP3', hint: 'Paste a link or search', href: '/youtube', group: 'Tools' },
  { label: 'YouTube to MP4', hint: 'Up to 8K', href: '/yt-video', group: 'Tools' },
  { label: 'Universal Downloader', hint: 'Instagram, TikTok, X and more', href: '/universal', group: 'Tools' },
];

const PAGES: Entry[] = [
  { label: 'Dashboard', hint: 'History and stats', href: '/dashboard', group: 'Account' },
  { label: 'Contact', hint: 'Get in touch', href: '/contact', group: 'Pages' },
  { label: 'Feedback', hint: 'Report a bug or send a note', href: '/feedback', group: 'Pages' },
  { label: 'Privacy Policy', hint: 'Document', href: '/privacy', group: 'Pages' },
  { label: 'Terms of Service', hint: 'Document', href: '/terms', group: 'Pages' },
  { label: 'DMCA', hint: 'Document', href: '/dmca', group: 'Pages' },
];

export default function CommandPalette() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => {
    const account = user?.role === 'admin'
      ? [{ label: 'Admin Panel', hint: 'Users and platform stats', href: '/admin', group: 'Account' as const }, ...PAGES]
      : PAGES.filter((p) => p.href !== '/admin');
    return [...TOOLS, ...account];
  }, [user?.role]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.label.toLowerCase().includes(q) || e.hint.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') close();
    };
    const onOpen = () => {
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mt:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mt:palette', onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) {
      // Focus after the overlay mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const go = useCallback((href: string) => {
    close();
    router.push(href);
  }, [close, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[18vh] bg-black/60 anim-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="menu w-full max-w-lg overflow-hidden !animate-none anim-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="w-4 h-4 text-fg-subtle shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && results[active]) {
                e.preventDefault();
                go(results[active].href);
              }
            }}
            placeholder="Search tools and pages…"
            className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
            aria-label="Search tools and pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          <span className="kbd">ESC</span>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[320px] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-fg-subtle">
              Nothing matches “{query}”.
            </p>
          )}
          {results.map((e, i) => (
            <button
              key={e.href}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(e.href)}
              className="menu-item justify-between"
              data-active={i === active}
            >
              <span className="flex flex-col items-start">
                <span className="text-fg">{e.label}</span>
                <span className="text-[12px] text-fg-subtle">{e.hint}</span>
              </span>
              <span className="mono-label !text-[10px]">{e.group}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
          <span className="mono-label !text-[10px]">↑↓ navigate · ↵ open</span>
          <Link href="/dashboard" onClick={close} className="mono-label !text-[10px] hover:text-fg transition-colors">
            DASHBOARD
          </Link>
        </div>
      </div>
    </div>
  );
}
