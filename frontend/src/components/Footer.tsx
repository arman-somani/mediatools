import Link from 'next/link';
import { GitHubIcon, InstagramIcon } from '@/components/icons';
import Logo from '@/components/Logo';

const COLUMNS = [
  {
    title: 'Tools',
    links: [
      { label: 'Video to Audio', href: '/converter' },
      { label: 'YouTube to MP3', href: '/youtube' },
      { label: 'YouTube to MP4', href: '/yt-video' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Send feedback', href: '/feedback' },
      { label: 'Contact', href: '/contact' },
      { label: 'Source code', href: 'https://github.com/arman-somani/', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'DMCA', href: '/dmca' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-page py-12">
        <div className="grid gap-10 grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-fg-muted">
              Pull audio out of video files and save YouTube videos as MP3 or MP4. Free to use.
            </p>
            <div className="mt-5 flex items-center gap-1 -ml-2">
              <a href="https://github.com/arman-somani/" target="_blank" rel="noopener noreferrer" className="btn-icon" aria-label="GitHub">
                <GitHubIcon className="h-4 w-4" />
              </a>
              <a href="https://instagram.com/arman_somani" target="_blank" rel="noopener noreferrer" className="btn-icon" aria-label="Instagram">
                <InstagramIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-[13px] font-medium text-fg">{col.title}</h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {'external' in l && l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-[13.5px] text-fg-muted hover:text-fg transition-colors">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-[13.5px] text-fg-muted hover:text-fg transition-colors">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col-reverse gap-3 border-t border-line pt-6 text-[12.5px] text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MediaTools</p>
          <p>Uploaded and converted files are deleted after one hour.</p>
        </div>
      </div>
    </footer>
  );
}