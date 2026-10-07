'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, LogOut, Menu, X, ShieldCheck, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import Logo from '@/components/Logo';

const TOOL_LINKS = [
  { name: 'Video to Audio', href: '/converter' },
  { name: 'YouTube to MP3', href: '/youtube' },
  { name: 'YouTube to MP4', href: '/yt-video' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); setMobileOpen(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  // Lock page scroll while the mobile sheet is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!user) return;
    const pingServer = async () => {
      try {
        await api.post('/user/ping');
      } catch {
        // Ignore ping errors
      }
    };

    // Initial ping on load, then every 60 seconds
    pingServer();
    const interval = setInterval(pingServer, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = () => {
    clearAuth();
    setMenuOpen(false);
    setMobileOpen(false);
    router.push('/');
  };

  const signedIn = mounted && !!user;
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '';
  const isActive = (href: string) => pathname === href;

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-colors duration-200 ${
        scrolled || mobileOpen ? 'border-line bg-bg/85 backdrop-blur-md' : 'border-transparent bg-bg'
      }`}
    >
      <nav className="container-page flex h-14 items-center gap-6" aria-label="Main">
        <Logo />

        <div className="hidden md:flex items-center gap-1">
          {TOOL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <>
              <Link
                href="/dashboard"
                className="nav-link hidden md:inline-flex"
                aria-current={isActive('/dashboard') ? 'page' : undefined}
              >
                Dashboard
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  id="user-avatar-btn"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 hover:bg-white/5 transition-colors"
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 border border-line-strong text-[13px] font-semibold text-fg">
                    {initial}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-fg-subtle transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {menuOpen && (
                  <div role="menu" className="menu absolute right-0 top-[calc(100%+8px)] w-60 p-1 origin-top-right">
                    <div className="px-2.5 py-2">
                      <p className="text-[13.5px] font-medium text-fg truncate">{user?.name}</p>
                      <p className="text-[12.5px] text-fg-subtle truncate">{user?.email}</p>
                    </div>
                    <div className="divider my-1" />
                    <Link href="/dashboard" role="menuitem" className="menu-item">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                    {user?.role === 'admin' && (
                      <Link href="/admin" role="menuitem" className="menu-item">
                        <ShieldCheck className="h-4 w-4" /> Admin
                      </Link>
                    )}
                    <div className="divider my-1" />
                    <button id="sign-out-btn" role="menuitem" onClick={handleSignOut} className="menu-item">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="nav-link hidden sm:inline-flex">
                Sign in
              </Link>
              <Link href="/auth/register" className="btn-primary btn-sm hidden sm:inline-flex">
                Get started
              </Link>
            </>
          )}

          <button
            id="mobile-menu-btn"
            onClick={() => setMobileOpen((v) => !v)}
            className="btn-icon md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-0 bg-bg border-t border-line anim-fade-in overflow-y-auto">
          <div className="container-page py-4">
            <p className="eyebrow px-2 mb-1">Tools</p>
            {TOOL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center h-11 px-2 rounded-lg text-[15px] ${isActive(link.href) ? 'text-fg bg-white/5' : 'text-fg-muted'}`}
              >
                {link.name}
              </Link>
            ))}
            {signedIn && (
              <>
                <div className="divider my-3" />
                <Link href="/dashboard" className="flex items-center h-11 px-2 rounded-lg text-[15px] text-fg-muted">Dashboard</Link>
                {user?.role === 'admin' && (
                  <Link href="/admin" className="flex items-center h-11 px-2 rounded-lg text-[15px] text-fg-muted">Admin</Link>
                )}
                <button onClick={handleSignOut} className="flex w-full items-center h-11 px-2 rounded-lg text-[15px] text-fg-muted">Sign out</button>
              </>
            )}
            {!signedIn && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Link href="/auth/login" className="btn-secondary">Sign in</Link>
                <Link href="/auth/register" className="btn-primary">Get started</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}