'use client';

/**
 * Fixed aurora backdrop that gives the frosted-glass surfaces something
 * colourful to blur. Pure CSS animation — no JS per frame.
 */
export default function AnimeBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora-blob b1" />
      <div className="aurora-blob b2" />
      <div className="aurora-blob b3" />
      <div className="aurora-blob b4" />
      <div className="aurora-grid" />
      <div className="aurora-noise" />
      <div className="aurora-vignette" />
    </div>
  );
}
