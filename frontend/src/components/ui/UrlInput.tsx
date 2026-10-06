'use client';
import Image from 'next/image';
import { Link2, Search, LoaderCircle, X } from 'lucide-react';

interface UrlInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  placeholder: string;
  searchable?: boolean;
  children?: React.ReactNode;
}

/** Large glass URL field. `children` renders inside the positioned wrapper (e.g. a results dropdown). */
export default function UrlInput({ id, value, onChange, onEnter, placeholder, searchable, children }: UrlInputProps) {
  const looksLikeUrl = /^https?:\/\//i.test(value);
  const Icon = searchable && value && !looksLikeUrl ? Search : Link2;
  return (
    <div className="relative group">
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-10 transition-colors group-focus-within:text-violet-300">
        <Icon className="w-5 h-5" />
      </div>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder={placeholder}
        className="url-input-field pr-12"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
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
    <div className="dropdown-glass absolute left-0 right-0 top-full mt-2 z-50 max-h-[420px] overflow-y-auto overflow-x-hidden p-2" style={{ transformOrigin: 'top center' }}>
      {isSearching && (
        <div className="p-5 flex items-center justify-center gap-2 text-white/60 text-sm">
          <LoaderCircle className="w-4 h-4 animate-spin" /> Searching YouTube…
        </div>
      )}
      {!isSearching && results.map((video) => (
        <button
          key={video.videoId}
          type="button"
          onClick={() => onPick(video.videoId)}
          className="w-full flex items-center gap-4 p-2.5 rounded-xl text-left hover:bg-white/[0.07] transition-colors"
        >
          <div className="w-28 sm:w-32 aspect-video rounded-lg overflow-hidden flex-shrink-0 relative bg-black/40 border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-medium text-sm line-clamp-2" dangerouslySetInnerHTML={{ __html: video.title }} />
            {video.channelTitle && <p className="text-white/50 text-xs mt-1 truncate">{video.channelTitle}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

export function YouTubePreview({ src }: { src: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/12 aspect-video w-full bg-black/40 anim-fade-up">
      <Image src={src} alt="YouTube thumbnail" fill className="object-cover opacity-80" unoptimized />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/35 backdrop-blur-md border border-white/15 px-3.5 py-1.5 text-sm font-medium text-white">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
        Valid YouTube link
      </div>
    </div>
  );
}
