import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ThemeProvider from '@/components/ThemeProvider';
import GoogleAuthProvider from '@/components/GoogleAuthProvider';
import ServerWakeup from '@/components/ServerWakeup';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'MediaTools: Video to Audio and YouTube Downloader',
    template: '%s · MediaTools',
  },
  description:
    'Extract audio from video files at up to 320 kbps, or download YouTube videos as MP3 or MP4 up to 8K. Free, no watermarks, files deleted after one hour.',
};

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col overflow-x-hidden">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] btn-secondary btn-sm"
        >
          Skip to content
        </a>
        <ServerWakeup />

        <GoogleAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
          <ThemeProvider>
            <Navbar />
            <main id="main" className="flex-1 w-full">
              {children}
            </main>
            <Footer />
          </ThemeProvider>
        </GoogleAuthProvider>

        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#161618',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#ededee',
              fontSize: '13.5px',
            },
          }}
        />
      </body>
    </html>
  );
}
