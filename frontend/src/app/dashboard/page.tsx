'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Layers, Download, ShieldCheck, Clock, Music, Clapperboard, Globe,
  ArrowRight, Trash2, RotateCcw, AlertCircle, Shield, X
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';
import AnimeHover from '@/components/AnimeHover';
import { YouTubeIcon } from '@/components/icons';
import { formatFileSize } from '@/lib/utils';

type RecentConversion = {
  _id?: string;
  outputFilename?: string;
  originalName?: string;
  youtubeTitle?: string;
  type?: string;
  status?: string;
  fileSize?: number;
  youtubeUrl?: string;
};

const TOOLS = [
  {
    label: 'Video to Audio',
    description: 'Convert any local video file into crystal-clear MP3 audio.',
    href: '/converter',
    badge: 'Up to 320kbps',
    icon: Music,
    accentColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10 border-orange-500/20',
  },
  {
    label: 'YouTube MP3',
    description: 'Download YouTube videos directly as high-bitrate audio.',
    href: '/youtube',
    badge: 'Fast Extract',
    icon: YouTubeIcon,
    accentColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    label: 'YouTube MP4',
    description: 'Download YouTube videos in crisp quality from 360p up to 8K.',
    href: '/yt-video',
    badge: 'Up to 8K',
    icon: Clapperboard,
    accentColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10 border-cyan-500/20',
  },
  {
    label: 'Universal Video',
    description: 'Save videos from Instagram, TikTok, Twitter/X, and more.',
    href: '/universal',
    badge: 'Multi-Platform',
    icon: Globe,
    accentColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
  },
];

