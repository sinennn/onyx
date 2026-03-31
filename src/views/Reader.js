import { useCallback, useEffect, useMemo, useRef } from 'react';
import ThumbnailStrip from '../components/ThumbnailStrip';
import Toolbar from '../components/Toolbar';
import {
  SET_CURRENT_PAGE,
  SET_FIT_MODE,
  SET_TOOLBAR_VISIBILITY,
  TOGGLE_THUMBNAILS,
} from '../context/actions';
import { useReaderContext } from '../context/AppContext';
import { useKeyNav } from '../hooks/useKeyNav';
import { usePageBuffer } from '../hooks/usePageBuffer';

const fitOrder = ['fit-width', 'fit-height', 'original'];

function Reader({ libraryApi }) {
  const {
    currentComic,
    currentPage,
    fitMode,
    sidebarOpen,
    toolbarVisible,
    dispatch,
  } = useReaderContext();
  const imgRef = useRef(null);

  const pageCount = currentComic?.pages?.length || currentComic?.pageCount || 0;
  const pages = currentComic?.pages || [];

  usePageBuffer({
    pages,
    currentPage,
    imgRef,
  });

  const goToPage = useCallback((nextPage) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, nextPage));
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

  useEffect(() => {
    if (!currentComic) {
      return;
    }

    libraryApi.queueProgressSave(currentComic.filePath, currentPage, pageCount);
  }, [currentComic, currentPage, libraryApi, pageCount]);

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
      return 'h-[calc(100vh-88px)] w-auto max-w-full';
    }

    if (fitMode === 'original') {
      return 'h-auto w-auto max-w-none';
    }

    return 'h-auto w-full max-w-[1600px]';
  }, [fitMode]);

  if (!currentComic) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden bg-base text-primary">
      <div className={`transition-transform duration-150 ${toolbarVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <Toolbar
          title={currentComic.title}
          currentPage={currentPage}
          pageCount={pageCount}
          fitMode={fitMode}
          onBack={backToLibrary}
          onToggleFit={toggleFitMode}
          onToggleFullscreen={libraryApi.toggleFullscreen}
          onToggleThumbnails={() => dispatch({ type: TOGGLE_THUMBNAILS })}
        />
      </div>

      <div className="flex h-[calc(100vh-48px)]">
        <ThumbnailStrip
          pages={pages}
          currentPage={currentPage}
          open={sidebarOpen}
          onSelect={(page) => goToPage(page)}
        />

        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_top,rgba(79,142,247,0.06),transparent_35%)] p-6">
          <button
            type="button"
            onClick={goPrevious}
            className="reader-click-zone reader-click-zone-left"
            aria-label="Previous page"
          />
          <button
            type="button"
            onClick={() => dispatch({ type: SET_TOOLBAR_VISIBILITY, payload: !toolbarVisible })}
            className="reader-click-zone reader-click-zone-center"
            aria-label="Toggle toolbar"
          />
          <button
            type="button"
            onClick={goNext}
            className="reader-click-zone reader-click-zone-right"
            aria-label="Next page"
          />

          <img
            ref={imgRef}
            alt={`Page ${currentPage + 1}`}
            decoding="async"
            className={`reader-image-enter pointer-events-none select-none rounded-[12px] border border-white/5 bg-elevated object-contain shadow-panel transition-opacity duration-100 ${fitClassName}`}
          />
        </div>
      </div>
    </div>
  );
}

export default Reader;
