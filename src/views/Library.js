import { useEffect, useMemo, useRef, useState } from 'react';
import CoverCard from '../components/CoverCard';
import ContextMenu from '../components/ContextMenu';
import DropZone from '../components/DropZone';
import { useLibraryContext } from '../context/AppContext';
import { useDominantColor } from '../hooks/useDominantColor';

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
  const heroComic = continueReading[0] || sortedLibrary[0] || null;
  const heroPage = heroComic?.pageCount
    ? Math.min((heroComic.progress || 0) + 1, heroComic.pageCount)
    : null;
  const heroProgressPercent = heroComic?.pageCount
    ? Math.round(Math.min(100, ((heroComic.progress || 0) / heroComic.pageCount) * 100))
    : 0;
  const heroLastOpened = heroComic?.lastOpened
    ? new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(heroComic.lastOpened))
    : 'Not opened yet';
  const progressWidth = heroComic && heroComic.pageCount > 0
    ? `${Math.min(100, ((heroComic.progress || 0) / heroComic.pageCount) * 100)}%`
    : '0%';
  const { glowColor, primeColor } = useDominantColor(heroComic?.coverURL);

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

  useEffect(() => {
    primeColor();
  }, [heroComic?.coverURL, primeColor]);

  const ambientStyle = {
    '--ambient-rgb': glowColor.match(/\d+/g)?.slice(0, 3).join(', ') || '255, 60, 47',
  };

  return (
    <div className="relative h-full overflow-hidden" style={ambientStyle}>
      <DropZone active={dragActive} />
      <div className="app-scroll relative h-full overflow-y-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[44vh] overflow-hidden">
          <div
            className="ambient-wash absolute left-1/2 top-[-12%] h-[60vh] w-[72vw] -translate-x-1/2 opacity-75 blur-3xl"
            style={{ background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 68%)` }}
          />
        </div>

        <div className="relative mx-auto max-w-[1320px] px-6 py-6">
          <header className="mb-4 flex items-center justify-between border-b border-white/6 pb-3">
            <div>
              <p className="label-caps text-muted">Archive</p>
              <h2 className="display-title mt-2 text-[30px] leading-none text-primary">Onyx Library</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="label-caps text-muted">Collection</p>
                <p className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.18em] text-secondary">{sortedLibrary.length} books</p>
              </div>
              <button
                type="button"
                onClick={libraryApi.pickFiles}
                className="border border-accent bg-accent px-4 py-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] text-white transition-colors duration-150 hover:bg-[#ff564b]"
              >
                Import
              </button>
            </div>
          </header>

          <section className="relative border border-white/6 bg-[#0f0f11]">
            {heroComic ? (
              <button
                type="button"
                onClick={() => libraryApi.openComic(heroComic)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    comic: heroComic,
                  });
                }}
                className="group relative block w-full overflow-hidden text-left"
              >
                <div className="absolute inset-0">
                  {heroComic.coverURL ? (
                    <img
                      src={heroComic.coverURL}
                      alt={heroComic.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover opacity-55 saturate-[0.88] transition-transform duration-500 group-hover:scale-[1.015]"
                    />
                  ) : (
                    <div className="h-full w-full bg-[linear-gradient(135deg,#141416,#050506)]" />
                  )}
                </div>
                <div className="ambient-wash absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle_at_22%_38%, ${glowColor} 0%, rgba(0,0,0,0) 48%)` }} />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92),rgba(0,0,0,0.55),rgba(0,0,0,0.88)),linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.85))]" />

                <div className="relative flex min-h-[360px] flex-col justify-between gap-8 p-6 md:p-7 lg:min-h-[420px]">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                    <div className="min-w-0">
                      <p className="label-caps text-accent">Currently Reading</p>
                      <h3 className="display-title mt-4 max-w-[760px] break-words text-[clamp(38px,6vw,82px)] leading-[0.88] text-primary">
                        {heroComic.title}
                      </h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:justify-items-end lg:text-right">
                      <div>
                        <p className="label-caps text-muted">Status</p>
                        <p className="mt-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] text-secondary">
                          {continueReading.length ? `${continueReading.length} active issue${continueReading.length > 1 ? 's' : ''}` : 'Fresh import'}
                        </p>
                      </div>
                      <div>
                        <p className="label-caps text-muted">Last Opened</p>
                        <p className="mt-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] text-secondary">
                          {heroLastOpened}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="max-w-[760px]">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="border border-accent bg-accent px-4 py-2 font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.22em] text-white">
                        Resume
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] text-secondary">
                        {heroComic.pageCount ? `Page ${heroPage} / ${heroComic.pageCount}` : 'Ready to open'}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] text-secondary">
                        {heroComic.pageCount ? `${heroProgressPercent}% read` : 'New issue'}
                      </span>
                    </div>
                    {settings.showProgressBars && heroComic.progress > 0 ? (
                      <div className="h-px bg-white/12">
                        <div className="h-full bg-accent" style={{ width: progressWidth }} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            ) : (
              <div className="flex h-[38vh] min-h-[320px] items-end bg-[linear-gradient(135deg,#0f0f11,#040404)] p-7">
                <div className="max-w-[520px]">
                  <p className="label-caps text-accent">Currently Reading</p>
                  <h3 className="display-title mt-4 text-[clamp(48px,8vw,88px)] leading-[0.9] text-primary">Build The Den</h3>
                  <p className="mt-4 max-w-[420px] text-sm leading-7 text-secondary">
                    Import a stack of comics and Onyx will turn the shelf into a midnight archive built around the art you actually read.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="mt-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="label-caps text-muted">Library Items</p>
                <h3 className="display-title mt-2 text-[36px] leading-none text-primary">Shelf</h3>
              </div>
              <p className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.2em] text-secondary">{sortedLibrary.length} covers</p>
            </div>

            {sortedLibrary.length ? (
              <div className="cover-grid">
                {sortedLibrary.map((comic, index) => (
                  <CoverCard
                    key={comic.filePath}
                    comic={comic}
                    index={index}
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
              <div className="flex h-[240px] items-center justify-center border border-dashed border-white/10 bg-[#0f0f11]">
                <div className="max-w-md px-6 text-center">
                  <h3 className="display-title text-[44px] leading-none text-primary">No Issues Shelved</h3>
                  <p className="mt-4 text-sm leading-7 text-secondary">
                    Drop CBZ or CBR files into the window and the archive will start to take shape.
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
