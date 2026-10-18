import { Metadata } from 'next';
import PageWrapper from '@/components/PageWrapper';

export const metadata: Metadata = {
  title: 'Privacy Policy - MediaTools',
  description: 'Learn how MediaTools protects your privacy, file security, and account data.',
};

export default function PrivacyPage() {
  return (
    <PageWrapper>
      <main className="min-h-screen container-page pt-28 pb-20">
        <div className="max-w-4xl mx-auto card p-6 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight text-fg">
            Privacy Policy
          </h1>
          <p className="text-xs text-fg-subtle mb-8">Last updated: October 2026</p>

          <div className="space-y-6 text-sm sm:text-base text-fg-muted leading-relaxed">
            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">1. Temporary File Processing</h2>
              <p>
                MediaTools processes video and audio files solely to perform the requested extraction or download.
                All uploaded files, converted files, and temporary artifacts are automatically and permanently deleted from our servers within one hour of completion.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">2. Account Information</h2>
              <p>
                If you create an account, we store your email address, display name, and conversion count statistics to provide your personal dashboard history.
                We never sell, rent, or trade your personal information with third parties.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">3. Logs and Telemetry</h2>
              <p>
                We do not inspect file contents. Anonymous technical logs (such as error codes, conversion durations, and bandwidth totals) are collected exclusively to ensure server reliability, prevent service abuse, and optimize conversion speeds.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">4. Contact & Data Deletion</h2>
              <p>
                To request permanent deletion of your account and associated history records, please reach out directly to{' '}
                <a href="mailto:mediatools.contactus@gmail.com" className="link font-medium">
                  mediatools.contactus@gmail.com
                </a>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </PageWrapper>
  );
}