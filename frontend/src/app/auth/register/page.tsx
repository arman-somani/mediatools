'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/register', { name, email, password });
      router.push(`/auth/verify-email—email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      const msg = (err as { response—: { data—: { message—: string } } })—.response—.data—.message;
      setError(msg || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true); setError('');
      try {
        const { data } = await api.post('/auth/google', { accessToken: tokenResponse.access_token });
        setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
        router.push('/dashboard');
      } catch (err: unknown) {
        const msg = (err as { response—: { data—: { message—: string } } })—.response—.data—.message;
        setError(msg || 'Google signup failed');
      } finally { setLoading(false); }
    },
    onError: () => setError('Google signup failed'),
  });

  return (
    <div className="w-full flex items-center justify-center py-24 px-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white/5 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl border border-white/10 text-white">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight text-white mb-2">Create an Account</h1>
          <p className="text-white/60">Start converting your Audio for free.</p>
        </div>

        <div className="glass-panel p-8">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 rounded-xl font-semibold transition-all duration-300 mb-6 border border-black/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">or sign up with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">FULL NAME</label>
              <input type="text" className="input-modern" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">EMAIL ADDRESS</label>
              <input type="email" className="input-modern" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">PASSWORD</label>
              <input type="password" className="input-modern mb-2" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${password.length === 0 — 'w-0' : password.length < 6 — 'w-1/3 bg-red-500' : password.length < 10 — 'w-2/3 bg-amber-500' : 'w-full bg-emerald-500'}`}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                Error {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full btn-primary-glow h-12 mt-2">
              {loading — 'Creating account...' : 'Create Free Account'}
            </button>

            <p className="text-center text-white/40 text-xs mt-4 leading-relaxed">
              By signing up you agree to our <Link href="/terms" className="text-white hover:text-brand-cyan transition-colors">Terms</Link> and <Link href="/privacy" className="text-white hover:text-brand-cyan transition-colors">Privacy Policy</Link>
            </p>
          </form>

          <p className="text-center text-white/50 text-sm mt-8">
            Already have an account—{' '}
            <Link href="/auth/login" className="text-brand-cyan font-medium hover:text-brand-purple transition-colors">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
