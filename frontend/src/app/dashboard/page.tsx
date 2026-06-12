'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import PageWrapper from '@/components/PageWrapper';

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

function formatBytes(bytes?: number) {
    if (!bytes || bytes === 0) return 'Unknown Size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const TOOLS = [
    {
        label: 'Video to Audio',
        description: 'Convert any local video file to high-quality Audio',
        href: '/converter',
        gradient: 'from-brand-violet to-brand-purple',
        shadow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.35)]',
        border: 'border-brand-purple/20',
        bg: 'bg-brand-purple/5',
        icon: (
            <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-brand-purple">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
        ),
        badge: 'Up to 320kbps',
        badgeColor: 'bg-brand-purple/20 text-brand-purple',
    },
    {
        label: 'Universal Downloader',
        description: 'Download video from Twitter, TikTok, Instagram, etc.',
        href: '/universal',
        gradient: 'from-brand-cyan to-blue-500',
        shadow: 'hover:shadow-[0_0_30px_rgba(6,182,212,0.35)]',
        border: 'border-brand-cyan/20',
        bg: 'bg-brand-cyan/5',
        icon: (
            <svg width="26" height="26" fill="currentColor" viewBox="0 0 24 24" className="text-brand-cyan">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
        ),
        badge: 'Any Site',
        badgeColor: 'bg-brand-cyan/20 text-brand-cyan',
    },
    {
        label: 'YouTube MP3',
        description: 'Download YouTube videos directly as MP3 audio.',
        href: '/youtube',
        gradient: 'from-red-500 to-red-600',
        shadow: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.35)]',
        border: 'border-red-500/20',
        bg: 'bg-red-500/5',
        icon: (
            <svg width="26" height="26" fill="currentColor" viewBox="0 0 24 24" className="text-red-500">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
        ),
        badge: 'Fast',
        badgeColor: 'bg-red-500/20 text-red-500',
    },
    {
        label: 'YouTube MP4',
        description: 'Download YouTube videos in up to 8K MP4 resolution.',
        href: '/yt-video',
        gradient: 'from-brand-green to-emerald-500',
        shadow: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.35)]',
        border: 'border-brand-green/20',
        bg: 'bg-brand-green/5',
        icon: (
            <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-brand-green">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        badge: 'Up to 8K',
        badgeColor: 'bg-brand-green/20 text-brand-green',
    }
];

