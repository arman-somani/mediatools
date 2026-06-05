'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import PageWrapper from '@/components/PageWrapper';

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
            const response = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    access_key: "3831652c-f766-4fba-a62a-433e813ec13d",
                    name,
                    email,
                    subject: `[${type.toUpperCase()}] MediaTools Feedback`,
                    message,
                }),
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to send message.');
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
            <main className="min-h-screen pt-32 px-6 pb-20 text-white relative flex justify-center">
                {/* Background elements */}
                <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-brand-violet/20 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-brand-cyan/10 blur-[120px] rounded-full pointer-events-none" />

                <div className="w-full max-w-2xl relative z-10">
                    <div className="text-center mb-10">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 font-display">Feedback</h1>
                        <p className="text-white/60 text-lg leading-relaxed">
                            Have a suggestion or found a bug? We'd love to hear your feedback.
                        </p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="glass-panel p-8 md:p-10 rounded-3xl relative overflow-hidden">
                            {status === 'success' ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/90 backdrop-blur-sm z-20 text-center px-6"
                                >
                                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 text-emerald-400 border border-emerald-500/30">
                                        <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold mb-2">Message Sent!</h3>
                                    <p className="text-white/60">Thank you for reaching out. We appreciate your feedback.</p>
                                </motion.div>
                            ) : null}

                            {error && (
                                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">FULL NAME</label>
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
                                        <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">EMAIL ADDRESS</label>
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
                                    <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">TYPE OF MESSAGE</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <label className={`cursor-pointer flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 font-semibold text-xs text-center ${type === 'compliment' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                                            <input
                                                type="radio"
                                                name="type"
                                                value="compliment"
                                                className="hidden"
                                                checked={type === 'compliment'}
                                                onChange={() => setType('compliment')}
                                            />
                                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                            </svg>
                                            Compliment
                                        </label>
                                        <label className={`cursor-pointer flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 font-semibold text-xs text-center ${type === 'complain' ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                                            <input
                                                type="radio"
                                                name="type"
                                                value="complain"
                                                className="hidden"
                                                checked={type === 'complain'}
                                                onChange={() => setType('complain')}
                                            />
                                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                                            </svg>
                                            Complain
                                        </label>
                                        <label className={`cursor-pointer flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 font-semibold text-xs text-center ${type === 'bug' ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                                            <input
                                                type="radio"
                                                name="type"
                                                value="bug"
                                                className="hidden"
                                                checked={type === 'bug'}
                                                onChange={() => setType('bug')}
                                            />
                                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            Bug Report
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-white/50 tracking-wider mb-2">YOUR MESSAGE</label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="input-modern resize-none py-4"
                                        placeholder="Tell us what's on your mind..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={status === 'submitting'}
                                    className="w-full btn-primary-glow h-14 text-lg mt-4 relative overflow-hidden"
                                >
                                    <span className={status === 'submitting' ? 'opacity-0' : 'opacity-100 transition-opacity'}>
                                        Submit Feedback
                                    </span>
                                    {status === 'submitting' && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        </div>
                                    )}
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </main>
        </PageWrapper>
    );
}
