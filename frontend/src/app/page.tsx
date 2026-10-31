'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CloudUpload, Download, SlidersHorizontal } from 'lucide-react';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';
import Spotlight from '@/components/Spotlight';

const TOOLS = [
  {
    index: '01',
    name: 'Video to Audio',
    meta: 'LOCAL FILE · MP3',
    description: 'Drop an MP4, MOV, MKV or WebM and pull out a clean audio track at up to 320 kbps.',
    href: '/converter',
  },
  {
    index: '02',
    name: 'YouTube to MP3',
    meta: 'URL · SEARCH BUILT IN',
    description: 'Paste a YouTube link — or just type what you are looking for — and save the audio.',
    href: '/youtube',
  },
  {
    index: '03',
    name: 'Universal Downloader',
    meta: 'URL · MULTI-PLATFORM',
    description: 'Instagram, TikTok, Twitter/X and more. One input for every platform we support.',
    href: '/universal',
  },
];

const STEPS = [
  { icon: CloudUpload, index: '01', title: 'Drop or paste', text: 'Upload a file or paste a link. Search works too — no need to leave the page.' },
  { icon: SlidersHorizontal, index: '02', title: 'Pick a quality', text: 'Bitrate for audio, resolution for video. Up to 320 kbps / 8K.' },
  { icon: Download, index: '03', title: 'Save the file', text: 'A signed link, ready the moment the job finishes. Files self-destruct in an hour.' },
];

const STATS = [
  { value: '320', unit: 'kbps', label: 'MAX AUDIO BITRATE' },
  { value: '8', unit: 'K', label: 'MAX VIDEO RES' },
  { value: '1', unit: 'hr', label: 'UNTIL FILES AUTO-DELETE' },
  { value: '0', unit: '', label: 'ADS · WATERMARKS · LIMITS' },
];

/* ── Interactive console mockup ───────────────────────────────────────
   Not a static screenshot: the waveform tracks the pointer, the quality
   buttons are real, and the job loop runs — idle → converting → done. */

type MockPhase = 'idle' | 'running' | 'done';
const MOCK_BARS = 34;

