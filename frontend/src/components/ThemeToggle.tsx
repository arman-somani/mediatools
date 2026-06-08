'use client';
import { useThemeStore } from '@/lib/store';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="theme-icon" strokeWidth={2}>
          <circle cx="12" cy="12" r="5" stroke="currentColor" />
          <path stroke="currentColor" strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="theme-icon" strokeWidth={2}>
          <path stroke="currentColor" strokeLinecap="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
