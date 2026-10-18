'use client';

import { useState } from 'react';
import Link from 'next/link';
import AnimeReveal from '@/components/AnimeReveal';
import api from '@/lib/api';
import { Mail, Check, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-14rem)] flex items-center justify-center py-24 px-6 relative">
      <AnimeReveal direction="up" className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl tracking-tight text-fg mb-2">Forgot Password</h1>
          <p className="text-fg-muted text-sm">Enter your account email to receive a password reset link.</p>
        </div>

        <div className="card p-7 sm:p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400">
                <Check className="w-7 h-7" strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-bold text-fg mb-2">Check your email</h3>
              <p className="text-fg-muted text-xs sm:text-sm leading-relaxed mb-6">
                If an account exists for <strong className="text-fg">{email}</strong>, a reset link was sent. Please also check your spam or junk folder.
              </p>
              <Link href="/auth/login" className="btn-secondary w-full text-xs gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && (
                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full btn-primary h-11 text-sm font-semibold mt-2">
                {loading ? 'Sending link…' : 'Send Reset Link'}
              </button>

              <div className="text-center pt-2">
                <Link href="/auth/login" className="text-fg-muted hover:text-fg text-xs font-medium inline-flex items-center gap-1.5 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </AnimeReveal>
    </div>
  );
}
