'use client';

import { useState, Suspense } from 'react';
import AnimeReveal from '@/components/AnimeReveal';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Check, AlertCircle, KeyRound } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to reset password. The link might be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token && !error) {
    return (
      <div className="card p-8 text-center text-fg-muted max-w-md mx-auto">
        <p className="text-sm">No reset token found in URL. Please use the exact link sent to your email.</p>
        <Link href="/auth/forgot-password" className="btn-secondary btn-sm mt-4 inline-block">
          Request New Link
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-7 sm:p-8">
      {success ? (
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <Check className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h3 className="text-lg font-bold text-fg mb-2">Password Reset Successfully</h3>
          <p className="text-fg-muted text-xs sm:text-sm leading-relaxed mb-6">
            Your new password is now active. You can now use it to sign in to MediaTools.
          </p>
          <Link href="/auth/login" className="btn-primary w-full h-11 text-sm font-semibold inline-flex items-center justify-center">
            Proceed to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              className="input-modern"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              className="input-modern"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary h-11 text-sm font-semibold mt-2">
            {loading ? 'Updating password…' : 'Reset Password'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full min-h-[calc(100vh-14rem)] flex items-center justify-center py-24 px-6 relative">
      <AnimeReveal direction="up" className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-surface-2 rounded-2xl border border-line mx-auto flex items-center justify-center mb-4 text-accent">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight text-fg mb-2">Create New Password</h1>
          <p className="text-fg-muted text-sm">Choose a strong password with at least 8 characters.</p>
        </div>

        <Suspense fallback={
          <div className="card p-8 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </AnimeReveal>
    </div>
  );
}
