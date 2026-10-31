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
  },
  {
    label: 'YouTube MP3',
    description: 'Download YouTube videos directly as high-bitrate audio.',
    href: '/youtube',
    badge: 'Fast extract',
    icon: YouTubeIcon,
  },
  {
    label: 'Universal Video',
    description: 'Save videos from Instagram, TikTok, Twitter/X, and more.',
    href: '/universal',
    badge: 'Multi-platform',
    icon: Globe,
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
        <AnimeReveal delay={80} direction="up" className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-6">
            <div>
              <p className="mono-label mb-2">
                <span className="text-accent">DASH</span>
                <span className="mx-2 text-fg-subtle/60">/</span>
                YOUR ACCOUNT
              </p>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">Dashboard</h1>
                {user?.role === 'admin' && <span className="badge badge-accent">Admin</span>}
              </div>
              <p className="mt-2 text-fg-muted text-sm sm:text-base">
                {user ? `Welcome back, ${user.name}.` : 'Manage your conversions, track downloads, and launch tools.'}
              </p>
            </div>

            {user?.role === 'admin' && (
              <Link href="/admin" className="btn-secondary self-start sm:self-auto gap-2">
                <Shield className="w-4 h-4 text-accent" />
                Admin panel
              </Link>
            )}
          </div>
        </AnimeReveal>

        {/* ── Auth Warning ── */}
        {!user && !accessToken && (
          <AnimeReveal delay={140} direction="up" className="mb-8">
            <div className="alert alert-warn">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="flex-1">
                You are browsing as a guest. Sign in to save conversions to your history and sync across devices.
              </p>
              <Link href="/auth/login" className="btn-accent btn-sm self-start sm:self-auto flex-shrink-0">
                Sign in
              </Link>
            </div>
          </AnimeReveal>
        )}

        {/* ── Error Banner ── */}
        {error && (
          <div className="mb-8 alert alert-error">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="btn-icon !w-6 !h-6" aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Stats Grid ── */}
        <AnimeReveal delay={200} direction="up" className="mb-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden">
            <div className="bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="mono-label">CONVERSIONS</span>
                <Layers className="w-4 h-4 text-fg-subtle" />
              </div>
              <span className="font-display text-3xl font-bold text-fg tabular-nums">{userConversions}</span>
              <p className="text-xs text-fg-subtle mt-1">Processed media tasks</p>
            </div>

            <div className="bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="mono-label">DOWNLOADS</span>
                <Download className="w-4 h-4 text-accent" />
              </div>
              <span className="font-display text-3xl font-bold text-fg tabular-nums">{userDownloads}</span>
              <p className="text-xs text-fg-subtle mt-1">Saved files</p>
            </div>

            <div className="bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="mono-label">ACCOUNT</span>
                <ShieldCheck className="w-4 h-4 text-fg-subtle" />
              </div>
              <span className="font-display text-xl sm:text-2xl font-bold text-fg">
                {user ? (user.role === 'admin' ? 'Administrator' : 'Standard') : 'Guest'}
              </span>
              <p className="text-xs text-fg-subtle mt-1 truncate">
                {user?.email || 'Sign in for cloud sync'}
              </p>
            </div>

            <div className="bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="mono-label">IN SESSION</span>
                <Clock className="w-4 h-4 text-fg-subtle" />
              </div>
              <span className="font-display text-3xl font-bold text-fg tabular-nums">{recentConversions.length}</span>
              <p className="text-xs text-fg-subtle mt-1">Files in your session</p>
            </div>
          </div>
        </AnimeReveal>

        {/* ── Tools Picker Grid ── */}
        <AnimeReveal delay={280} direction="up" className="mb-12">
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold text-fg">Start a new conversion</h2>
            <p className="text-sm text-fg-muted">Select a media tool to convert local files or download from web links.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="card card-hover p-5 flex flex-col h-full group"
                >
                  <div className="flex items-start justify-between mb-5">
                    <span className="tile !w-10 !h-10 !rounded-lg group-hover:text-accent group-hover:border-accent/30 transition-colors">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="mono-label !text-[10px]">{tool.badge.toUpperCase()}</span>
                  </div>

                  <h3 className="text-base font-semibold text-fg mb-1.5">{tool.label}</h3>
                  <p className="text-[13px] text-fg-muted leading-relaxed mb-5 flex-1">
                    {tool.description}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted group-hover:text-accent transition-colors pt-3 border-t border-line">
                    <span>Launch tool</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </AnimeReveal>

        {/* ── Recent Conversions ── */}
        <AnimeReveal delay={360} direction="up">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg sm:text-xl font-bold text-fg">Recent conversions</h2>
                {recentConversions.length > 0 && (
                  <span className="badge tabular-nums">{recentConversions.length}</span>
                )}
              </div>

              {recentConversions.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="btn-danger btn-sm text-xs gap-1.5"
                  title="Clear all conversions"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear history
                </button>
              )}
            </div>

            <div className="space-y-2">
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
                    ? '/youtube'
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
                      <Link href={rowLink} className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="tile !w-9 !h-9 !rounded-lg group-hover/row:text-accent transition-colors">
                          {isYtAudio ? (
                            <Music className="w-4 h-4" />
                          ) : isYtVideo ? (
                            <Clapperboard className="w-4 h-4" />
                          ) : isUniversal ? (
                            <Globe className="w-4 h-4" />
                          ) : (
                            <Music className="w-4 h-4" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg truncate" title={conversion.youtubeUrl || conversion.youtubeTitle || conversion.originalName || conversion.outputFilename}>
                            {conversion.youtubeTitle || conversion.originalName || conversion.outputFilename || conversion.youtubeUrl || 'Converted media'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
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

                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {conversion.fileSize ? (
                          <span className="text-xs font-mono text-fg-muted px-2 py-1 rounded bg-surface border border-line hidden sm:inline-block tabular">
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
                  <span className="tile mx-auto mb-3">
                    <Clock className="w-5 h-5" />
                  </span>
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
