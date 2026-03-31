import React, { useRef, useState } from 'react';
import { useIntersection } from '../hooks/useIntersection';
import { useDominantColor } from '../hooks/useDominantColor';

function CoverCard({ comic, onOpen, onContextMenu, showProgress }) {
  const cardRef = useRef(null);
  const isVisible = useIntersection(cardRef);
  const [isHovering, setIsHovering] = useState(false);
  const { glowColor, primeColor } = useDominantColor(comic.coverURL);

  const progressWidth = comic.pageCount > 0
    ? `${Math.min(100, ((comic.progress || 0) / comic.pageCount) * 100)}%`
    : '0%';

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onOpen(comic)}
      onContextMenu={(event) => onContextMenu(event, comic)}
      onMouseEnter={() => {
        setIsHovering(true);
        primeColor();
      }}
      onMouseLeave={() => setIsHovering(false)}
      className="group relative text-left"
      style={{
        boxShadow: isHovering && comic.coverURL ? `0 18px 40px -20px ${glowColor}` : 'none',
      }}
    >
      <div className="relative overflow-hidden rounded-[14px] bg-elevated">
        <div className="aspect-[0.72] overflow-hidden rounded-[14px] border border-white/5 bg-gradient-to-br from-elevated to-overlay">
          {isVisible && comic.coverURL ? (
            <img
              src={comic.coverURL}
              alt={comic.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full rounded-[4px] object-cover transition-transform duration-150 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-elevated to-overlay text-xs uppercase tracking-[0.2em] text-muted">
              Panel
            </div>
          )}
        </div>
        {showProgress && comic.progress > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/5">
            <div className="h-full bg-accent" style={{ width: progressWidth }} />
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        <p className="truncate text-sm font-semibold text-primary">{comic.title}</p>
        <p className="truncate text-xs text-secondary">
          {comic.pageCount ? `${comic.pageCount} pages` : 'Ready to import'}
        </p>
      </div>
    </button>
  );
}

export default React.memo(CoverCard);
