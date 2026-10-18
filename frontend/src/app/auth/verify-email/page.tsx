'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AnimeReveal from '@/components/AnimeReveal';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { MailCheck, AlertCircle } from 'lucide-react';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    if (!email) {
      setError('Email address is missing');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const { data } = await api.post('/auth/verify-email', { email, token: code });
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center py-24 px-6 relative min-h-[calc(100vh-14rem)]">
      <AnimeReveal direction="up" className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-surface-2 rounded-2xl border border-line mx-auto flex items-center justify-center mb-4 text-accent">
            <MailCheck className="w-7 h-7" />
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight text-fg mb-2">Verify Your Email</h1>
          <p className="text-fg-muted text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
            We sent a 6-digit verification code to <strong className="text-fg font-medium">{email || 'your email'}</strong>. Check your spam folder if not received.
          </p>
        </div>

        <div className="card p-7 sm:p-8">
          <form onSubmit={handleVerify} className="space-y-5">
            {!emailParam && (
              <div>
                <label className="label">Email Address</label>
                <input 
                  type="email" 
                  className="input-modern" 
                  placeholder="you@gmail.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
            )}
            
            <div>
              <label className="label text-center">6-Digit Verification Code</label>
              <input 
                type="text" 
                maxLength={6}
                className="input-modern text-center text-2xl tracking-[0.6em] font-mono py-3 font-bold" 
                placeholder="------" 
                value={code} 
                onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} 
                required 
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading || code.length !== 6} className="w-full btn-primary h-11 text-sm font-semibold">
              {loading ? 'Verifying…' : 'Verify Email & Continue'}
            </button>
          </form>
        </div>
      </AnimeReveal>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
