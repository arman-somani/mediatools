'use client';

import { motion } from 'framer-motion';
import PageWrapper from '@/components/PageWrapper';

export default function ContactPage() {
    return (
        <PageWrapper>
            <main className="min-h-screen pt-32 px-6 pb-20 text-white relative flex justify-center">
                {/* Background elements */}
                <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-brand-violet/20 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-brand-cyan/10 blur-[120px] rounded-full pointer-events-none" />

                <div className="w-full max-w-xl relative z-10 mt-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="glass-panel p-6 sm:p-10 md:p-14 rounded-3xl text-center shadow-2xl relative overflow-hidden"
                    >
                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl border border-white/10 text-brand-cyan">
                            <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>

                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 font-display">Get in Touch</h1>
                        <p className="text-white/60 text-base sm:text-lg mb-8 sm:mb-12 leading-relaxed">
                            Whether you have a suggestion, found a bug, or just want to say hi, we'd love to hear from you.
                        </p>

                        <div className="space-y-4 sm:space-y-6 text-left">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl bg-brand-purple/20 flex items-center justify-center text-brand-purple group-hover:scale-110 transition-transform">
                                    <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="w-full">
                                    <p className="text-sm text-white/50 font-medium mb-1">Email Us</p>
                                    <p className="text-white text-base sm:text-lg font-semibold break-all">mediatools.contactus@gmail.com</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                    <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="w-full">
                                    <p className="text-sm text-white/50 font-medium mb-1">Support Us</p>
                                    <p className="text-white text-base sm:text-lg font-semibold flex flex-wrap gap-2 break-all">
                                        Donation UPI: <span className="text-emerald-400 select-all">armansomani786@oksbi</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>
        </PageWrapper>
    );
}