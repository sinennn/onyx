import { useEffect, useMemo, useRef, useState } from 'react';
import CoverCard from '../components/CoverCard';
import ContextMenu from '../components/ContextMenu';
import DropZone from '../components/DropZone';
import HeroBanner from '../components/HeroBanner';
import SpotlightCard from '../components/SpotlightCard';
import { useLibraryContext } from '../context/AppContext';

function Library({ libraryApi }) {
  const { library, settings } = useLibraryContext();
  const [contextMenu, setContextMenu] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const dragCounterRef = useRef(0);

  const sortedLibrary = useMemo(() => (
    [...library].sort((left, right) => {
      const leftTime = left.lastOpened ? new Date(left.lastOpened).getTime() : 0;
      const rightTime = right.lastOpened ? new Date(right.lastOpened).getTime() : 0;
      return rightTime - leftTime || left.title.localeCompare(right.title);
    })
  ), [library]);

  const continueReading = useMemo(() => (
    sortedLibrary.filter((comic) => comic.progress > 0)
  ), [sortedLibrary]);

  const heroComic = sortedLibrary[0] || null;
  const spotlightComics = sortedLibrary.slice(0, 3);

  useEffect(() => {
    const onDragEnter = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) {
        return;
      }

      dragCounterRef.current += 1;
      setDragActive(true);
    };

    const onDragLeave = () => {
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setDragActive(false);
      }
    };

    const onDrop = () => {
      dragCounterRef.current = 0;
      setDragActive(false);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return (
    <div className="relative h-screen overflow-hidden">
      <DropZone active={dragActive} />
      <div className="app-scroll h-screen overflow-y-auto px-10 py-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-caps text-accent">Library</p>
              <h2 className="mt-2 text-3xl font-bold text-primary">Your collection</h2>
            </div>
            <button
              type="button"
              onClick={libraryApi.pickFiles}
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-white/10"
            >
              Add Comics
            </button>
          </div>

          <div className="mt-8">
            <HeroBanner comic={heroComic} onOpen={libraryApi.openComic} />
          </div>

          {continueReading.length ? (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-primary">Continue Reading</h3>
                <p className="label-caps text-muted">Pick up where you left off</p>
              </div>
              <div className="app-scroll flex gap-4 overflow-x-auto pb-2">
                {continueReading.map((comic) => (
                  <div key={comic.filePath} className="w-[220px] shrink-0">
                    <CoverCard
                      comic={comic}
                      onOpen={libraryApi.openComic}
                      onContextMenu={(event, selectedComic) => {
                        event.preventDefault();
                        setContextMenu({
                          x: event.clientX,
                          y: event.clientY,
                          comic: selectedComic,
                        });
                      }}
                      showProgress={settings.showProgressBars}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {spotlightComics.length ? (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-primary">Spotlight</h3>
                <p className="label-caps text-muted">Fresh reads from your shelf</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {spotlightComics.map((comic) => (
                  <SpotlightCard key={comic.filePath} comic={comic} onOpen={libraryApi.openComic} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10 pb-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary">Your Library</h3>
              <p className="label-caps text-muted">{sortedLibrary.length} comics</p>
            </div>

            {sortedLibrary.length ? (
              <div className="cover-grid">
                {sortedLibrary.map((comic) => (
                  <CoverCard
                    key={comic.filePath}
                    comic={comic}
                    onOpen={libraryApi.openComic}
                    onContextMenu={(event, selectedComic) => {
                      event.preventDefault();
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        comic: selectedComic,
                      });
                    }}
                    showProgress={settings.showProgressBars}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-[360px] items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-surface">
                <div className="max-w-lg text-center">
                  <h3 className="text-2xl font-semibold text-primary">Your shelf is waiting.</h3>
                  <p className="mt-3 text-sm leading-7 text-secondary">
                    Bring in a stack of CBZ or CBR files and Panel will build a dark native reading library around them.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <ContextMenu
        menu={contextMenu}
        onRead={(comic) => {
          setContextMenu(null);
          libraryApi.openComic(comic);
        }}
        onRemove={async (comic) => {
          setContextMenu(null);
          await libraryApi.removeComic(comic.filePath);
        }}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
}

export default Library;
