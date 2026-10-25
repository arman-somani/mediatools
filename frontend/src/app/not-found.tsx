import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="mono-label">
          <span className="text-accent">404</span>
          <span className="mx-2 text-fg-subtle/60">/</span>
          SIGNAL LOST
        </p>
        <h1 className="font-display font-bold text-5xl sm:text-6xl tracking-tight text-fg mt-5 leading-none">
          Nothing on
          <br />
          this dial.
        </h1>
        <p className="text-fg-muted mt-5 leading-relaxed">
          The page you are looking for was moved, deleted, or never existed.
          The tools are all still one click away.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <Link href="/" className="btn-primary btn-lg">
            Back home
          </Link>
          <Link href="/converter" className="btn-secondary btn-lg">
            Convert a file
          </Link>
        </div>
      </div>
    </div>
  );
}
