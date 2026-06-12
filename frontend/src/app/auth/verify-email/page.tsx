'use client';
import { useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

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
    <div className="w-full flex items-center justify-center py-24 px-6 relative min-h-screen">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-brand-cyan/10 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl border border-brand-cyan/20 text-brand-cyan">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight text-white mb-2">Verify Your Email</h1>
          <p className="text-white/60">We sent a 6-digit code to <strong className="text-white">{email || 'your email'}</strong>.</p>
        </div>

        <div className="glass-panel p-8">
          <form onSubmit={handleVerify} className="space-y-6">
            {!emailParam && (
              <div>
                <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">EMAIL ADDRESS</label>
                <input 
                  type="email" 
                  className="input-modern" 
                  placeholder="you@example.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-white/50 tracking-wider mb-2 text-center">VERIFICATION CODE</label>
              <input 
                type="text" 
                maxLength={6}
                className="input-modern text-center text-3xl tracking-[1em] font-mono py-4 font-bold pl-[1em]" 
                placeholder="------" 
                value={code} 
                onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} 
                required 
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || code.length !== 6} className="w-full btn-primary h-12">
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
