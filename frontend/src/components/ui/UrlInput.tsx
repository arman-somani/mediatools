'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { Link2, Search, LoaderCircle, X } from 'lucide-react';

interface UrlInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  placeholder: string;
  /** Switches the leading icon to a magnifier while the text looks like a search query. */
  searchable?: boolean;
  children?: React.ReactNode;
}

/** Large URL field. Pressing "/" anywhere on the page focuses it. */
export default function UrlInput({ id, value, onChange, onEnter, placeholder, searchable, children }: UrlInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const looksLikeUrl = /^https?:\/\//i.test(value);
  const Icon = searchable && value && !looksLikeUrl ? Search : Link2;

  // "/" focuses the field — like GitHub's search. Never while typing elsewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative group">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none z-10 transition-colors group-focus-within:text-accent">
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder={placeholder}
        className="input input-lg !pl-11 pr-24"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {!value && <span className="kbd hidden sm:inline-flex">/</span>}
        {value && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => onChange('')}
            className="w-7 h-7 rounded-md flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle?: string;
}

interface SearchResultsProps {
  isSearching: boolean;
  results: YouTubeSearchResult[];
  onPick: (videoId: string) => void;
}

export function YouTubeSearchResults({ isSearching, results, onPick }: SearchResultsProps) {
  return (
    <div className="menu absolute left-0 right-0 top-full mt-2 z-50 max-h-[420px] overflow-y-auto overflow-x-hidden p-2">
      {isSearching && (
        <div className="p-5 flex items-center justify-center gap-2 text-fg-muted text-sm">
          <LoaderCircle className="w-4 h-4 animate-spin" /> Searching YouTube…
        </div>
      )}
      {!isSearching && results.map((video) => (
        <button
          key={video.videoId}
          type="button"
          onClick={() => onPick(video.videoId)}
          className="w-full flex items-center gap-4 p-2.5 rounded-lg text-left hover:bg-white/[0.06] transition-colors"
        >
          <div className="w-28 sm:w-32 aspect-video rounded-md overflow-hidden flex-shrink-0 relative bg-black/40 border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-fg font-medium text-sm line-clamp-2" dangerouslySetInnerHTML={{ __html: video.title }} />
            {video.channelTitle && <p className="text-fg-subtle text-xs mt-1 truncate">{video.channelTitle}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

export function YouTubePreview({ src }: { src: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line aspect-video w-full bg-black/40 anim-fade-up">
      <Image src={src} alt="YouTube thumbnail" fill className="object-cover opacity-90" unoptimized />
      <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-md bg-bg/85 backdrop-blur-sm border border-line-strong px-2.5 py-1.5 text-xs font-medium text-fg">
        <span className="status-dot text-success" />
        Valid YouTube link
      </div>
    </div>
  );
}
