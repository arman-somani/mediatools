'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  ArrowRight, Zap, AudioLines, ShieldCheck, Check, Music, Clapperboard, CloudUpload,
  SlidersHorizontal, Download, FileVideoCamera, Sparkles,
} from 'lucide-react';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';
import AnimatedText from '@/components/AnimatedText';
import { YouTubeIcon } from '@/components/icons';

const TOOLS = [
  {
    title: 'Video to Audio',
    description: 'Drop any MP4, MOV, MKV or WebM file and pull out a clean audio track.',
    href: '/converter',
    badge: 'Up to 320kbps',
    icon: Music,
    from: '#7c3aed', to: '#c084fc', glow: 'rgba(168,85,247,0.6)',
  },
  {
    title: 'YouTube MP3',
    description: 'Search or paste a YouTube link and save it straight to audio.',
    href: '/youtube',
    badge: 'Search built-in',
    icon: YouTubeIcon,
    from: '#e11d48', to: '#fb7185', glow: 'rgba(244,63,94,0.55)',
  },
  {
    title: 'YouTube MP4',
    description: 'Download full videos from 360p all the way up to 8K resolution.',
    href: '/yt-video',
    badge: 'Up to 8K',
    icon: Clapperboard,
    from: '#0891b2', to: '#67e8f9', glow: 'rgba(34,211,238,0.55)',
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'FFmpeg-powered conversion on our servers. Most files convert in under 30 seconds.',
    glow: 'rgba(168,85,247,0.6)', color: 'text-violet-300',
  },
  {
    icon: AudioLines,
    title: 'Studio Quality',
    description: 'Choose from 128kbps, 192kbps, or lossless 320kbps Audio output quality.',
    glow: 'rgba(34,211,238,0.55)', color: 'text-cyan-300',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Private',
    description: 'Files are auto-deleted after 1 hour. Your data is never stored permanently.',
    glow: 'rgba(52,211,153,0.55)', color: 'text-emerald-300',
  },
];

const STEPS = [
  { icon: CloudUpload, title: 'Drop or paste', text: 'Upload a video file or paste a YouTube link.' },
  { icon: SlidersHorizontal, title: 'Pick quality', text: 'Select bitrate or resolution — up to 320kbps / 8K.' },
  { icon: Download, title: 'Download', text: 'Grab your file the moment it is ready.' },
];

