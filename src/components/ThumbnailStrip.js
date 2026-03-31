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
      className={`overflow-hidden border p-1 text-left transition-colors duration-150 ${isActive ? 'border-accent bg-accent/8' : 'border-white/6 bg-[#111113] hover:border-white/12 hover:bg-[#18181c]'}`}
    >
      <div className="aspect-[0.72] overflow-hidden bg-overlay">
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
      <p className="mt-2 text-center font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.18em] text-secondary">Page {index + 1}</p>
    </button>
  );
}

function ThumbnailStrip({ pages, currentPage, open, onSelect }) {
  if (!open) {
    return null;
  }

  return (
    <aside className="app-scroll h-full w-[122px] shrink-0 overflow-y-auto border-r border-white/5 bg-[#0c0c0d] p-3 pt-20">
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
