import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Sora } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ThemeProvider from '@/components/ThemeProvider';
import GoogleAuthProvider from '@/components/GoogleAuthProvider';
import AnimeBackground from '@/components/AnimeBackground';
import ServerWakeup from '@/components/ServerWakeup';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans-src', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-display-src', weight: ['400', '600', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  title: 'MediaTools - Premium Video to Audio & YouTube Converter',
  description: 'Convert videos to high-quality Audio instantly with our modern suite of tools.',
};

export const viewport: Viewport = {
  themeColor: '#06060f',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${sora.variable} overflow-x-hidden max-w-full`}>
      <body className="antialiased min-h-screen flex flex-col relative overflow-x-hidden max-w-full">
        <AnimeBackground />
        <ServerWakeup />

        <GoogleAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
          <ThemeProvider>
            <Navbar />
            <main className="flex-1 relative z-10 w-full">
              {children}
            </main>
            <Footer />
          </ThemeProvider>
        </GoogleAuthProvider>
      </body>
    </html>
  );
}