function HeroMockup() {
  const bars = [14, 26, 18, 34, 22, 40, 28, 46, 30, 38, 20, 32, 44, 24, 36, 18, 30, 42, 26, 16, 34, 22, 28, 12];
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      {/* Halo */}
      <div className="absolute -inset-10 rounded-[3rem] bg-gradient-to-br from-violet-600/35 via-fuchsia-500/20 to-cyan-400/30 blur-3xl" aria-hidden="true" />

      <div className="glass-strong relative p-5 sm:p-6 anim-float">
        {/* Window chrome */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-300/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="badge text-white/70"><Sparkles className="w-3 h-3 text-fuchsia-300" /> Converting</span>
        </div>

        {/* File row */}
        <div className="glass-inset p-3.5 flex items-center gap-3 mb-4">
          <div className="icon-tile w-11 h-11 !rounded-xl" style={{ '--tile-glow': 'rgba(168,85,247,0.6)' } as CSSProperties}>
            <FileVideoCamera className="w-5 h-5 text-violet-200" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">summer-roadtrip.mp4</p>
            <p className="text-xs text-white/50">148.2 MB · 1080p</p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/40" />
          <span className="badge text-violet-200 !bg-violet-500/15 !border-violet-400/25">MP3</span>
        </div>

        {/* Waveform */}
        <div className="glass-sunken px-4 py-5 mb-4 flex items-center justify-between gap-[3px] h-24" aria-hidden="true">
          {bars.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full ${i < 15 ? '' : 'opacity-30'}`}
              style={{
                height: h,
                background: i < 15 ? `linear-gradient(180deg, #67e8f9, #a855f7 60%, #ec4899)` : 'rgba(255,255,255,0.6)',
                animation: `bar-grow-${(i % 4) + 1} ${0.8 + (i % 5) * 0.15}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>

        {/* Quality */}
        <div className="quality-track mb-4 pointer-events-none" aria-hidden="true">
          {['128k', '192k', '320k'].map((q) => (
            <span key={q} className={`quality-btn ${q === '320k' ? 'active' : ''}`}>{q}</span>
          ))}
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-white/60 mb-2">
          <span>Extracting audio…</span>
          <span className="font-semibold text-white tabular-nums">72%</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 shadow-[0_0_14px_rgba(217,70,239,0.7)]" />
        </div>
      </div>

      {/* Floating chips */}
      <div className="glass absolute -left-4 sm:-left-10 top-24 px-3.5 py-2.5 !rounded-2xl flex items-center gap-2.5 anim-float-delayed">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-cyan-400 to-violet-500"><AudioLines className="w-4 h-4 text-white" /></span>
        <div className="leading-tight"><p className="text-[11px] text-white/50">Bitrate</p><p className="text-sm font-bold text-white">320 kbps</p></div>
      </div>
      <div className="glass absolute -right-3 sm:-right-8 bottom-16 px-3.5 py-2.5 !rounded-2xl flex items-center gap-2.5 anim-float-delayed" style={{ animationDelay: '-5s' }}>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-rose-500 to-fuchsia-500"><Clapperboard className="w-4 h-4 text-white" /></span>
        <div className="leading-tight"><p className="text-[11px] text-white/50">Video</p><p className="text-sm font-bold text-white">Up to 8K</p></div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PageWrapper>
      <div className="relative text-white">

        {/* ───────────── Hero ───────────── */}
        <section className="relative px-5 sm:px-6 pt-36 md:pt-44 pb-20 md:pb-28">
          <div className="mx-auto max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-16 lg:gap-10 items-center">
            <div className="text-center lg:text-left">
              <span className="chip mb-7 anim-fade-up">
                <span className="chip-dot"><Sparkles className="w-3 h-3 text-white" /></span>
                100% free · No limits · No watermarks
              </span>

              <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                <AnimatedText text="Convert Video into" /><br />
                <span className="text-gradient-animated">
                  <AnimatedText text="Best-Quality Audio" delayOffset={500} />
                </span>
              </h1>

              <p className="text-muted text-lg md:text-xl max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed anim-fade-up" style={{ animationDelay: '300ms' }}>
                The fastest way to extract Audio from Video files or use our YouTube URL Downloader with
                Zero quality loss.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-center lg:justify-start anim-fade-up" style={{ animationDelay: '420ms' }}>
                <Link id="hero-convert-btn" href="/converter" className="btn-primary h-14 px-7 text-base">
                  Convert Video to Audio
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link id="hero-yt-mp3-btn" href="/youtube" className="btn-glass h-14 px-6 text-base">
                  <YouTubeIcon className="w-5 h-5 text-rose-400" />
                  YouTube MP3
                </Link>
                <Link id="hero-yt-mp4-btn" href="/yt-video" className="btn-glass h-14 px-6 text-base">
                  <Clapperboard className="w-5 h-5 text-cyan-300" />
                  YouTube MP4
                </Link>
              </div>

              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 justify-center lg:justify-start text-sm text-white/60 anim-fade-up" style={{ animationDelay: '540ms' }}>
                {['Up to 320kbps audio', 'Up to 8K video', 'Files auto-delete in 1h'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-300" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="anim-fade-up px-6 sm:px-10 lg:px-0" style={{ animationDelay: '250ms' }}>
              <HeroMockup />
            </div>
          </div>
        </section>

        {/* ───────────── Tools ───────────── */}
        <section className="px-5 sm:px-6 py-16 md:py-24" aria-labelledby="tools-heading">
          <div className="mx-auto max-w-6xl">
            <AnimeReveal direction="up" className="text-center mb-12 md:mb-16">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-violet-300/80 mb-3">The Toolkit</p>
              <h2 id="tools-heading" className="text-3xl md:text-5xl font-bold mb-4">
                Everything You Need to <span className="text-gradient">Extract Audio</span>
              </h2>
              <p className="text-muted text-base md:text-lg max-w-xl mx-auto">
                Professional-grade Audio extraction tools, built for everyone.
              </p>
            </AnimeReveal>

            <AnimeReveal staggerDelay={110} delay={100} direction="up" className="grid gap-5 md:grid-cols-3">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="glass glass-interactive group p-7 flex flex-col opacity-0 overflow-hidden"
                  >
                    <div className="glass-clip">
                      <div className="glow-orb w-56 h-56 -top-24 -right-16 transition-opacity duration-500 opacity-40 group-hover:opacity-90" style={{ background: tool.glow }} />
                    </div>
                    <div className="relative flex items-start justify-between mb-8">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${tool.from}, ${tool.to})`, boxShadow: `0 12px 30px -8px ${tool.glow}, inset 0 1px 0 rgba(255,255,255,0.45)` }}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="badge text-white/75">{tool.badge}</span>
                    </div>
                    <h3 className="relative text-xl font-bold text-white mb-2">{tool.title}</h3>
                    <p className="relative text-muted leading-relaxed mb-8">{tool.description}</p>
                    <span className="relative mt-auto inline-flex items-center gap-2 text-sm font-semibold text-white/85 group-hover:text-white">
                      Open tool
                      <span className="w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.08] border border-white/15 transition-transform duration-300 group-hover:translate-x-1">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </span>
                  </Link>
                );
              })}
            </AnimeReveal>
          </div>
        </section>

        {/* ───────────── Features + Steps ───────────── */}
        <section className="px-5 sm:px-6 py-16 md:py-24" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl grid lg:grid-cols-5 gap-5">
            <AnimeReveal direction="up" className="lg:col-span-2 glass-strong p-8 md:p-10 flex flex-col overflow-hidden">
              <div className="glass-clip">
                <div className="glow-orb w-72 h-72 -bottom-24 -right-24" style={{ background: 'rgba(217,70,239,0.25)', opacity: 1 }} />
              </div>
              <p className="relative text-sm font-semibold tracking-[0.2em] uppercase text-fuchsia-300/80 mb-3">How it works</p>
              <h2 id="features-heading" className="relative text-3xl md:text-4xl font-bold mb-8">Three steps. <span className="text-gradient">Zero friction.</span></h2>
              <ol className="relative space-y-4 mt-auto">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <li key={s.title} className="glass-inset p-4 flex items-center gap-4">
                      <span className="relative w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.07] border border-white/12 shrink-0">
                        <Icon className="w-5 h-5 text-white/90" />
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_10px_rgba(217,70,239,0.6)]">{i + 1}</span>
                      </span>
                      <div>
                        <p className="font-semibold text-white">{s.title}</p>
                        <p className="text-sm text-white/55">{s.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </AnimeReveal>

            <AnimeReveal staggerDelay={110} delay={150} direction="up" className="lg:col-span-3 grid sm:grid-cols-2 gap-5">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className={`glass glass-interactive p-7 opacity-0 ${i === 2 ? 'sm:col-span-2' : ''}`}>
                    <div className="icon-tile w-14 h-14 mb-6" style={{ '--tile-glow': f.glow } as CSSProperties}>
                      <Icon className={`w-6 h-6 ${f.color}`} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-muted leading-relaxed">{f.description}</p>
                  </div>
                );
              })}
            </AnimeReveal>
          </div>
        </section>

        {/* ───────────── CTA ───────────── */}
        <section className="px-5 sm:px-6 py-16 md:py-24">
          <AnimeReveal direction="up" className="mx-auto max-w-4xl glass-strong p-10 md:p-14 text-center overflow-hidden">
            <div className="glass-clip">
              <div className="glow-orb w-96 h-96 -top-48 left-1/2 -translate-x-1/2" style={{ background: 'rgba(139,92,246,0.35)', opacity: 1 }} />
              <div className="glow-orb w-72 h-72 -bottom-40 -left-10" style={{ background: 'rgba(34,211,238,0.2)', opacity: 1 }} />
              <div className="glow-orb w-72 h-72 -bottom-40 -right-10" style={{ background: 'rgba(236,72,153,0.2)', opacity: 1 }} />
            </div>
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                100% Free <span className="text-gradient">No Limits</span>
              </h2>
              <p className="text-muted text-base md:text-lg mb-9 max-w-xl mx-auto">
                No subscriptions, no hidden fees. Every feature is free always with unlimited conversions.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link id="cta-start-btn" href="/converter" className="btn-primary h-13 px-7 py-3.5">
                  Start Converting <ArrowRight className="w-4 h-4" />
                </Link>
                <Link id="cta-yt-mp3-btn" href="/youtube" className="btn-glass px-6 py-3.5">
                  <YouTubeIcon className="w-5 h-5 text-rose-400" /> YouTube MP3
                </Link>
                <Link id="cta-yt-mp4-btn" href="/yt-video" className="btn-glass px-6 py-3.5">
                  <Clapperboard className="w-5 h-5 text-cyan-300" /> YouTube MP4
                </Link>
              </div>
            </div>
          </AnimeReveal>
        </section>
      </div>
    </PageWrapper>
  );
}