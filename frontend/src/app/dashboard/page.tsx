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
        label: 'YouTube to Audio ',
        description: 'Extract Audio from any YouTube video or playlist',
        href: '/youtube',
        gradient: 'from-red-600 to-rose-500',
        shadow: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.35)]',
        border: 'border-red-500/20',
        bg: 'bg-red-500/5',
        icon: (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
                <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
            </svg>
        ),
        badge: 'Most Popular',
        badgeColor: 'bg-red-500/20 text-red-400',
    },
    {
        label: 'YouTube to Video',
        description: 'Download YouTube videos in HD, 4K or 8K quality',
        href: '/yt-video',
        gradient: 'from-violet-600 to-purple-500',
        shadow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.35)]',
        border: 'border-violet-500/20',
        bg: 'bg-violet-500/5',
        icon: (
            <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-violet-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
        ),
        badge: '4K & 8K',
        badgeColor: 'bg-violet-500/20 text-violet-400',
    },
    {
        label: 'Video to Audio ',
        description: 'Convert any local video file to high-quality Audio ',
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

                    {/* â”€â”€ Start New Conversion â€” Tool Picker â”€â”€ */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mb-10"
                    >
                        <h2 className="text-2xl font-bold text-white mb-2">Start a New Conversion</h2>
                        <p className="text-white/50 text-sm mb-6">Choose what you want to convert each card goes directly to that tool.</p>

                        <div className="grid gap-5 sm:grid-cols-3">
                            {TOOLS.map((tool, i) => (
                                <motion.div
                                    key={tool.href}
                                    className={i === 3 ? 'sm:col-start-2' : ''}
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
                        <h2 className="mb-6 text-2xl font-bold text-white">Recent Conversions & Downloads</h2>

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
                                                    <p className="font-medium text-white truncate text-sm">
                                                        {conversion.youtubeTitle || conversion.originalName || conversion.outputFilename || 'converted-file'}
                                                    </p>
                                                    <div className="text-xs text-white/50 mt-0.5 flex flex-wrap items-center gap-2">
                                                        <Link href={`${typeHref}${conversion.youtubeUrl ? `?url=${encodeURIComponent(conversion.youtubeUrl)}` : ''}`} className="hover:text-brand-purple transition-colors font-semibold">
                                                            {typeLabel}
                                                        </Link>
                                                        {conversion.youtubeUrl && (
                                                            <>
                                                                <span className="opacity-50">&bull;</span>
                                                                <Link 
                                                                    href={`${typeHref}?url=${encodeURIComponent(conversion.youtubeUrl)}`}
                                                                    className="truncate max-w-[150px] sm:max-w-xs md:max-w-md hover:text-brand-cyan hover:underline transition-all"
                                                                    title={conversion.youtubeUrl}
                                                                >
                                                                    {conversion.youtubeUrl}
                                                                </Link>
                                                            </>
                                                        )}
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