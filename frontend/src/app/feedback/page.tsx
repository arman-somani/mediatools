'use client';

import { useState } from 'react';
import api from '@/lib/api';
import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';
import { ThumbsUp, MessageSquare, Bug, Check, AlertCircle } from 'lucide-react';

export default function FeedbackPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<'compliment' | 'complain' | 'bug'>('compliment');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setError('');

    try {
      const response = await api.post('/feedback', {
        name,
        email,
        type,
        message,
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to send message.');
      }

      setStatus('success');
      setName('');
      setEmail('');
      setType('compliment');
      setMessage('');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err: any) {
      setStatus('idle');
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <PageWrapper>
      <main className="min-h-screen container-page pt-28 pb-20 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl">
          <AnimeReveal direction="up" delay={100} className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg mb-2">
              Send Us Feedback
            </h1>
            <p className="text-fg-muted text-sm sm:text-base">
              Found a bug or have a suggestion? We appreciate every message to make MediaTools better.
            </p>
          </AnimeReveal>

          <AnimeReveal direction="up" delay={200}>
            <div className="card p-6 sm:p-8 relative overflow-hidden">
              {status === 'success' ? (
                <div className="py-12 flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
                    <Check className="w-7 h-7" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-bold text-fg mb-2">Message Received!</h3>
                  <p className="text-sm text-fg-muted max-w-xs">
                    Thank you for your feedback. We review all submissions regularly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Full Name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-modern"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="label">Email Address</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-modern"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Feedback Category</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setType('compliment')}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium ${
                          type === 'compliment'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-semibold'
                            : 'bg-surface-2 border-line text-fg-muted hover:border-line-strong hover:text-fg'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        <span>Compliment</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setType('complain')}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium ${
                          type === 'complain'
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 font-semibold'
                            : 'bg-surface-2 border-line text-fg-muted hover:border-line-strong hover:text-fg'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Suggestion</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setType('bug')}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium ${
                          type === 'bug'
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold'
                            : 'bg-surface-2 border-line text-fg-muted hover:border-line-strong hover:text-fg'
                        }`}
                      >
                        <Bug className="w-4 h-4" />
                        <span>Bug Report</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Your Message</label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="input-modern resize-none py-3 h-auto"
                      placeholder="Tell us what worked, what didn't, or what you'd like to see..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="w-full btn-accent h-12 text-sm font-semibold"
                  >
                    {status === 'submitting' ? 'Submitting…' : 'Send Feedback'}
                  </button>
                </form>
              )}
            </div>
          </AnimeReveal>
        </div>
      </main>
    </PageWrapper>
  );
}
