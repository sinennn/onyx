import { useRef } from 'react';
import { useIntersection } from '../hooks/useIntersection';

function ThumbnailCell({ page, index, isActive, onSelect }) {
  const ref = useRef(null);
  const isVisible = useIntersection(ref);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(index)}
      className={`overflow-hidden rounded-[12px] border p-1 text-left transition-colors duration-150 ${isActive ? 'border-accent bg-accent/10' : 'border-white/5 bg-elevated hover:bg-overlay'}`}
    >
      <div className="aspect-[0.72] overflow-hidden rounded-[10px] bg-overlay">
        {isVisible ? (
          <img
            src={page}
            alt={`Page ${index + 1}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <p className="mt-2 text-center text-[11px] font-medium text-secondary">Page {index + 1}</p>
    </button>
  );
}

function ThumbnailStrip({ pages, currentPage, open, onSelect }) {
  if (!open) {
    return null;
  }

  return (
    <aside className="app-scroll h-[calc(100vh-48px)] w-[132px] shrink-0 overflow-y-auto border-r border-white/5 bg-surface/80 p-3">
      <div className="space-y-3">
        {pages.map((page, index) => (
          <ThumbnailCell
            key={`${page}-${index}`}
            page={page}
            index={index}
            isActive={index === currentPage}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}

export default ThumbnailStrip;
