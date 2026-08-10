'use client';

import { useAuthStore } from '@/lib/store';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type UserData = {
    _id: string;
    name: string;
    email: string;
    role: string;
    totalConversions: number;
    totalDownloads: number;
    isPremium: boolean;
    isBanned: boolean;
    monthlyBandwidthUsed: number;
    createdAt: string;
};

type AdminStats = {
    totalUsers: number;
    totalConversions: number;
    liveUsers: number;
    totalBandwidthUsed: number;
    totalDownloads: number;
};

export default function AdminPage() {
    const { user, accessToken } = useAuthStore();
    const router = useRouter();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        if (!accessToken) {
            router.push('/auth/login');
            return;
        }
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
            return;
        }

        const fetchAdminData = async () => {
            try {
                const [statsRes, usersRes] = await Promise.all([
                    api.get('/admin'),
                    api.get('/admin/users')
                ]);
                
                if (statsRes.data.success) {
                    setStats(statsRes.data.data);
                }
                if (usersRes.data.success) {
                    setUsers(usersRes.data.data);
                }
            } catch (err: any) {
                console.error(err);
                setError('Failed to load admin data.');
            } finally {
                setLoading(false);
            }
        };

        fetchAdminData();
    }, [user, accessToken, router, isMounted]);

    const handleToggleBan = async (userId: string, isCurrentlyBanned: boolean) => {
        if (!confirm(`Are you sure you want to ${isCurrentlyBanned ? 'unban' : 'ban'} this user?`)) return;
        
        try {
            const { data } = await api.post(`/admin/users/${userId}/ban`);
            if (data.success) {
                setUsers(prev => prev.map(u => 
                    u._id === userId ? { ...u, isBanned: data.data.isBanned } : u
                ));
            }
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to toggle ban status');
        }
    };

    if (!user || user.role !== 'admin') {
        return null; // Don't render until redirect
    }

    return (
        <PageWrapper>
            <main className="min-h-screen w-full px-4 sm:px-6 pt-32 pb-20 text-white">
                <section className="mx-auto max-w-7xl">
                    <AnimeReveal delay={100} direction="up" className="mb-10">
                        <h1 className="text-5xl font-bold text-white mb-4">Admin Panel</h1>
                        <p className="text-white/60">
                            Manage your users, view platform usage, and enforce bans.
                        </p>
                    </AnimeReveal>

                    {error && (
                        <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-600">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-brand-cyan border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {/* Stats Cards */}
                            <AnimeReveal delay={300} direction="up" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center">
                                    <div className="text-brand-purple mb-2">
                                        <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-3xl font-bold">{stats?.totalUsers || 0}</h3>
                                    <p className="text-sm text-white/50">Total Users</p>
                                </div>
                                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center">
                                    <div className="text-brand-cyan mb-2">
                                        <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-3xl font-bold">{stats?.liveUsers || 0}</h3>
                                    <p className="text-sm text-white/50">Live Users</p>
                                </div>
                                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center">
                                    <div className="text-brand-green mb-2">
                                        <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-3xl font-bold">
                                        {stats ? (stats.totalBandwidthUsed / (1024 * 1024 * 1024)).toFixed(2) : 0} GB
                                    </h3>
                                    <p className="text-sm text-white/50">Real Server Bandwidth (out of 5 GB)</p>
                                </div>
                            </AnimeReveal>

                            {/* Users Table */}
                            <AnimeReveal delay={500} direction="up" className="glass-panel rounded-3xl overflow-hidden">
                                <div className="p-6 border-b border-white/10">
                                    <h2 className="text-xl font-bold">User Management</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[800px]">
                                        <thead>
                                            <tr className="border-b border-white/5 text-sm text-white/50 bg-white/[0.02]">
                                                <th className="py-4 px-6 font-medium">User</th>
                                                <th className="py-4 px-6 font-medium">Joined</th>
                                                <th className="py-4 px-6 font-medium text-center">Conversions</th>
                                                <th className="py-4 px-6 font-medium text-center">Downloads</th>
                                                <th className="py-4 px-6 font-medium text-center">Bandwidth</th>
                                                <th className="py-4 px-6 font-medium text-center">Status</th>
                                                <th className="py-4 px-6 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {users.map(u => (
                                                <tr key={u._id} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="py-4 px-6">
                                                        <div className="font-semibold text-white">{u.name}</div>
                                                        <div className="text-xs text-white/50">{u.email}</div>
                                                        {u.role === 'admin' && (
                                                            <span className="inline-block mt-1 text-[10px] uppercase font-bold text-brand-purple bg-brand-purple/10 px-2 py-0.5 rounded">Admin</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-sm text-white/70">
                                                        {new Date(u.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-4 px-6 text-center text-sm font-mono text-white/80">
                                                        {u.totalConversions}
                                                    </td>
                                                    <td className="py-4 px-6 text-center text-sm font-mono text-white/80">
                                                        {u.totalDownloads}
                                                    </td>
                                                    <td className="py-4 px-6 text-center text-sm font-mono text-white/80">
                                                        {`${(u.monthlyBandwidthUsed / (1024 * 1024)).toFixed(1)} MB`}
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        {u.isBanned ? (
                                                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/20 text-red-500 border border-red-500/20">
                                                                Banned
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/20">
                                                                Active
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        {u.role !== 'admin' && (
                                                            <button
                                                                onClick={() => handleToggleBan(u._id, u.isBanned)}
                                                                className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all border ${
                                                                    u.isBanned 
                                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                                                    : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                                                                }`}
                                                            >
                                                                {u.isBanned ? 'Unban User' : 'Ban User'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {users.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-white/50">
                                                        No users found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </AnimeReveal>
                        </>
                    )}
                </section>
            </main>
        </PageWrapper>
    );
}
