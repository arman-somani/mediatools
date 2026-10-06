'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';
import { AudioLines, LayoutDashboard, Music, Clapperboard, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { YouTubeIcon } from '@/components/icons';

const links = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Video to Audio', href: '/converter', icon: Music },
  { name: 'YouTube Audio', href: '/youtube', icon: YouTubeIcon },
  { name: 'YouTube Video', href: '/yt-video', icon: Clapperboard },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    const pingServer = async () => {
      try {
        await api.post('/user/ping');
      } catch (err) {
        // Ignore ping errors
      }
    };

    // Initial ping on load
    pingServer();

    // Ping every 60 seconds
    const interval = setInterval(pingServer, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = () => {
    clearAuth();
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    router.push('/');
  };

  const firstLetter = user?.name ? user.name.charAt(0).toUpperCase() : '';

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-3 sm:px-5 pt-3 sm:pt-4">
      <div ref={mobileRef} className="mx-auto max-w-6xl relative">
        <nav
          className={`glass flex items-center justify-between gap-3 pl-3 pr-2 sm:pl-4 py-2 transition-all duration-300 ${scrolled ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_20px_50px_-15px_rgba(0,0,0,0.8)]' : ''}`}
          style={{ borderRadius: '1.25rem', background: scrolled ? 'linear-gradient(140deg, rgba(20,18,44,0.6), rgba(12,12,28,0.5))' : undefined }}
          aria-label="Main"
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0" aria-label="MediaTools home">
            <span className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_20px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.45)] transition-transform duration-300 group-hover:rotate-[-6deg]">
              <AudioLines className="w-5 h-5 text-white" strokeWidth={2.4} />
            </span>
            <span className="text-lg font-display font-bold tracking-tight text-white hidden min-[380px]:block">
              Media<span className="text-gradient">TOOlkit</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1 rounded-2xl p-1 bg-black/15 border border-white/[0.06]">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`nav-link ${isActive ? 'active' : ''}`} aria-current={isActive ? 'page' : undefined}>
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  id="user-avatar-btn"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="user-avatar-btn"
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                  title={user.name}
                >
                  {firstLetter}
                </button>

                {dropdownOpen && (
                  <div className="dropdown-glass absolute right-0 top-[calc(100%+12px)] w-64 overflow-hidden z-50">
                    <div className="p-4 flex items-center gap-3">
                      <span className="user-avatar-btn !w-10 !h-10 shrink-0">{firstLetter}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-white truncate">{user.name}</p>
                        <p className="text-xs text-white/50 truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="divider" />
                    <div className="p-1.5">
                      <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:text-white hover:bg-white/[0.07] transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      {user.role === 'admin' && (
                        <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:text-white hover:bg-white/[0.07] transition-colors">
                          <ShieldCheck className="w-4 h-4" /> Admin Panel
                        </Link>
                      )}
                      <button
                        id="sign-out-btn"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-300 hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="nav-link hidden sm:inline-flex">
                  Sign In
                </Link>
                <Link href="/auth/register" className="btn-primary !py-2 !px-4 text-sm !rounded-xl hidden sm:inline-flex">
                  Get Started
                </Link>
              </>
            )}

            <button
              id="mobile-menu-btn"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="btn-icon lg:hidden !w-10 !h-10"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {/* Mobile sheet */}
        {mobileMenuOpen && (
          <div className="dropdown-glass lg:hidden absolute left-0 right-0 top-[calc(100%+10px)] p-2" style={{ transformOrigin: 'top center' }}>
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/[0.06] hover:text-white'}`}
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.06] border border-white/10">
                    <Icon className="w-4 h-4" />
                  </span>
                  {link.name}
                </Link>
              );
            })}
            {!user && (
              <>
                <div className="divider my-2" />
                <div className="grid grid-cols-2 gap-2 p-1">
                  <Link href="/auth/login" className="btn-glass !py-2.5 text-sm">Sign In</Link>
                  <Link href="/auth/register" className="btn-primary !py-2.5 text-sm">Get Started</Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}