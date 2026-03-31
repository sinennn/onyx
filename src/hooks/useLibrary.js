import { useCallback, useEffect, useRef } from 'react';
import {
  CLOSE_COMIC,
  DISMISS_TOAST,
  ENQUEUE_TOAST,
  OPEN_COMIC,
  REMOVE_COMIC,
  SET_APP_VERSION,
  SET_LIBRARY,
  SET_READER_LOADING,
  SET_VIEW,
  UPDATE_COMIC,
  UPDATE_SETTINGS,
} from '../context/actions';
import { useLibraryContext, useReaderContext } from '../context/AppContext';

function createThumbnailWorker() {
  return new Worker(new URL('../workers/thumbnailWorker.js', import.meta.url), { type: 'module' });
}

function upsertEntry(list, entry) {
  const existing = list.find((item) => item.filePath === entry.filePath);
  const nextEntry = {
    progress: 0,
    pageCount: 0,
    lastOpened: null,
    coverURL: '',
    ...existing,
    ...entry,
  };

  return existing
    ? list.map((item) => (item.filePath === entry.filePath ? nextEntry : item))
    : [...list, nextEntry];
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useLibrary() {
  const libraryState = useLibraryContext();
  const readerState = useReaderContext();

  const libraryRef = useRef(libraryState.library);
  const progressRef = useRef({ timer: null, payload: null });
  const thumbnailWorkerRef = useRef(null);
  const thumbnailPromisesRef = useRef(new Map());
  const thumbnailMessageIdRef = useRef(0);
  const coverQueueRef = useRef(new Set());
  const bootedRef = useRef(false);
  const pendingExtractionRef = useRef('');

  useEffect(() => {
    libraryRef.current = libraryState.library;
  }, [libraryState.library]);

  const enqueueToast = useCallback((message, tone = 'neutral') => {
    libraryState.dispatch({
      type: ENQUEUE_TOAST,
      payload: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        tone,
      },
    });
  }, [libraryState]);

  const syncLibrary = useCallback(async (nextLibrary) => {
    libraryRef.current = nextLibrary;
    libraryState.dispatch({ type: SET_LIBRARY, payload: nextLibrary });
    try {
      await window.comicAPI.syncLibrary(nextLibrary);
    } catch (error) {
      enqueueToast(error.message || 'Unable to save your library.', 'error');
    }
  }, [enqueueToast, libraryState]);

  const patchComic = useCallback(async (entry) => {
    const nextLibrary = upsertEntry(libraryRef.current, entry);
    libraryState.dispatch({ type: UPDATE_COMIC, payload: entry });
    libraryRef.current = nextLibrary;
    try {
      await window.comicAPI.syncLibrary(nextLibrary);
    } catch (error) {
      enqueueToast(error.message || 'Unable to update this comic.', 'error');
    }
  }, [enqueueToast, libraryState]);

  const ensureThumbnailWorker = useCallback(() => {
    if (thumbnailWorkerRef.current) {
      return thumbnailWorkerRef.current;
    }

    const worker = createThumbnailWorker();
    worker.onmessage = (event) => {
      const { id, buffer, mimeType, error } = event.data;
      const handlers = thumbnailPromisesRef.current.get(id);
      if (!handlers) {
        return;
      }

      thumbnailPromisesRef.current.delete(id);
      if (error) {
        handlers.reject(new Error(error));
        return;
      }

      handlers.resolve(new Blob([buffer], { type: mimeType }));
    };
    thumbnailWorkerRef.current = worker;
    return worker;
  }, []);

  const generateCoverThumbnail = useCallback(async (comic, pages) => {
    if (!pages?.length || comic.coverURL || coverQueueRef.current.has(comic.filePath)) {
      return;
    }

    coverQueueRef.current.add(comic.filePath);

    try {
      const response = await fetch(pages[0]);
      const blob = await response.blob();
      const worker = ensureThumbnailWorker();
      const buffer = await blob.arrayBuffer();
      const id = thumbnailMessageIdRef.current + 1;
      thumbnailMessageIdRef.current = id;

      const thumbnailBlob = await new Promise((resolve, reject) => {
        thumbnailPromisesRef.current.set(id, { resolve, reject });
        worker.postMessage({
          type: 'generate-thumbnail',
          id,
          buffer,
          mimeType: blob.type || 'image/png',
        }, [buffer]);
      });

      const coverURL = await blobToDataURL(thumbnailBlob);
      await patchComic({
        filePath: comic.filePath,
        coverURL,
      });
    } catch (error) {
      enqueueToast(`Unable to build a cover for ${comic.title || 'this comic'}.`, 'error');
    } finally {
      coverQueueRef.current.delete(comic.filePath);
    }
  }, [enqueueToast, ensureThumbnailWorker, patchComic]);

  const ingestFiles = useCallback(async (filePaths) => {
    const uniquePaths = [...new Set(filePaths)].filter(Boolean);

    for (const filePath of uniquePaths) {
      try {
        const extracted = await window.comicAPI.extractComic(filePath);
        const current = libraryRef.current.find((entry) => entry.filePath === filePath);
        const comic = {
          filePath,
          title: extracted.title,
          pageCount: extracted.pageCount,
          progress: current?.progress || 0,
          lastOpened: current?.lastOpened || null,
          coverURL: current?.coverURL || '',
        };

        await patchComic(comic);
        await generateCoverThumbnail(comic, extracted.pages);
      } catch (error) {
        enqueueToast(error.message || 'Unable to import this comic archive.', 'error');
      }
    }
  }, [enqueueToast, generateCoverThumbnail, patchComic]);

  const openComic = useCallback(async (comic) => {
    if (pendingExtractionRef.current && pendingExtractionRef.current !== comic.filePath) {
      window.comicAPI.cancelExtraction(pendingExtractionRef.current);
    }

    pendingExtractionRef.current = comic.filePath;
    readerState.dispatch({ type: SET_READER_LOADING, payload: true });

    try {
      const extracted = await window.comicAPI.extractComic(comic.filePath);
      const startPage = libraryState.settings.rememberReadingPosition
        ? Math.min(comic.progress || 0, Math.max(0, extracted.pageCount - 1))
        : 0;

      const hydratedComic = {
        ...comic,
        title: extracted.title,
        pageCount: extracted.pageCount,
        pages: extracted.pages,
      };

      readerState.dispatch({
        type: OPEN_COMIC,
        payload: {
          comic: hydratedComic,
          startPage,
          fitMode: libraryState.settings.defaultFitMode,
        },
      });

      patchComic({
        filePath: comic.filePath,
        title: extracted.title,
        pageCount: extracted.pageCount,
        lastOpened: new Date().toISOString(),
      });
      generateCoverThumbnail(hydratedComic, extracted.pages);
    } catch (error) {
      if (error.message !== 'Extraction cancelled') {
        enqueueToast(error.message || 'Unable to open this comic.', 'error');
      }
    } finally {
      if (pendingExtractionRef.current === comic.filePath) {
        pendingExtractionRef.current = '';
      }
      readerState.dispatch({ type: SET_READER_LOADING, payload: false });
    }
  }, [enqueueToast, generateCoverThumbnail, libraryState.settings, patchComic, readerState]);

  const closeComic = useCallback(async () => {
    if (progressRef.current.payload) {
      const { filePath, page } = progressRef.current.payload;
      await window.comicAPI.saveProgress(filePath, page);
    }
    readerState.dispatch({ type: CLOSE_COMIC });
  }, [readerState]);

  const queueProgressSave = useCallback((filePath, page, pageCount) => {
    if (!filePath) {
      return;
    }

    libraryState.dispatch({
      type: UPDATE_COMIC,
      payload: {
        filePath,
        progress: page,
        pageCount,
        lastOpened: new Date().toISOString(),
      },
    });

    libraryRef.current = upsertEntry(libraryRef.current, {
      filePath,
      progress: page,
      pageCount,
      lastOpened: new Date().toISOString(),
    });

    window.clearTimeout(progressRef.current.timer);
    progressRef.current.payload = { filePath, page };
    progressRef.current.timer = window.setTimeout(async () => {
      await window.comicAPI.saveProgress(filePath, page);
      progressRef.current.payload = null;
    }, 500);
  }, [libraryState]);

  const removeComic = useCallback(async (filePath) => {
    libraryState.dispatch({ type: REMOVE_COMIC, payload: filePath });
    libraryRef.current = libraryRef.current.filter((entry) => entry.filePath !== filePath);

    try {
      await window.comicAPI.removeFromLibrary(filePath);
    } catch (error) {
      enqueueToast(error.message || 'Unable to remove this comic.', 'error');
    }
  }, [enqueueToast, libraryState]);

  const setView = useCallback((view) => {
    readerState.dispatch({ type: SET_VIEW, payload: view });
  }, [readerState]);

  const updateSettings = useCallback((patch) => {
    libraryState.dispatch({ type: UPDATE_SETTINGS, payload: patch });
  }, [libraryState]);

  useEffect(() => {
    if (bootedRef.current) {
      return undefined;
    }

    bootedRef.current = true;
    window.comicAPI.rendererReady();

    const unsubscribeBoot = window.comicAPI.onLibraryBoot((payload) => {
      if (payload.library) {
        libraryState.dispatch({ type: SET_LIBRARY, payload: payload.library });
        libraryRef.current = payload.library;
      }

      if (payload.version) {
        libraryState.dispatch({ type: SET_APP_VERSION, payload: payload.version });
      }
    });

    const unsubscribeDrops = window.comicAPI.onFilesDropped((filePaths) => {
      ingestFiles(filePaths);
    });

    const unsubscribeFocus = window.comicAPI.onAppFocusChange((isFocused) => {
      if (!thumbnailWorkerRef.current) {
        return;
      }

      thumbnailWorkerRef.current.postMessage({
        type: isFocused ? 'resume' : 'pause',
      });
    });

    window.comicAPI.getLibrary().then((library) => {
      libraryState.dispatch({ type: SET_LIBRARY, payload: library });
      libraryRef.current = library;
    });

    window.comicAPI.getAppInfo().then((info) => {
      if (info?.version) {
        libraryState.dispatch({ type: SET_APP_VERSION, payload: info.version });
      }
    });

    return () => {
      unsubscribeBoot?.();
      unsubscribeDrops?.();
      unsubscribeFocus?.();
      window.clearTimeout(progressRef.current.timer);
      if (pendingExtractionRef.current) {
        window.comicAPI.cancelExtraction(pendingExtractionRef.current);
      }
      thumbnailWorkerRef.current?.terminate();
      thumbnailWorkerRef.current = null;
    };
  }, [ingestFiles, libraryState]);

  useEffect(() => {
    const missingCovers = libraryState.library.filter((comic) => !comic.coverURL);
    if (!missingCovers.length) {
      return undefined;
    }

    let cancelled = false;

    const hydrateMissingCovers = async () => {
      for (const comic of missingCovers) {
        if (cancelled || coverQueueRef.current.has(comic.filePath)) {
          continue;
        }

        try {
          const extracted = await window.comicAPI.extractComic(comic.filePath);
          await generateCoverThumbnail(comic, extracted.pages);
        } catch (error) {
          if (!cancelled) {
            enqueueToast(`Unable to refresh the cover for ${comic.title}.`, 'error');
          }
        }
      }
    };

    hydrateMissingCovers();
    return () => {
      cancelled = true;
    };
  }, [enqueueToast, generateCoverThumbnail, libraryState.library]);

  const dismissToast = useCallback((toastId) => {
    libraryState.dispatch({ type: DISMISS_TOAST, payload: toastId });
  }, [libraryState]);

  return {
    library: libraryState.library,
    settings: libraryState.settings,
    currentComic: readerState.currentComic,
    currentPage: readerState.currentPage,
    pickFiles: () => window.comicAPI.openFilePicker(),
    openComic,
    closeComic,
    queueProgressSave,
    removeComic,
    setView,
    updateSettings,
    syncLibrary,
    dismissToast,
    toggleFullscreen: () => window.comicAPI.toggleFullscreen(),
  };
}
