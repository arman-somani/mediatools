'use client';

import { useAuthStore } from '@/lib/store';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
    const { user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [user, router]);

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <PageWrapper>
            <main className="min-h-screen w-full px-6 pt-32 pb-20 text-white">
                <section className="mx-auto max-w-7xl">
                    <AnimeReveal delay={100} direction="up" className="mb-10">
                        <h1 className="text-5xl font-bold text-white mb-4">Admin Panel</h1>
                        <p className="text-white/60">
                            Welcome to the admin panel. Here you can manage users, view analytics, and configure system settings.
                        </p>
                    </AnimeReveal>

                    <AnimeReveal delay={300} direction="up" className="glass-panel p-8 rounded-3xl mt-10">
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-brand-cyan/10 border border-brand-cyan/20 rounded-2xl flex items-center justify-center mb-6 text-brand-cyan shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                                <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Admin Features Coming Soon</h2>
                            <p className="text-white/50 max-w-md mx-auto">
                                You have successfully accessed the admin route! The full administrative dashboard is currently under construction.
                            </p>
                        </div>
                    </AnimeReveal>
                </section>
            </main>
        </PageWrapper>
    );
}
