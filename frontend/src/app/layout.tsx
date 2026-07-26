import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ThemeProvider from '@/components/ThemeProvider';
import GoogleAuthProvider from '@/components/GoogleAuthProvider';
import AnimeBackground from '@/components/AnimeBackground';
import ServerWakeup from '@/components/ServerWakeup';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });

export const metadata: Metadata = {
  title: 'MediaTools - Premium Video to Audio & YouTube Converter',
  description: 'Convert videos to high-quality Audio instantly with our modern suite of tools.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden max-w-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${jakarta.variable} antialiased min-h-screen flex flex-col bg-gradient-mesh relative overflow-x-hidden max-w-full`}>
        {/* Glow orbs for deep background depth */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-violet/20 blur-[120px] rounded-full pointer-events-none animate-blob-1" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-cyan/10 blur-[120px] rounded-full pointer-events-none animate-blob-2" />
        {/* Global Video and Orb Background */}
        <div className="fixed inset-0 z-[-1] pointer-events-none">
          <AnimeBackground />
          <video autoPlay loop muted playsInline className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto -translate-x-1/2 -translate-y-1/2 object-cover opacity-50">
            <source src="https://cdn.pixabay.com/video/2020/05/25/40141-425126867_large.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/70 via-[#0f172a]/50 to-[#0f172a] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] md:w-[800px] h-[300px] md:h-[400px] bg-brand-purple/20 blur-[100px] md:blur-[140px] rounded-full pointer-events-none" />
        </div>
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
