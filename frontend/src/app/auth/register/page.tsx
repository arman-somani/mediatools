'use client';

import { useState } from 'react';
import Link from 'next/link';
import AnimeReveal from '@/components/AnimeReveal';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleIcon } from '@/components/icons';
import { AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError('You must agree to the Terms and Privacy Policy to register.');
      return;
    }
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      setError('Only @gmail.com domains are allowed. Institute and temp mail logins will not get registered.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', { name, email, password });
      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.post('/auth/google', { accessToken: tokenResponse.access_token });
        setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
        router.push('/dashboard');
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg || 'Google signup failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google signup failed'),
  });

  return (
    <div className="w-full min-h-[calc(100vh-14rem)] flex items-center justify-center py-24 px-6 relative">
      <AnimeReveal direction="up" className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl tracking-tight text-fg mb-2">Create an Account</h1>
          <p className="text-fg-muted text-sm">Start saving conversions and downloads with cloud sync.</p>
        </div>

        <div className="card p-7 sm:p-8">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            className="w-full h-11 flex items-center justify-center gap-3 bg-surface-2 hover:bg-surface-3 text-fg rounded-xl font-medium transition-colors mb-6 border border-line text-sm"
          >
            <GoogleIcon className="w-4 h-4 flex-shrink-0" />
            Sign up with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-fg-subtle text-xs uppercase tracking-wider font-medium">or email</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                className="input-modern"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
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
              <label className="label">Password</label>
              <input
                type="password"
                className="input-modern mb-2"
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    password.length === 0
                      ? 'w-0'
                      : password.length < 6
                      ? 'w-1/3 bg-rose-500'
                      : password.length < 10
                      ? 'w-2/3 bg-amber-500'
                      : 'w-full bg-emerald-500'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent bg-surface-2 cursor-pointer accent-accent"
                required
              />
              <label htmlFor="terms" className="text-fg-muted text-xs leading-relaxed cursor-pointer select-none">
                I agree to the <Link href="/terms" className="text-fg underline hover:text-accent">Terms</Link> and <Link href="/privacy" className="text-fg underline hover:text-accent">Privacy Policy</Link>.
              </label>
            </div>

            {error && (
              <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full btn-primary h-11 text-sm font-semibold mt-2">
              {loading ? 'Creating account…' : 'Create Free Account'}
            </button>
          </form>

          <p className="text-center text-fg-muted text-xs sm:text-sm mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-accent font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </AnimeReveal>
    </div>
  );
}
