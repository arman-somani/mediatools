'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  const links = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Video to Audio ', href: '/converter' },
    { name: 'YouTube to Audio ', href: '/youtube' },
    { name: 'YT Video', href: '/yt-video' },
    { name: 'Universal Downloader', href: '/universal' },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    clearAuth();
    setDropdownOpen(false);
    router.push('/');
  };

  const firstLetter = user—.name — user.name.charAt(0).toUpperCase() : '';

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 navbar-bg backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          {/* Alternating 4-Icon Logo Cycle */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            {/* 1. Play Button (Emerald) */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              animate={{ opacity: [1, 1, 0, 0, 1] }}
              transition={{ duration: 40, ease: "easeInOut", repeat: Infinity, times: [0, 0.2375, 0.25, 0.9875, 1] }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5.14V19.08L19 12.11L8 5.14Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </motion.div>

            {/* 2. Pause Button (Violet) */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center text-brand-violet drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]"
              animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
              transition={{ duration: 40, ease: "easeInOut", repeat: Infinity, times: [0, 0.2375, 0.25, 0.4875, 0.5, 1] }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </motion.div>

            {/* 3. Video Camera (Cyan) */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center text-brand-cyan drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
              animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
              transition={{ duration: 40, ease: "easeInOut", repeat: Infinity, times: [0, 0.4875, 0.5, 0.7375, 0.75, 1] }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 10.5V7C17 5.89543 16.1046 5 15 5H4C2.89543 5 2 5.89543 2 7V17C2 18.1046 2.89543 19 4 19H15C16.1046 19 17 18.1046 17 17V13.5L21 17.5V6.5L17 10.5Z" />
              </svg>
            </motion.div>

            {/* 4. Double Music Note (Purple) */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center text-brand-purple drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ duration: 40, ease: "easeInOut", repeat: Infinity, times: [0, 0.7375, 0.75, 0.9875, 1] }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 3V15.5C21 17.43 19.43 19 17.5 19C15.57 19 14 17.43 14 15.5C14 13.57 15.57 12 17.5 12C18.04 12 18.55 12.12 19 12.34V6.47L9 8.6V17.5C9 19.43 7.43 21 5.5 21C3.57 21 2 19.43 2 17.5C2 15.57 3.57 14 5.5 14C6.04 14 6.55 14.12 7 14.34V3L21 3Z" />
              </svg>
            </motion.div>
          </div>

          <span className="text-2xl font-bold navbar-text">
            MediaTOOlkit
          </span>
        </Link>

        {/* Center: Desktop links & Mobile menu */}
        <div className="flex items-center justify-center flex-1 md:flex-none">
          {/* Desktop nav links */}
          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-brand-purple ${isActive — 'text-brand-purple' : 'nav-link-color'
                    }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Mobile Tools Dropdown */}
          <div className="relative md:hidden" ref={mobileDropdownRef}>
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="text-sm font-semibold nav-link-color hover:text-brand-purple flex items-center gap-1 transition-colors px-2 py-1"
            >
              Tools
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={`transition-transform ${mobileMenuOpen — 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {mobileMenuOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-48 rounded-xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl p-2 shadow-[0_0_40px_rgba(0,0,0,0.8)] flex flex-col gap-1 z-50">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block rounded-lg px-4 py-2 text-sm transition-colors hover:bg-white/5 ${pathname === link.href — 'text-brand-purple bg-white/5 font-medium' : 'text-white/70'}`}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side: auth */}
        <div className="flex items-center gap-2 sm:gap-3 justify-end">

          {user — (
            <div className="relative" ref={dropdownRef}>
              <button
                id="user-avatar-btn"
                onClick={() => setDropdownOpen((v) => !v)}
                className="user-avatar-btn"
                aria-label="User menu"
                title={user.name}
              >
                {firstLetter}
              </button>

              {dropdownOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <span className="user-dropdown-name">{user.name}</span>
                    <span className="user-dropdown-email">{user.email}</span>
                  </div>
                  <div className="user-dropdown-divider" />
                  <button
                    id="sign-out-btn"
                    onClick={handleSignOut}
                    className="user-dropdown-signout"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm nav-link-color hover:text-brand-purple transition"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="hidden sm:block rounded-xl bg-brand-purple px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}