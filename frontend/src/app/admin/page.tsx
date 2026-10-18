'use client';

import { useAuthStore } from '@/lib/store';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Users, Radio, HardDrive, Layers, Download, ShieldAlert,
  ShieldCheck, Search, ArrowLeft, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

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
  const [searchQuery, setSearchQuery] = useState('');
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
    return null;
  }

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageWrapper>
      <main className="min-h-screen w-full container-page pt-28 pb-20">
        
        {/* ── Header ── */}
        <AnimeReveal delay={100} direction="up" className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
            <div>
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="btn-icon btn-sm text-fg-muted hover:text-fg" title="Back to dashboard">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg">Admin Panel</h1>
                <span className="badge text-accent !bg-accent/10 !border-accent/20 font-semibold">
                  System Admin
                </span>
              </div>
              <p className="mt-2 text-fg-muted text-sm sm:text-base">
                Manage registered users, monitor real-time platform metrics, and control security bans.
              </p>
            </div>

            <Link href="/dashboard" className="btn-secondary self-start sm:self-auto text-xs">
              Back to Dashboard
            </Link>
          </div>
        </AnimeReveal>

        {error && (
          <div className="mb-8 card p-4 flex items-center gap-3 border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* ── Stats Cards Grid ── */}
            <AnimeReveal delay={200} direction="up" className="mb-10">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                
                <div className="card p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Total Users</span>
                    <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-accent">
                      <Users className="w-4 h-4" />
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold font-display text-fg tabular-nums">
                      {stats?.totalUsers || 0}
                    </span>
                    <p className="text-xs text-fg-subtle mt-1">Registered members</p>
                  </div>
                </div>

                <div className="card p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Live Online</span>
                    <span className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold font-display text-emerald-400 tabular-nums">
                      {stats?.liveUsers || 0}
                    </span>
                    <p className="text-xs text-fg-subtle mt-1">Active in last 2m</p>
                  </div>
                </div>

                <div className="card p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Conversions</span>
                    <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-fg-muted">
                      <Layers className="w-4 h-4" />
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold font-display text-fg tabular-nums">
                      {stats?.totalConversions || 0}
                    </span>
                    <p className="text-xs text-fg-subtle mt-1">Platform total</p>
                  </div>
                </div>

                <div className="card p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Downloads</span>
                    <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-fg-muted">
                      <Download className="w-4 h-4" />
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold font-display text-fg tabular-nums">
                      {stats?.totalDownloads || 0}
                    </span>
                    <p className="text-xs text-fg-subtle mt-1">Completed exports</p>
                  </div>
                </div>

                <div className="card p-5 flex flex-col justify-between col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Bandwidth</span>
                    <span className="w-8 h-8 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-cyan-400">
                      <HardDrive className="w-4 h-4" />
                    </span>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold font-display text-fg tabular-nums">
                      {stats ? (stats.totalBandwidthUsed / (1024 * 1024 * 1024)).toFixed(2) : 0} <span className="text-sm font-normal text-fg-subtle">GB</span>
                    </span>
                    <p className="text-xs text-fg-subtle mt-1">Real egress used</p>
                  </div>
                </div>

              </div>
            </AnimeReveal>

            {/* ── Users Table ── */}
            <AnimeReveal delay={300} direction="up" className="card overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-fg">User Management</h2>
                  <p className="text-xs text-fg-muted mt-0.5">View accounts, activity counts, and toggle account bans.</p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-fg-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="input-modern pl-9 pr-3 py-1.5 text-xs h-9"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="border-b border-line text-xs font-semibold text-fg-subtle uppercase tracking-wider bg-surface-2">
                      <th className="py-3.5 px-6">User</th>
                      <th className="py-3.5 px-6">Joined</th>
                      <th className="py-3.5 px-6 text-center">Conversions</th>
                      <th className="py-3.5 px-6 text-center">Downloads</th>
                      <th className="py-3.5 px-6 text-center">Bandwidth</th>
                      <th className="py-3.5 px-6 text-center">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-sm">
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-semibold text-fg">{u.name}</div>
                          <div className="text-xs text-fg-subtle">{u.email}</div>
                          {u.role === 'admin' && (
                            <span className="inline-block mt-1 text-[10px] uppercase font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                              Admin
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-fg-muted">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-center font-mono text-xs text-fg tabular-nums">
                          {u.totalConversions}
                        </td>
                        <td className="py-4 px-6 text-center font-mono text-xs text-fg tabular-nums">
                          {u.totalDownloads}
                        </td>
                        <td className="py-4 px-6 text-center font-mono text-xs text-fg-muted tabular-nums">
                          {`${(u.monthlyBandwidthUsed / (1024 * 1024)).toFixed(1)} MB`}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {u.isBanned ? (
                            <span className="badge text-[11px] font-semibold text-rose-400 !bg-rose-500/10 !border-rose-500/20">
                              Banned
                            </span>
                          ) : (
                            <span className="badge text-[11px] font-semibold text-emerald-400 !bg-emerald-500/10 !border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleToggleBan(u._id, u.isBanned)}
                              className={`btn-sm text-xs font-semibold rounded-lg transition-all ${
                                u.isBanned
                                  ? 'btn-secondary text-emerald-400 hover:text-emerald-300'
                                  : 'btn-danger'
                              }`}
                            >
                              {u.isBanned ? 'Unban User' : 'Ban User'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-fg-subtle text-sm">
                          {searchQuery ? 'No matching users found.' : 'No registered users found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </AnimeReveal>
          </>
        )}
      </main>
    </PageWrapper>
  );
}
