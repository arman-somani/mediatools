'use client';

import PageWrapper from '@/components/PageWrapper';
import AnimeReveal from '@/components/AnimeReveal';
import { Mail, MessageSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <PageWrapper>
      <main className="min-h-screen container-page pt-28 pb-20 flex flex-col items-center justify-center">
        <div className="w-full max-w-lg">
          <AnimeReveal
            direction="up"
            delay={100}
            className="card p-6 sm:p-10 text-center"
          >
            <div className="w-14 h-14 bg-surface-2 rounded-2xl border border-line flex items-center justify-center mx-auto mb-6 text-accent">
              <Mail className="w-6 h-6" />
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3 tracking-tight text-fg">
              Get in Touch
            </h1>
            <p className="text-fg-muted text-sm sm:text-base mb-8 leading-relaxed">
              Have questions, feedback, or a partnership inquiry? We&apos;d love to hear from you.
            </p>

            <div className="space-y-3 text-left">
              <a
                href="mailto:mediatools.contactus@gmail.com"
                className="card-inset p-4 sm:p-5 flex items-center gap-4 hover:border-line-strong transition-colors group block"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-fg-subtle mb-0.5">Email Support</p>
                  <p className="text-sm sm:text-base font-semibold text-fg break-all group-hover:text-accent transition-colors">
                    mediatools.contactus@gmail.com
                  </p>
                </div>
              </a>

              <Link
                href="/feedback"
                className="card-inset p-4 sm:p-5 flex items-center justify-between gap-4 hover:border-line-strong transition-colors group block"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-fg-muted flex-shrink-0 group-hover:scale-105 transition-transform">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-fg-subtle mb-0.5">Feedback Form</p>
                    <p className="text-sm sm:text-base font-semibold text-fg group-hover:text-accent transition-colors">
                      Send bugs or feature suggestions
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-fg-subtle group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>
            </div>
          </AnimeReveal>
        </div>
      </main>
    </PageWrapper>
  );
}