function ConsoleMockup() {
  const [phase, setPhase] = useState<MockPhase>('running');
  const [progress, setProgress] = useState(38);
  const [quality, setQuality] = useState('320k');
  const [pointerX, setPointerX] = useState(0.5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Loop a fake conversion: run to 100, hold "done", restart.
  useEffect(() => {
    if (phase !== 'running') return;
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        return Math.min(100, p + 1.5);
      });
    }, 90);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (progress >= 100 && phase === 'running') {
      const t = setTimeout(() => setPhase('done'), 700);
      return () => clearTimeout(t);
    }
  }, [progress, phase]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(() => {
      setProgress(8);
      setPhase('running');
    }, 3400);
    return () => clearTimeout(t);
  }, [phase]);

  const bars = useMemo(
    () => Array.from({ length: MOCK_BARS }, (_, i) => 12 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 34 + (i % 5) * 4),
    [],
  );
  const filled = Math.round((progress / 100) * MOCK_BARS);

  return (
    <div
      className="console console-corners"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPointerX(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      }}
      role="img"
      aria-label="Preview of a conversion in progress"
    >
      {/* Panel header strip */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-danger/70" />
          <span className="w-2 h-2 rounded-full bg-warning/70" />
          <span className="w-2 h-2 rounded-full bg-success/70" />
          <span className="mono-label !text-[10px] ml-2">SESSION 07</span>
        </div>
        <span className={`mono-label !text-[10px] flex items-center gap-1.5 ${phase === 'done' ? '!text-success' : '!text-accent'}`}>
          <span className="status-dot" />
          {phase === 'done' ? 'COMPLETE' : 'CONVERTING'}
        </span>
      </div>

      <div className="p-5 sm:p-6">
        {/* Source row */}
        <div className="flex items-center gap-3.5 mb-5">
          <span className="tile !w-10 !h-10 !rounded-lg">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 5.5V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2.5M2 10.5V13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2.5M8 5v6m0 0L5.5 8.5M8 11l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg truncate">summer-roadtrip.mp4</p>
            <p className="mono-label !text-[10px] mt-0.5">148.2 MB · 1080P · H.264</p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
          <span className="badge badge-accent">MP3</span>
        </div>

        {/* Waveform — reacts to pointer position */}
        <div className="card-inset px-4 py-4 mb-5 flex items-end gap-[3px] h-24" aria-hidden="true">
          {bars.map((h, i) => {
            const dist = Math.abs(i / MOCK_BARS - pointerX);
            const boost = Math.max(0, 1 - dist * 4);
            const isPast = i < filled;
            return (
              <span
                key={i}
                className="flex-1 rounded-sm transition-[height] duration-200"
                style={{
                  height: `${Math.min(100, h + boost * 46)}%`,
                  background: isPast ? 'var(--color-accent)' : 'rgb(255 255 255 / 0.14)',
                }}
              />
            );
          })}
        </div>

        {/* Quality — actually clickable */}
        <div className="segmented mb-5" role="presentation">
          {['128k', '192k', '320k'].map((q) => (
            <button
              key={q}
              type="button"
              tabIndex={-1}
              aria-checked={quality === q}
              role="radio"
              onClick={() => setQuality(q)}
              className="segmented-item"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Progress readout */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="mono-label">{phase === 'done' ? 'OUTPUT READY' : 'EXTRACTING AUDIO'}</span>
          <span className="font-mono text-sm text-fg tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progress}%`, transitionDuration: '0.25s' }} />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PageWrapper>
      <div>
        {/* ───────────── Hero ───────────── */}
        <section className="relative overflow-hidden">
          {/* drafting-paper grid, faded out toward the fold */}
          <div className="bg-grid absolute inset-0 pointer-events-none" aria-hidden="true" />

          <div className="container-page relative pt-24 md:pt-36 pb-16 md:pb-24">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-14 lg:gap-16 items-center">
              <div>
                <p className="mono-label anim-fade-up">
                  <span className="text-accent">001</span>
                  <span className="mx-2 text-fg-subtle/60">/</span>
                  MEDIA TOOLS · FREE FOREVER
                </p>

                <h1 className="font-display font-bold tracking-[-0.03em] leading-[0.98] text-[2.9rem] sm:text-6xl lg:text-7xl text-fg mt-6 anim-fade-up" style={{ animationDelay: '80ms' }}>
                  Audio out of
                  <br />
                  anything.
                </h1>

                <p className="text-muted text-lg max-w-lg mt-6 leading-relaxed anim-fade-up" style={{ animationDelay: '180ms' }}>
                  Extract a clean audio track from any video file, or pull MP3 and MP4
                  straight off a URL. No accounts to upgrade, no watermarks, no queues
                  worth waiting in.
                </p>

                <div className="flex flex-wrap gap-3 items-center mt-9 anim-fade-up" style={{ animationDelay: '280ms' }}>
                  <Link id="hero-convert-btn" href="/converter" className="btn-accent btn-lg">
                    Convert a file
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link id="hero-yt-mp3-btn" href="/youtube" className="btn-secondary btn-lg">
                    Paste a YouTube link
                  </Link>
                </div>

                <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] text-fg-muted anim-fade-up" style={{ animationDelay: '380ms' }}>
                  {['320 kbps audio', '8K video', 'Files deleted in 1 hour'].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-success" strokeWidth={2.5} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="anim-fade-up" style={{ animationDelay: '240ms' }}>
                <ConsoleMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ───────────── Tool index ───────────── */}
        <section className="container-page py-16 md:py-24" aria-labelledby="tools-heading">
          <AnimeReveal direction="up" className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="mono-label mb-3">
                <span className="text-accent">002</span>
                <span className="mx-2 text-fg-subtle/60">/</span>
                THE TOOLKIT
              </p>
              <h2 id="tools-heading" className="font-display font-bold text-3xl md:text-4xl tracking-tight text-fg">
                Four tools. One pipeline.
              </h2>
            </div>
            <p className="text-fg-muted text-[15px] max-w-sm">
              Same backend, same speed, different input. Pick the one that matches
              where your file lives.
            </p>
          </AnimeReveal>

          <AnimeReveal staggerDelay={80} delay={100} direction="up" className="border-t border-line">
            {TOOLS.map((tool) => (
              <Spotlight key={tool.href} className="border-b border-line">
                <Link
                  href={tool.href}
                  className="group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[3.5rem_1fr_auto] md:grid-cols-[4.5rem_1.1fr_1.4fr_auto] items-center gap-x-5 md:gap-x-8 py-6 md:py-7 px-1 transition-colors"
                >
                  <span className="mono-label group-hover:text-accent transition-colors">{tool.index}</span>
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-lg sm:text-xl text-fg leading-tight">{tool.name}</h3>
                    <p className="mono-label !text-[10px] mt-1 md:hidden">{tool.meta}</p>
                  </div>
                  <p className="hidden md:block text-sm text-fg-muted leading-relaxed pr-6">{tool.description}</p>
                  <span className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-fg-subtle transition-all duration-200 group-hover:border-accent group-hover:text-accent group-hover:translate-x-0.5">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
              </Spotlight>
            ))}
          </AnimeReveal>
        </section>

        {/* ───────────── How it works ───────────── */}
        <section className="container-page py-16 md:py-24" aria-labelledby="how-heading">
          <div className="rule mb-14" aria-hidden="true" />

          <AnimeReveal direction="up" className="mb-12">
            <p className="mono-label mb-3">
              <span className="text-accent">003</span>
              <span className="mx-2 text-fg-subtle/60">/</span>
              PROCEDURE
            </p>
            <h2 id="how-heading" className="font-display font-bold text-3xl md:text-4xl tracking-tight text-fg">
              Three steps, no detours.
            </h2>
          </AnimeReveal>

          <div className="grid md:grid-cols-3 gap-px bg-line border border-line rounded-xl overflow-hidden">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <AnimeReveal key={s.index} direction="up" delay={i * 90} className="bg-surface">
                  <div className="p-7 md:p-8 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <Icon className="w-5 h-5 text-fg-muted" strokeWidth={1.75} />
                      <span className="mono-label">{s.index}</span>
                    </div>
                    <h3 className="font-display font-semibold text-lg text-fg mb-2">{s.title}</h3>
                    <p className="text-sm text-fg-muted leading-relaxed">{s.text}</p>
                  </div>
                </AnimeReveal>
              );
            })}
          </div>
        </section>

        {/* ───────────── Stats ───────────── */}
        <section className="container-page pb-16 md:pb-24" aria-label="Specifications">
          <AnimeReveal staggerDelay={70} direction="up" className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden">
            {STATS.map((s) => (
              <div key={s.label} className="bg-bg-subtle p-6 md:p-8">
                <p className="font-display font-bold text-3xl md:text-4xl text-fg tabular-nums leading-none">
                  {s.value}
                  {s.unit && <span className="text-base md:text-lg text-accent ml-1">{s.unit}</span>}
                </p>
                <p className="mono-label !text-[10px] mt-3">{s.label}</p>
              </div>
            ))}
          </AnimeReveal>
        </section>

        {/* ───────────── Closing CTA ───────────── */}
        <section className="container-page pb-24 md:pb-32">
          <AnimeReveal direction="up" className="console console-corners text-center">
            <div className="px-6 py-14 md:py-20">
              <p className="mono-label mb-5">
                <span className="text-accent">004</span>
                <span className="mx-2 text-fg-subtle/60">/</span>
                READY WHEN YOU ARE
              </p>
              <h2 className="font-display font-bold text-3xl md:text-5xl tracking-tight text-fg max-w-2xl mx-auto">
                Your first conversion is thirty seconds away.
              </h2>
              <p className="text-fg-muted text-base md:text-lg max-w-md mx-auto mt-5">
                Free, unlimited, and it deletes itself behind you.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-9">
                <Link id="cta-start-btn" href="/converter" className="btn-accent btn-lg">
                  Start converting
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link id="cta-yt-mp3-btn" href="/youtube" className="btn-secondary btn-lg">
                  YouTube to MP3
                </Link>
                <Link id="cta-universal-btn" href="/universal" className="btn-secondary btn-lg">
                  Universal
                </Link>
              </div>
            </div>
          </AnimeReveal>
        </section>
      </div>
    </PageWrapper>
  );
}
