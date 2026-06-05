'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted && !user) {
            router.push('/auth/login');
        }
    }, [user, router, isMounted]);

    if (!isMounted) return null;
    if (!user) return null;

    return <>{children}</>;
}
