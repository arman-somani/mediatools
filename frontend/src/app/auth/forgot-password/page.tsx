'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex items-center justify-center py-24 px-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.1)_0%,transparent_70%)] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1 className="font-display font-bold text-3xl tracking-tight text-white mb-2">Forgot Password</h1>
          <p className="text-white/60">Enter your email and we'll send you a reset link.</p>
        </div>

        <div className="glass-panel p-8">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <svg width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Check your email</h3>
              <p className="text-white/60 text-sm">
                If that email address exists in our system, you will receive a password reset link shortly.
              </p>
              <Link href="/auth/login" className="inline-block mt-6 text-brand-purple hover:text-brand-cyan transition-colors text-sm">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                  Error {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full btn-primary h-12 mt-2">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <p className="text-center text-white/50 text-sm mt-4">
                <Link href="/auth/login" className="text-brand-purple font-medium hover:text-brand-cyan transition-colors">
                  Back to Sign In
                </Link>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
