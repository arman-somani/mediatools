import { Metadata } from 'next';
import PageWrapper from '@/components/PageWrapper';

export const metadata: Metadata = {
  title: 'Terms of Service - MediaTools',
  description: 'Read the terms of service for using MediaTools.',
};

export default function TermsPage() {
  return (
    <PageWrapper>
      <main className="min-h-screen container-page pt-28 pb-20">
        <div className="max-w-4xl mx-auto card p-6 sm:p-10">
          <p className="mono-label mb-4">
            <span className="text-accent">DOC</span>
            <span className="mx-2 text-fg-subtle/60">/</span>
            TERMS · REV 2026-10
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3 tracking-tight text-fg">
            Terms of Service
          </h1>
          <p className="text-xs text-fg-subtle mb-8">Last updated: October 2026</p>

          <div className="space-y-8 text-sm sm:text-base text-fg-muted leading-relaxed">
            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing or using MediaTools (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">2. Eligibility</h2>
              <p>
                You must be at least 13 years old to use the Service. By using MediaTools, you represent that you meet this requirement.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">3. Use of Service</h2>
              <p>
                MediaTools provides tools to convert video and audio files for personal, non-commercial use. You agree to use the Service only for lawful purposes and in compliance with all applicable laws and regulations.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">4. Prohibited Activities</h2>
              <p className="mb-2">You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                <li>Upload illegal, harmful, or malicious content.</li>
                <li>Attempt to disrupt, damage, or overload our systems.</li>
                <li>Use automated bots or scrapers to abuse the Service.</li>
                <li>Circumvent security rate limits or access unauthorized areas.</li>
                <li>Use the Service for copyright infringement.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">5. User Responsibility</h2>
              <p>
                You are solely responsible for all files and links submitted through the Service. You represent and warrant that you hold all necessary licenses, rights, and permissions to process the media content you submit.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">6. Limitation of Liability</h2>
              <p>
                MediaTools is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind. To the fullest extent permitted by law, MediaTools disclaims all liability for any indirect, incidental, or consequential damages resulting from your use of the Service.
              </p>
            </section>
          </div>
        </div>
      </main>
    </PageWrapper>
  );
}
