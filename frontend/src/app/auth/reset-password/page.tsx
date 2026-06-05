'use client';

import { useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';

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
      <div className="p-8 text-center text-white/60">
        <p>No reset token found in URL. Please use the exact link sent to your email.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-8">
      {success ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <svg width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Password Reset Successfully</h3>
          <p className="text-white/60 text-sm mb-6">
            Your new password is now active. You can use it to log in to your account.
          </p>
          <Link href="/auth/login" className="btn-primary-glow px-8 py-3 w-full inline-block text-center rounded-xl font-semibold">
            Proceed to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">NEW PASSWORD</label>
            <input
              type="password"
              className="input-modern"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">CONFIRM PASSWORD</label>
            <input
              type="password"
              className="input-modern"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-primary-glow h-12 mt-2">
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full flex items-center justify-center py-24 px-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.1)_0%,transparent_70%)] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1 className="font-display font-bold text-3xl tracking-tight text-white mb-2">Create New Password</h1>
          <p className="text-white/60">Choose a new password for your account.</p>
        </div>

        <Suspense fallback={<div className="glass-panel p-8 text-center text-white/50">Loading form...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
