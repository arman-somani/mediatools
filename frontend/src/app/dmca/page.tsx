import { Metadata } from 'next';
import PageWrapper from '@/components/PageWrapper';
import { ShieldAlert, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'DMCA Notice - MediaTools',
  description: 'Digital Millennium Copyright Act compliance and takedown notice information for MediaTools.',
};

export default function DMCAPage() {
  return (
    <PageWrapper>
      <main className="min-h-screen container-page pt-28 pb-20">
        <div className="max-w-4xl mx-auto card p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-accent">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg">
              DMCA Compliance
            </h1>
          </div>
          <p className="text-xs text-fg-subtle mb-8">Digital Millennium Copyright Act Notice</p>

          <div className="space-y-6 text-sm sm:text-base text-fg-muted leading-relaxed">
            <p>
              MediaTools respects the intellectual property rights of others and adheres strictly to the Digital Millennium Copyright Act (&ldquo;DMCA&rdquo;). We provide an automated tool for media format conversion and processing. We do not host, store permanently, or distribute copyrighted media files.
            </p>

            <section>
              <h2 className="text-base sm:text-lg font-semibold text-fg mb-2">Filing a Takedown Notice</h2>
              <p className="mb-3">
                If you believe that any material accessed or transmitted through our service infringes your copyright, please submit a written notification including:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                <li>Identification of the copyrighted work claimed to have been infringed.</li>
                <li>Identification of the specific URL or material that is claimed to be infringing.</li>
                <li>Your contact information including name, address, telephone number, and email address.</li>
                <li>A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</li>
                <li>A statement made under penalty of perjury that the information in the notification is accurate and that you are authorized to act on behalf of the owner.</li>
              </ul>
            </section>

            <section className="pt-2">
              <div className="card-inset p-4 sm:p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-fg-subtle">Designated DMCA Agent Email</p>
                  <a href="mailto:mediatools.contactus@gmail.com" className="text-sm font-semibold text-fg hover:text-accent transition-colors">
                    mediatools.contactus@gmail.com
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </PageWrapper>
  );
}