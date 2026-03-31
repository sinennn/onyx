import React, { useRef, useState } from 'react';
import { useIntersection } from '../hooks/useIntersection';
import { useDominantColor } from '../hooks/useDominantColor';

function CoverCard({ comic, onOpen, onContextMenu, showProgress, index = 0 }) {
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
      onContextMenu={(event) => onContextMenu?.(event, comic)}
      onMouseEnter={() => {
        setIsHovering(true);
        primeColor();
      }}
      onMouseLeave={() => setIsHovering(false)}
      className="group shelf-card relative text-left"
      style={{
        animationDelay: `${index * 30}ms`,
        boxShadow: isHovering && comic.coverURL ? `0 32px 60px -28px ${glowColor}` : 'none',
      }}
    >
      <div
        className="relative overflow-hidden border border-white/6 bg-elevated transition-transform duration-200"
        style={{
          transform: isHovering ? 'perspective(1000px) rotateX(5deg) rotateY(-4deg) translateY(-6px)' : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)',
        }}
      >
        <div className="aspect-[0.72] overflow-hidden bg-gradient-to-br from-elevated to-overlay">
          {isVisible && comic.coverURL ? (
            <img
              src={comic.coverURL}
              alt={comic.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-elevated to-overlay text-xs uppercase tracking-[0.24em] text-muted">
              Onyx
            </div>
          )}
        </div>
        {showProgress && comic.progress > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/8">
            <div className="h-full bg-accent" style={{ width: progressWidth }} />
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        <p className="truncate text-[13px] font-medium uppercase tracking-[0.04em] text-primary">{comic.title}</p>
        <p className="mt-1 truncate font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.18em] text-secondary">
          {comic.pageCount ? `${comic.pageCount} pages` : 'Ready to import'}
        </p>
      </div>
    </button>
  );
}

export default React.memo(CoverCard);