export default function DashboardPage() {
  const [userConversions, setUserConversions] = useState(0);
  const [userDownloads, setUserDownloads] = useState(0);
  const [recentConversions, setRecentConversions] = useState<RecentConversion[]>([]);
  const [error, setError] = useState('');
  const { user, accessToken, updateUser } = useAuthStore();

  useEffect(() => {
    if (!accessToken && !user) {
      return;
    }

    setError('');

    const loadDashboard = async () => {
      try {
        const { data } = await api.get('/user/dashboard');
        if (data.success) {
          if (data.data.user && data.data.user.role !== user?.role) {
            updateUser({ role: data.data.user.role });
          }
          setUserConversions(data.data.stats.totalConversions || 0);
          setUserDownloads(data.data.stats.totalDownloads || 0);
          setRecentConversions(data.data.recentConversions || []);
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          setError('Session expired. Please log in again.');
        } else if (err?.response?.status === 403) {
          setError('Your account is suspended due to security reasons.');
        } else {
          setError('Failed to load dashboard. Make sure the backend server is running.');
        }
      }
    };

    loadDashboard();
  }, [accessToken, user, updateUser]);

  const handleDelete = async (id: string) => {
    try {
      const { data } = await api.delete(`/user/history/${id}`);
      if (data.success) {
        setRecentConversions((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      console.error('Failed to delete conversion', err);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to clear your entire conversion history?')) return;
    try {
      const { data } = await api.delete('/user/history');
      if (data.success) {
        setRecentConversions([]);
      }
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  return (
    <PageWrapper>
      <main className="min-h-screen w-full container-page pt-28 pb-20">
        
        {/* ── Header ── */}
        <AnimeReveal delay={100} direction="up" className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg">Dashboard</h1>
                {user?.role === 'admin' && (
                  <span className="badge text-accent !bg-accent/10 !border-accent/20 font-semibold">
                    Admin
                  </span>
                )}
              </div>
              <p className="mt-2 text-fg-muted text-sm sm:text-base">
                {user ? `Welcome back, ${user.name}` : 'Manage your conversions, track downloads, and launch tools.'}
              </p>
            </div>

            {user?.role === 'admin' && (
              <Link
                href="/admin"
                className="btn-secondary self-start sm:self-auto gap-2"
              >
                <Shield className="w-4 h-4 text-accent" />
                Admin Panel
              </Link>
            )}
          </div>
        </AnimeReveal>

        {/* ── Auth Warning ── */}
        {!user && !accessToken && (
          <AnimeReveal delay={150} direction="up" className="mb-8">
            <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-3 text-amber-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                <p className="text-sm">
                  You are browsing as a guest.{' '}
                  <span className="text-amber-200/80">Sign in to save conversions to your history and sync across devices.</span>
                </p>
              </div>
              <Link href="/auth/login" className="btn-accent btn-sm self-start sm:self-auto flex-shrink-0">
                Sign in
              </Link>
            </div>
          </AnimeReveal>
        )}

        {/* ── Error Banner ── */}
        {error && (
          <div className="mb-8 card p-4 flex items-center justify-between border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="btn-icon btn-sm text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Stats Grid ── */}
        <AnimeReveal delay={200} direction="up" className="mb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Conversions</span>
                <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-fg-muted">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-display text-fg tabular-nums">
                  {userConversions}
                </span>
                <p className="text-xs text-fg-subtle mt-1">Processed media tasks</p>
              </div>
            </div>

            <div className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Downloads</span>
                <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-accent">
                  <Download className="w-4 h-4" />
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-display text-fg tabular-nums">
                  {userDownloads}
                </span>
                <p className="text-xs text-fg-subtle mt-1">Saved files</p>
              </div>
            </div>

            <div className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Account Tier</span>
                <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold text-fg">
                  {user ? (user.role === 'admin' ? 'Administrator' : 'Standard') : 'Guest'}
                </span>
                <p className="text-xs text-fg-subtle mt-1 truncate">
                  {user?.email || 'Sign in for cloud sync'}
                </p>
              </div>
            </div>

            <div className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Recent History</span>
                <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-fg-muted">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-display text-fg tabular-nums">
                  {recentConversions.length}
                </span>
                <p className="text-xs text-fg-subtle mt-1">Files in your session</p>
              </div>
            </div>
          </div>
        </AnimeReveal>

        {/* ── Tools Picker Grid ── */}
        <AnimeReveal delay={300} direction="up" className="mb-12">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-fg">Start a New Conversion</h2>
            <p className="text-sm text-fg-muted">Select a media tool to convert local files or download from web links.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <AnimeHover key={tool.href} className="w-full">
                  <Link
                    href={tool.href}
                    className="card card-hover p-5 flex flex-col h-full group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${tool.iconBg} ${tool.accentColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="badge text-[11px] font-semibold text-fg-subtle">
                        {tool.badge}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-fg group-hover:text-white transition-colors mb-1.5">
                      {tool.label}
                    </h3>
                    <p className="text-xs text-fg-muted leading-relaxed mb-5 flex-1">
                      {tool.description}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted group-hover:text-accent transition-colors pt-2 border-t border-line">
                      <span>Launch tool</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                </AnimeHover>
              );
            })}
          </div>
        </AnimeReveal>

        {/* ── Recent Conversions ── */}
        <AnimeReveal delay={400} direction="up">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-fg">Recent Conversions & Downloads</h2>
                {recentConversions.length > 0 && (
                  <span className="badge text-xs tabular-nums font-mono">
                    {recentConversions.length}
                  </span>
                )}
              </div>

              {recentConversions.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="btn-danger btn-sm text-xs gap-1.5"
                  title="Clear all conversions"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear History
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {recentConversions.length > 0 ? (
                recentConversions.map((conversion, index) => {
                  const isYtAudio = conversion.type === 'youtube';
                  const isYtVideo = conversion.type === 'youtube-Video';
                  const isUniversal = conversion.type === 'universal';

                  const typeLabel = isYtAudio
                    ? 'YouTube MP3'
                    : isYtVideo
                    ? 'YouTube MP4'
                    : isUniversal
                    ? 'Universal Video'
                    : 'Video to Audio';

                  const typeHref = isYtAudio
                    ? '/youtube'
                    : isYtVideo
                    ? '/yt-video'
                    : isUniversal
                    ? '/universal'
                    : '/converter';

                  const rowLink = conversion.youtubeUrl
                    ? `${typeHref}?url=${encodeURIComponent(conversion.youtubeUrl)}`
                    : typeHref;

                  return (
                    <div
                      key={conversion._id || index}
                      className="card-inset p-3.5 sm:p-4 flex items-center justify-between gap-3 group/row hover:border-line-strong transition-colors"
                    >
                      {/* Left: icon & details */}
                      <Link href={rowLink} className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-surface-2 border border-line flex items-center justify-center flex-shrink-0 text-fg-muted group-hover/row:text-accent transition-colors">
                          {isYtAudio ? (
                            <Music className="w-4 h-4 text-rose-400" />
                          ) : isYtVideo ? (
                            <Clapperboard className="w-4 h-4 text-cyan-400" />
                          ) : isUniversal ? (
                            <Globe className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Music className="w-4 h-4 text-orange-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg group-hover/row:text-white truncate" title={conversion.youtubeUrl || conversion.youtubeTitle || conversion.originalName || conversion.outputFilename}>
                            {conversion.youtubeTitle || conversion.originalName || conversion.outputFilename || conversion.youtubeUrl || 'Converted media'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-semibold text-accent/90">
                              {typeLabel}
                            </span>
                            {conversion.youtubeUrl && (
                              <span className="text-[11px] text-fg-subtle truncate max-w-[200px] sm:max-w-xs">
                                · {conversion.youtubeUrl}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Right: metadata & actions */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {conversion.fileSize ? (
                          <span className="text-xs font-mono text-fg-muted px-2.5 py-1 rounded bg-surface border border-line hidden sm:inline-block">
                            {formatFileSize(conversion.fileSize)}
                          </span>
                        ) : null}

                        {conversion.youtubeUrl && (
                          <Link
                            href={rowLink}
                            title="Convert again"
                            className="btn-icon btn-sm text-fg-muted hover:text-fg"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Link>
                        )}

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (conversion._id) handleDelete(conversion._id);
                          }}
                          title="Delete record"
                          className="btn-icon danger btn-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="card-inset p-10 text-center">
                  <div className="w-12 h-12 bg-surface-2 rounded-xl border border-line flex items-center justify-center mx-auto mb-3 text-fg-subtle">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-fg text-sm mb-1">No conversions yet</h3>
                  <p className="text-xs text-fg-muted max-w-sm mx-auto mb-6">
                    Launch any of the media tools above to start extracting audio or downloading video files.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {TOOLS.map((t) => (
                      <Link key={t.href} href={t.href} className="btn-secondary btn-sm text-xs">
                        {t.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </AnimeReveal>

      </main>
    </PageWrapper>
  );
}