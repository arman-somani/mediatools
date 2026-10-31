'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AnimeReveal from '@/components/AnimeReveal';
import api from '@/lib/api';
import { useAuthStore, useServerStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleIcon } from '@/components/icons';
import { AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showServerPopup, setShowServerPopup] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const { setAuth } = useAuthStore();
  const { isServerReady } = useServerStore();
  const router = useRouter();

  useEffect(() => {
    if (showServerPopup && countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [showServerPopup, countdown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@gmail.com')) {
      setError('Only @gmail.com domains are allowed. Institute and temp mail logins will not get registered.');
      return;
    }
    if (!isServerReady) {
      setShowServerPopup(true);
      setCountdown(60);
    }
    setLoading(true);
    setError('');
    setUnverifiedEmail('');
    try {
      const { data } = await api.post('/auth/login', { email: cleanEmail, password });
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      const resData = err?.response?.data;
      if (resData?.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(cleanEmail);
        setError(resData?.message || 'Please verify your email address to log in.');
        return;
      }
      if (!err?.response) {
        setError('Server is not responding. If the cloud instance is booting up, please wait a moment and try again.');
        return;
      }
      setError(resData?.message || 'Invalid email or password');
    } finally { 
      setLoading(false); 
      setShowServerPopup(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (!isServerReady) {
        setShowServerPopup(true);
        setCountdown(60);
      }
      setLoading(true);
      setError('');
      setUnverifiedEmail('');
      try {
        const { data } = await api.post('/auth/google', { accessToken: tokenResponse.access_token });
        setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
        router.push('/dashboard');
      } catch (err: any) {
        console.error('Google login backend error:', err);
        const msg = err?.response?.data?.message;
        if (!err?.response) {
          setError('Server is not responding. Please wait a moment and try again.');
        } else {
          setError(msg || 'Google login failed');
        }
      } finally { 
        setLoading(false); 
        setShowServerPopup(false);
      }
    },
    onError: (errorResponse) => {
      console.error('Google OAuth popup error:', errorResponse);
      setError('Google sign-in was cancelled or blocked. Please allow popups and try again.');
    },
  });

  return (
    <div className="w-full min-h-[calc(100vh-14rem)] flex items-center justify-center py-24 px-6 relative">
      {/* Server Wake-up Popup */}
      {showServerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
          <AnimeReveal direction="up" className="card p-6 sm:p-8 max-w-sm w-full text-center relative overflow-hidden border-line-strong">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 mx-auto flex items-center justify-center mb-4 text-accent">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-fg mb-2">Server Starting Up</h3>
            <p className="text-fg-muted text-xs sm:text-sm mb-4 leading-relaxed">
              We&apos;re waking up the cloud instance. It will complete login in approximately:
            </p>
            <div className="text-4xl font-bold font-display text-accent mb-2 tabular-nums">
              {countdown}s
            </div>
            <p className="text-fg-subtle text-xs">Please hold on, connecting securely...</p>
          </AnimeReveal>
        </div>
      )}

      <AnimeReveal direction="up" className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl tracking-tight text-fg mb-2">Welcome Back</h1>
          <p className="text-fg-muted text-sm">Sign in to manage your conversions and history.</p>
        </div>

        <div className="card p-7 sm:p-8">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-3 bg-surface-2 hover:bg-surface-3 text-fg rounded-xl font-medium transition-colors mb-6 border border-line text-sm disabled:opacity-50"
          >
            <GoogleIcon className="w-4 h-4 flex-shrink-0" />
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-fg-subtle text-xs uppercase tracking-wider font-medium">or email</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-accent hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                className="input-modern"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                {unverifiedEmail && (
                  <Link
                    href={`/auth/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-accent hover:underline font-medium text-xs pl-6"
                  >
                    Enter verification code <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full btn-primary h-11 text-sm font-semibold mt-2">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-fg-muted text-xs sm:text-sm mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-accent font-medium hover:underline">
              Create one for free
            </Link>
          </p>
        </div>
      </AnimeReveal>
    </div>
  );
}