export default function DashboardPage() {
    const [userConversions, setUserConversions] = useState(0);
    const [userDownloads, setUserDownloads] = useState(0);
    const [recentConversions, setRecentConversions] = useState<RecentConversion[]>([]);
    const [error, setError] = useState('');
    const { user, accessToken } = useAuthStore();

    useEffect(() => {
        if (!accessToken && !user) {
            return;
        }

        // Clear previous errors when user becomes available
        setError('');

        const loadDashboard = async () => {
            try {
                const { data } = await api.get('/user/dashboard');
                if (data.success) {
                    setUserConversions(data.data.stats.totalConversions || 0);
                    setUserDownloads(data.data.stats.totalDownloads || 0);
                    setRecentConversions(data.data.recentConversions || []);
                }
            } catch (err: any) {
                if (err?.response?.status === 401) {
                    setError('Session expired. Please log in again.');
                } else {
                    setError('Failed to load dashboard. Make sure the backend is running.');
                }
            }
        };

        loadDashboard();
    }, [accessToken, user]);

    const handleDelete = async (id: string) => {
        try {
            const { data } = await api.delete(`/user/history/${id}`);
            if (data.success) {
                setRecentConversions(prev => prev.filter(c => c._id !== id));
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
            <main className="min-h-screen w-full px-6 pt-32 pb-20 text-white">
                <section className="mx-auto max-w-7xl">

                    {/* â”€â”€ Header â”€â”€ */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-10"
                    >
                        <h1 className="text-5xl font-bold text-white">Dashboard</h1>
                        <p className="mt-3 text-white/60">
                            {user ? `Welcome back, ${user.name}` : 'Manage your conversions and downloads.'}
                        </p>
                    </motion.div>

                    {/* â”€â”€ Auth warning â”€â”€ */}
                    {!user && !accessToken && (
                        <div className="mb-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-yellow-600 flex items-center gap-3">
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            You are not logged in.{' '}
                            <Link href="/auth/login" className="underline font-semibold ml-1">Sign in</Link> to see your conversions.
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-600">
                            {error}
                        </div>
                    )}

                    {/* ── Statistics Overview ── */}
                    {user && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10"
                        >
                            <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transition-transform group-hover:scale-150" />
                                <div className="w-14 h-14 bg-brand-cyan/10 rounded-xl flex items-center justify-center border border-brand-cyan/20 shrink-0">
                                    <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-brand-cyan">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm text-white/50 font-medium tracking-wide uppercase mb-1">Total Conversions</p>
                                    <p className="text-3xl font-bold text-white font-display">{userConversions}</p>
                                </div>
                            </div>
                            <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transition-transform group-hover:scale-150" />
                                <div className="w-14 h-14 bg-brand-purple/10 rounded-xl flex items-center justify-center border border-brand-purple/20 shrink-0">
                                    <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-brand-purple">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm text-white/50 font-medium tracking-wide uppercase mb-1">Total Downloads</p>
                                    <p className="text-3xl font-bold text-white font-display">{userDownloads}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Start New Conversion — Tool Picker ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mb-10"
                    >
                        <h2 className="text-2xl font-bold text-white mb-2">Start a New Conversion</h2>
                        <p className="text-white/50 text-sm mb-6">Choose what you want to convert each card goes directly to that tool.</p>

                        <div className="grid gap-5 sm:grid-cols-2">
                            {TOOLS.map((tool, i) => (
                                <motion.div
                                    key={tool.href}
                                    className=""
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.45 + i * 0.08 }}
                                    whileHover={{ y: -8, scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Link
                                        href={tool.href}
                                        className={`flex flex-col gap-4 p-6 rounded-2xl border ${tool.border} ${tool.bg} transition-all duration-300 ${tool.shadow} group relative overflow-hidden block`}
                                    >
                                        {/* glow blob */}
                                        <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-20 bg-gradient-to-br ${tool.gradient} pointer-events-none`} />

                                        {/* Icon + badge */}
                                        <div className="flex items-start justify-between">
                                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                                {tool.icon}
                                            </div>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tool.badgeColor}`}>
                                                {tool.badge}
                                            </span>
                                        </div>

                                        {/* Text */}
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-1">{tool.label}</h3>
                                            <p className="text-sm text-white/50 leading-relaxed">{tool.description}</p>
                                        </div>

                                        {/* Arrow CTA */}
                                        <div className={`flex items-center gap-2 text-sm font-semibold bg-gradient-to-r ${tool.gradient} bg-clip-text text-transparent mt-auto group-hover:gap-3 transition-all duration-200`}>
                                            Open Tool
                                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className={`bg-gradient-to-r ${tool.gradient} bg-clip-text`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* â”€â”€ Recent Conversions â”€â”€ */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.65 }}
                        className="glass-panel rounded-3xl p-8"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">Recent Conversions & Downloads</h2>
                            {recentConversions.length > 0 && (
                                <button
                                    onClick={handleDeleteAll}
                                    className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 px-3 py-1.5 rounded-lg border border-red-400/20 transition-all flex items-center gap-1"
                                >
                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete All
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {recentConversions.length > 0 ? (
                                recentConversions.map((conversion, index) => {
                                    const typeLabel =
                                        conversion.type === 'youtube' ? 'YouTube Audio ' :
                                            conversion.type === 'youtube-Video' ? 'YouTube Video' :
                                                conversion.type === 'universal' ? 'Universal Video' :
                                                    'Video Audio ';

                                    const typeHref =
                                        conversion.type === 'youtube' ? '/youtube' :
                                            conversion.type === 'youtube-Video' ? '/yt-video' :
                                                conversion.type === 'universal' ? '/universal' :
                                                    '/converter';

                                    return (
                                        <motion.div
                                            key={conversion._id || index}
                                            whileHover={{ y: -2, scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="flex items-center justify-between rounded-xl bg-white/5 hover:bg-black/[0.08] p-4 border border-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-brand-purple">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    {conversion.youtubeUrl ? (
                                                        <Link 
                                                            href={`${typeHref}?url=${encodeURIComponent(conversion.youtubeUrl)}`}
                                                            className="font-medium text-white hover:text-brand-cyan transition-colors truncate block text-sm mb-1"
                                                            title={conversion.youtubeUrl}
                                                        >
                                                            {conversion.youtubeUrl}
                                                        </Link>
                                                    ) : (
                                                        <p className="font-medium text-white truncate text-sm mb-1">
                                                            {conversion.youtubeTitle || conversion.originalName || conversion.outputFilename || 'converted-file'}
                                                        </p>
                                                    )}
                                                    <div className="text-xs text-white/50 flex flex-wrap items-center gap-2">
                                                        <span className="font-semibold text-brand-purple">{typeLabel}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                                <div className="text-xs font-mono font-medium px-3 py-1 rounded-full bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 hidden sm:block">
                                                    {formatBytes(conversion.fileSize)}
                                                </div>
                                                {conversion.youtubeUrl && (
                                                    <Link 
                                                        href={`${typeHref}?url=${encodeURIComponent(conversion.youtubeUrl)}`}
                                                        title="Convert Again"
                                                        className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-brand-purple hover:border-brand-purple flex items-center justify-center transition-all group"
                                                    >
                                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-white group-hover:scale-110 transition-transform">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                        </svg>
                                                    </Link>
                                                )}
                                                <button
                                                    onClick={(e) => { e.preventDefault(); handleDelete(conversion._id!); }}
                                                    title="Delete from history"
                                                    className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-red-500/80 hover:border-red-500 flex items-center justify-center transition-all group"
                                                >
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-white group-hover:scale-110 transition-transform">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            ) : (
                                <div className="rounded-2xl bg-black/5 border border-white/5 p-10 text-center">
                                    <div className="w-14 h-14 bg-brand-purple/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-purple/20">
                                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-brand-purple">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                                        </svg>
                                    </div>
                                    <p className="font-semibold text-white mb-1">No conversions yet</p>
                                    <p className="text-sm text-white/50 mb-6">
                                        Pick a tool above to start your first conversion.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        {TOOLS.map(tool => (
                                            <Link
                                                key={tool.href}
                                                href={tool.href}
                                                className={`text-sm font-semibold px-5 py-2.5 rounded-xl border ${tool.border} ${tool.bg} text-white hover:${tool.shadow} transition-all duration-200`}
                                            >
                                                {tool.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                </section>
            </main >
        </PageWrapper>
    );
}