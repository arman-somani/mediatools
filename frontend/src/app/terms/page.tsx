import { Metadata } from 'next';
import Link from 'next/link';
import PageWrapper from '@/components/PageWrapper';

export const metadata: Metadata = {
  title: 'Terms of Service - MediaTools',
  description: 'Read the terms of service for using MediaTools.',
};

export default function TermsPage() {
  return (
    <PageWrapper>
      <main className="min-h-screen pt-32 pb-20 px-6 text-white">
        <div className="max-w-5xl mx-auto glass-panel rounded-3xl p-8">
          <h1 className="text-5xl font-bold mb-4 text-white">Terms of Service</h1>
          <p className="text-white/50 mb-12">Last updated: June 2025</p>

        <div className="space-y-10 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using MediaTools ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Eligibility</h2>
            <p>
              You must be at least 13 years old to use the Service. By using MediaTools, you represent that you meet this requirement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Use of Service</h2>
            <p>
              MediaTools provides tools to convert video and Audio files for personal, non-commercial use. You agree to use the Service only for lawful purposes and in compliance with all applicable laws and regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Prohibited Activities</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Upload illegal, harmful, or malicious content.</li>
              <li>Attempt to disrupt, damage, or overload our systems.</li>
              <li>Use automated tools, bots, or scripts to abuse the Service.</li>
              <li>Circumvent security measures or access unauthorized areas.</li>
              <li>Use the Service for copyright infringement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. User Content & Responsibility</h2>
            <p>
              You are solely responsible for all files, links, and content submitted through the Service. You represent that you have all necessary rights and permissions to use such content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Copyright & DMCA</h2>
            <p>
              MediaTools respects intellectual property rights. If you believe your copyrighted material has been used improperly, you may submit a DMCA takedown request. We reserve the right to remove content and suspend accounts involved in repeated infringement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Third-Party Content</h2>
            <p>
              The Service may process content from third-party platforms through user-provided links. MediaTools is not affiliated with, endorsed by, or responsible for any third-party websites or services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. File Storage & Deletion</h2>
            <p>
              Converted files are stored temporarily for processing purposes and are automatically deleted within 1 hour. We do not guarantee file availability after processing is complete.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Account Security</h2>
            <p>
              If you create an account, you are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Service Availability</h2>
            <p>
              We strive to provide reliable service but do not guarantee uninterrupted availability. The Service may be modified, suspended, or discontinued at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Privacy</h2>
            <p>
              Your use of the Service is also governed by our Privacy Policy, which explains how we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Limitation of Liability</h2>
            <p>
              MediaTools is provided "as is" and "as available" without warranties of any kind. To the fullest extent permitted by law, MediaTools shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless MediaTools, its owners, employees, and affiliates from any claims, damages, liabilities, and expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">14. Termination</h2>
            <p>
              We reserve the right to suspend or terminate access to the Service at our sole discretion if these Terms are violated.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">15. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Updated versions will be posted on this page with a revised "Last Updated" date. Continued use of the Service constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">16. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">17. Contact Information</h2>
            <p>
              If you have any questions regarding these Terms, please reach out via our <Link href="/contact" className="text-brand-purple hover:underline">Contact Us page</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
    </PageWrapper>
  );
}
