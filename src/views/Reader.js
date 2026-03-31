import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ThumbnailStrip from '../components/ThumbnailStrip';
import Toolbar from '../components/Toolbar';
import {
  SET_CURRENT_PAGE,
  SET_FIT_MODE,
  SET_TOOLBAR_VISIBILITY,
  TOGGLE_THUMBNAILS,
} from '../context/actions';
import { useReaderContext } from '../context/AppContext';
import { useIntersection } from '../hooks/useIntersection';
import { useKeyNav } from '../hooks/useKeyNav';

const fitOrder = ['fit-width', 'fit-height', 'original'];
const CHROME_IDLE_MS = 1800;

function ReaderPage({ page, index, fitClassName, registerPageRef }) {
  const pageRef = useRef(null);
  const isVisible = useIntersection(pageRef, {
    rootMargin: '320px',
    threshold: 0.01,
  });

  useEffect(() => {
    registerPageRef(index, pageRef.current);
    return () => {
      registerPageRef(index, null);
    };
  }, [index, registerPageRef]);

  return (
    <article
      ref={pageRef}
      data-page-index={index}
      className="relative flex min-h-[60vh] items-center justify-center py-4"
    >
      {isVisible ? (
        <img
          src={page}
          alt={`Page ${index + 1}`}
          loading="lazy"
          decoding="async"
          className={`pointer-events-none select-none border border-white/5 bg-black object-contain shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_18px_64px_rgba(0,0,0,0.6)] ${fitClassName}`}
        />
      ) : (
        <div className={`border border-white/5 bg-[#101012] ${fitClassName}`} />
      )}
    </article>
  );
}

function Reader({ libraryApi }) {
  const {
    currentComic,
    currentPage,
    fitMode,
    sidebarOpen,
    toolbarVisible,
    dispatch,
  } = useReaderContext();
  const chromeTimerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const pageRefs = useRef([]);

  const pageCount = currentComic?.pages?.length || currentComic?.pageCount || 0;
  const pages = currentComic?.pages || [];

  const goToPage = useCallback((nextPage) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, nextPage));
    const target = pageRefs.current[clamped];
    if (target) {
      target.scrollIntoView({
        block: 'start',
        behavior: 'auto',
      });
    }
    if (clamped !== currentPage) {
      dispatch({ type: SET_CURRENT_PAGE, payload: clamped });
    }
  }, [currentPage, dispatch, pageCount]);

  const goNext = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const goPrevious = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

  const toggleFitMode = useCallback(() => {
    const currentIndex = fitOrder.indexOf(fitMode);
    const nextFit = fitOrder[(currentIndex + 1) % fitOrder.length];
    dispatch({ type: SET_FIT_MODE, payload: nextFit });
  }, [dispatch, fitMode]);

  const backToLibrary = useCallback(() => {
    libraryApi.closeComic();
  }, [libraryApi]);

  const revealChrome = useCallback(() => {
    dispatch({ type: SET_TOOLBAR_VISIBILITY, payload: true });
    window.clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = window.setTimeout(() => {
      dispatch({ type: SET_TOOLBAR_VISIBILITY, payload: false });
    }, CHROME_IDLE_MS);
  }, [dispatch]);

  useEffect(() => {
    if (!currentComic) {
      return;
    }

    revealChrome();
    libraryApi.queueProgressSave(currentComic.filePath, currentPage, pageCount);
  }, [currentComic, currentPage, libraryApi, pageCount, revealChrome]);

  useEffect(() => () => {
    window.clearTimeout(chromeTimerRef.current);
  }, []);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || !pages.length) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      let bestEntry = null;

      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
          bestEntry = entry;
        }
      }

      if (!bestEntry) {
        return;
      }

      const nextPage = Number(bestEntry.target.getAttribute('data-page-index'));
      if (!Number.isNaN(nextPage) && nextPage !== currentPage) {
        dispatch({ type: SET_CURRENT_PAGE, payload: nextPage });
      }
    }, {
      root,
      threshold: [0.25, 0.5, 0.75, 0.95],
      rootMargin: '-10% 0px -35% 0px',
    });

    pageRefs.current.forEach((node) => {
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [currentPage, dispatch, pages.length]);

  const registerPageRef = useCallback((index, node) => {
    pageRefs.current[index] = node;
  }, []);

  useKeyNav({
    onPrevious: goPrevious,
    onNext: goNext,
    onBack: backToLibrary,
    onToggleFit: toggleFitMode,
    onFullscreen: libraryApi.toggleFullscreen,
    onToggleThumbnails: () => dispatch({ type: TOGGLE_THUMBNAILS }),
  }, Boolean(currentComic));

  const fitClassName = useMemo(() => {
    if (fitMode === 'fit-height') {
      return 'h-[calc(100vh-150px)] w-auto max-w-full';
    }

    if (fitMode === 'original') {
      return 'h-auto w-auto max-w-none';
    }

    return 'h-auto w-full max-w-[1580px]';
  }, [fitMode]);

  if (!currentComic) {
    return null;
  }

  return (
    <div
      className="relative h-full overflow-hidden bg-black text-primary"
      onMouseMove={revealChrome}
      onClick={revealChrome}
    >
      <Toolbar
        visible={toolbarVisible}
        title={currentComic.title}
        currentPage={currentPage}
        pageCount={pageCount}
        fitMode={fitMode}
        onBack={backToLibrary}
        onToggleFit={toggleFitMode}
        onToggleFullscreen={libraryApi.toggleFullscreen}
        onToggleThumbnails={() => dispatch({ type: TOGGLE_THUMBNAILS })}
      />

      <div className={`reader-chrome pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between px-6 pb-5 ${toolbarVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
        <div className="pointer-events-auto border border-white/8 bg-black/55 px-3 py-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.18em] text-secondary backdrop-blur-xl">
          {fitMode === 'fit-width' ? 'Width Lock' : fitMode === 'fit-height' ? 'Height Lock' : 'Original Scan'}
        </div>
        <div className="pointer-events-auto border border-white/8 bg-black/55 px-3 py-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.18em] text-secondary backdrop-blur-xl">
          {currentPage + 1} / {pageCount}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.78),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-[linear-gradient(0deg,rgba(0,0,0,0.82),transparent)]" />

      <div className="flex h-full">
        <ThumbnailStrip
          pages={pages}
          currentPage={currentPage}
          open={sidebarOpen}
          onSelect={(page) => goToPage(page)}
        />

        <div
          ref={scrollContainerRef}
          className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-black px-6 py-20"
        >
          <button
            type="button"
            onClick={goPrevious}
            className="reader-click-zone reader-click-zone-left"
            aria-label="Previous page"
          />
          <button
            type="button"
            onClick={revealChrome}
            className="reader-click-zone reader-click-zone-center"
            aria-label="Show controls"
          />
          <button
            type="button"
            onClick={goNext}
            className="reader-click-zone reader-click-zone-right"
            aria-label="Next page"
          />

          <div className="mx-auto flex max-w-[1680px] flex-col">
            {pages.map((page, index) => (
              <ReaderPage
                key={`${page}-${index}`}
                page={page}
                index={index}
                fitClassName={fitClassName}
                registerPageRef={registerPageRef}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reader;
