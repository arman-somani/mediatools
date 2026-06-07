'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import PageWrapper from '@/components/PageWrapper';

export default function HomePage() {
  return (
    <PageWrapper>
      <main className="min-h-screen text-white">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center text-center px-4 md:px-6 pt-32 md:pt-40 pb-16 md:pb-24">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] md:w-[800px] h-[300px] md:h-[400px] bg-brand-purple/10 blur-[80px] md:blur-[120px] rounded-full pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 max-w-5xl mx-auto pt-10"
          >

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1] mb-6 md:mb-8 text-white px-2 sm:px-0">
              Convert Video into<br />
              <span className="text-gradient">Studio-Quality Audio</span>
            </h1>

            <p className="text-white/60 text-lg md:text-xl lg:text-2xl max-w-2xl mx-auto mb-10 md:mb-12 leading-relaxed px-4 sm:px-0">
              The fastest way to extract audio from MP4 files or YouTube URL's, Universal URL Downloader and
              Zero quality loss.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center flex-wrap w-full px-4 sm:px-0">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} className="w-full sm:w-auto">
                <Link href="/converter" className="btn-primary-glow px-6 md:px-8 py-3 md:py-4 text-base md:text-lg rounded-xl block w-full text-center">
                  Convert MP4 to MP3
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} className="w-full sm:w-auto">
                <Link href="/youtube" className="btn-secondary px-6 md:px-8 py-3 md:py-4 text-base md:text-lg rounded-xl flex items-center justify-center gap-2 w-full">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
                    <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                  </svg>
                  YouTube to MP3
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} className="w-full sm:w-auto">
                <Link href="/yt-video" className="btn-secondary px-6 md:px-8 py-3 md:py-4 text-base md:text-lg rounded-xl flex items-center justify-center gap-2 w-full">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
                    <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                  </svg>
                  YouTube to MP4
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} className="w-full sm:w-auto">
                <Link href="/universal" className="btn-secondary px-6 md:px-8 py-3 md:py-4 text-base md:text-lg rounded-xl flex items-center justify-center gap-2 w-full">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-brand-cyan">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                  </svg>
                  Universal Downloader
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="px-4 md:px-6 py-16 md:py-24 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 md:mb-16"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white px-2">
              Everything You Need to <span className="text-gradient">Extract Audio</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto px-4">
              Professional-grade audio extraction tools, built for everyone.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: (
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Lightning Fast',
                description: 'FFmpeg-powered conversion on our servers. Most files convert in under 30 seconds.',
                color: 'text-brand-purple',
                bg: 'bg-brand-purple/10',
                border: 'border-brand-purple/20',
              },
              {
                icon: (
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                ),
                title: 'Studio Quality',
                description: 'Choose from 128kbps, 192kbps, or lossless 320kbps MP3 output quality.',
                color: 'text-brand-cyan',
                bg: 'bg-brand-cyan/10',
                border: 'border-brand-cyan/20',
              },
              {
                icon: (
                  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                title: 'Secure & Private',
                description: 'Files are auto-deleted after 1 hour. Your data is never stored permanently.',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
                border: 'border-emerald-500/20',
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="glass-panel glass-panel-hover p-8"
              >
                <div className={`w-14 h-14 ${feature.bg} border ${feature.border} rounded-2xl flex items-center justify-center mb-6 ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-white/60 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 md:px-6 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto glass-panel p-8 md:p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand-violet/10 to-brand-cyan/5 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                100% Free No Limits
              </h2>
              <p className="text-white/60 text-base md:text-lg mb-8">
                No subscriptions, no hidden fees. Every feature is free  unlimited conversions, 320kbps quality, YouTube downloads. Always.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center flex-wrap w-full">
                <Link href="/converter" className="btn-primary-glow px-6 md:px-8 py-3 rounded-xl w-full sm:w-auto text-center">
                  Start Converting
                </Link>
                <Link href="/youtube" className="btn-secondary px-6 md:px-8 py-3 rounded-xl flex items-center gap-2 justify-center w-full sm:w-auto">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
                    <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                  </svg>
                  YouTube to MP3
                </Link>
                <Link href="/yt-video" className="btn-secondary px-6 md:px-8 py-3 rounded-xl flex items-center gap-2 justify-center w-full sm:w-auto">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
                    <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                  </svg>
                  YouTube to MP4
                </Link>
                <Link href="/universal" className="btn-secondary px-6 md:px-8 py-3 rounded-xl flex items-center gap-2 justify-center w-full sm:w-auto">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-brand-cyan">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                  </svg>
                  Universal Downloader
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </PageWrapper>
  );
