import { useEffect, useRef } from 'react';

const pageFitClasses = {
  single: {
    'fit-width': 'h-auto w-full max-w-[1580px]',
    'fit-height': 'h-[calc(100vh-150px)] w-auto max-w-full',
    original: 'h-auto w-auto max-w-none',
  },
  spread: {
    'fit-width': 'h-auto w-1/2 max-w-[790px]',
    'fit-height': 'h-[calc(100vh-150px)] w-auto max-w-[50%]',
    original: 'h-auto w-auto max-w-none',
  },
};

// One page, or a two-page spread, at a time. In right-to-left (manga) reading the spread is
// mirrored and the click zones swap, so the left side always moves forward through the book.
function PagedView({ pages, shown, layout, direction, fitMode, onPrevious, onNext, onRevealChrome }) {
  const containerRef = useRef(null);
  const isRtl = direction === 'rtl';
  const shownKey = shown.join('-');
  const fitClasses = pageFitClasses[layout] || pageFitClasses.single;
  const pageClassName = fitClasses[fitMode] || fitClasses['fit-width'];

  useEffect(() => {
    containerRef.current?.scrollTo?.(0, 0);
  }, [shownKey]);

  // Warm the cache for the pages either side so turning feels instant.
  useEffect(() => {
    const first = shown[0] ?? 0;
    const last = shown[shown.length - 1] ?? 0;
    const neighbours = [last + 1, last + 2, last + 3, first - 1, first - 2];
    const images = neighbours.filter((index) => pages[index]).map((index) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = pages[index];
      return image;
    });
    return () => images.forEach((image) => { image.src = ''; });
  }, [pages, shownKey]);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 overflow-auto bg-black">
      <button
        type="button"
        onClick={isRtl ? onNext : onPrevious}
        className="reader-click-zone reader-click-zone-left"
        aria-label={isRtl ? 'Next page' : 'Previous page'}
      />
      <button
        type="button"
        onClick={onRevealChrome}
        className="reader-click-zone reader-click-zone-center"
        aria-label="Show controls"
      />
      <button
        type="button"
        onClick={isRtl ? onPrevious : onNext}
        className="reader-click-zone reader-click-zone-right"
        aria-label={isRtl ? 'Previous page' : 'Next page'}
      />

      <div className={`flex min-h-full items-center justify-center px-6 py-20 ${isRtl ? 'flex-row-reverse' : ''}`}>
        {shown.map((index) => (
          <img
            key={`${pages[index]}-${index}`}
            src={pages[index]}
            alt={`Page ${index + 1}`}
            decoding="async"
            className={`pointer-events-none select-none border border-white/5 bg-black object-contain shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_18px_64px_rgba(0,0,0,0.6)] ${pageClassName}`}
          />
        ))}
      </div>
    </div>
  );
}

export default PagedView;
