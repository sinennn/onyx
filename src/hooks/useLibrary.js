import { useCallback, useEffect, useRef, useState } from 'react';
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

function getComicAPI() {
  if (typeof window !== 'undefined' && window.comicAPI) {
    return window.comicAPI;
  }

  throw new Error('Desktop bridge unavailable. Launch Onyx through Electron to import comics.');
}

export function useLibrary() {
  const libraryState = useLibraryContext();
  const readerState = useReaderContext();

  const [updateState, setUpdateState] = useState({
    state: 'idle',
    currentVersion: null,
    availableVersion: null,
    downloadedVersion: null,
    progress: 0,
    message: '',
  });
  const libraryRef = useRef(libraryState.library);
  const settingsRef = useRef(libraryState.settings);
  const progressRef = useRef({ timer: null, payload: null });
  const thumbnailWorkerRef = useRef(null);
  const thumbnailPromisesRef = useRef(new Map());
  const thumbnailMessageIdRef = useRef(0);
  const coverQueueRef = useRef(new Set());
  const bootedRef = useRef(false);
  const pendingExtractionRef = useRef('');
  const enqueueToastRef = useRef(null);
  const ingestFilesRef = useRef(null);

  useEffect(() => {
    libraryRef.current = libraryState.library;
  }, [libraryState.library]);

  useEffect(() => {
    settingsRef.current = libraryState.settings;
  }, [libraryState.settings]);

  const enqueueToast = useCallback((message, tone = 'neutral') => {
    libraryState.dispatch({
      type: ENQUEUE_TOAST,
      payload: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        tone,
      },
    });
  }, [libraryState.dispatch]);

  useEffect(() => {
    enqueueToastRef.current = enqueueToast;
  }, [enqueueToast]);

  const syncLibrary = useCallback(async (nextLibrary) => {
    libraryRef.current = nextLibrary;
    libraryState.dispatch({ type: SET_LIBRARY, payload: nextLibrary });
    try {
      await getComicAPI().syncLibrary(nextLibrary);
    } catch (error) {
      enqueueToast(error.message || 'Unable to save your library.', 'error');
    }
  }, [enqueueToast, libraryState.dispatch]);

  const patchComic = useCallback(async (entry) => {
    const nextLibrary = upsertEntry(libraryRef.current, entry);
    libraryState.dispatch({ type: UPDATE_COMIC, payload: entry });
    libraryRef.current = nextLibrary;
    try {
      await getComicAPI().syncLibrary(nextLibrary);
    } catch (error) {
      enqueueToast(error.message || 'Unable to update this comic.', 'error');
    }
  }, [enqueueToast, libraryState.dispatch]);

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

  const generateCoverThumbnail = useCallback(async (comic, coverSource) => {
    if (!coverSource || comic.coverURL || coverQueueRef.current.has(comic.filePath)) {
      return;
    }

    coverQueueRef.current.add(comic.filePath);

    try {
      const response = await fetch(coverSource);
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
    if (!uniquePaths.length) {
      return;
    }

    let nextLibrary = libraryRef.current;
    const coverJobs = [];

    for (const filePath of uniquePaths) {
      try {
        const inspected = await getComicAPI().inspectComic(filePath);
        const current = nextLibrary.find((entry) => entry.filePath === filePath);
        const comic = {
          filePath,
          title: inspected.title,
          pageCount: inspected.pageCount,
          progress: current?.progress || 0,
          lastOpened: current?.lastOpened || null,
          coverURL: current?.coverURL || '',
        };

        nextLibrary = upsertEntry(nextLibrary, comic);

        if (!comic.coverURL && inspected.coverPage) {
          coverJobs.push({ comic, coverSource: inspected.coverPage });
        }
      } catch (error) {
        enqueueToast(error.message || 'Unable to import this comic archive.', 'error');
      }
    }

    await syncLibrary(nextLibrary);

    coverJobs.forEach(({ comic, coverSource }) => {
      void generateCoverThumbnail(comic, coverSource);
    });
  }, [enqueueToast, generateCoverThumbnail, syncLibrary]);

  useEffect(() => {
    ingestFilesRef.current = ingestFiles;
  }, [ingestFiles]);

  const openComic = useCallback(async (comic) => {
    if (pendingExtractionRef.current && pendingExtractionRef.current !== comic.filePath) {
      getComicAPI().cancelExtraction(pendingExtractionRef.current);
    }

    pendingExtractionRef.current = comic.filePath;
    readerState.dispatch({ type: SET_READER_LOADING, payload: true });

    try {
      const extracted = await getComicAPI().extractComic(comic.filePath);
      const settings = settingsRef.current;
      const startPage = settings.rememberReadingPosition
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
          fitMode: settings.defaultFitMode,
        },
      });

      patchComic({
        filePath: comic.filePath,
        title: extracted.title,
        pageCount: extracted.pageCount,
        lastOpened: new Date().toISOString(),
      });
      generateCoverThumbnail(hydratedComic, extracted.pages[0]);
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
  }, [enqueueToast, generateCoverThumbnail, patchComic, readerState.dispatch]);

  const closeComic = useCallback(async () => {
    if (progressRef.current.payload) {
      const { filePath, page } = progressRef.current.payload;
      await getComicAPI().saveProgress(filePath, page);
    }
    readerState.dispatch({ type: CLOSE_COMIC });
  }, [readerState.dispatch]);

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
      await getComicAPI().saveProgress(filePath, page);
      progressRef.current.payload = null;
    }, 500);
  }, [libraryState.dispatch]);

  const removeComic = useCallback(async (filePath) => {
    libraryState.dispatch({ type: REMOVE_COMIC, payload: filePath });
    libraryRef.current = libraryRef.current.filter((entry) => entry.filePath !== filePath);

    try {
      await getComicAPI().removeFromLibrary(filePath);
    } catch (error) {
      enqueueToast(error.message || 'Unable to remove this comic.', 'error');
    }
  }, [enqueueToast, libraryState.dispatch]);

  const setView = useCallback((view) => {
    readerState.dispatch({ type: SET_VIEW, payload: view });
  }, [readerState.dispatch]);

  const updateSettings = useCallback((patch) => {
    const nextSettings = {
      ...libraryState.settings,
      ...patch,
    };

    libraryState.dispatch({ type: UPDATE_SETTINGS, payload: patch });

    getComicAPI().saveSettings(nextSettings).catch((error) => {
      enqueueToast(error.message || 'Unable to save your settings.', 'error');
    });
  }, [enqueueToast, libraryState.dispatch, libraryState.settings]);

  useEffect(() => {
    let comicAPI;

    try {
      comicAPI = getComicAPI();
    } catch (error) {
      enqueueToastRef.current?.(error.message, 'error');
      return undefined;
    }

    if (bootedRef.current) {
      return undefined;
    }

    bootedRef.current = true;
    comicAPI.rendererReady();

    const unsubscribeBoot = comicAPI.onLibraryBoot((payload) => {
      if (payload.library) {
        libraryState.dispatch({ type: SET_LIBRARY, payload: payload.library });
        libraryRef.current = payload.library;
      }

      if (payload.version) {
        libraryState.dispatch({ type: SET_APP_VERSION, payload: payload.version });
      }

      if (payload.settings) {
        libraryState.dispatch({ type: UPDATE_SETTINGS, payload: payload.settings });
      }
    });

    const unsubscribeDrops = comicAPI.onFilesDropped((filePaths) => {
      ingestFilesRef.current?.(filePaths);
    });

    const unsubscribeFocus = comicAPI.onAppFocusChange((isFocused) => {
      if (!thumbnailWorkerRef.current) {
        return;
      }

      thumbnailWorkerRef.current.postMessage({
        type: isFocused ? 'resume' : 'pause',
      });
    });

    const unsubscribeLibraryChanges = comicAPI.onLibraryChanged((nextLibrary) => {
      libraryState.dispatch({ type: SET_LIBRARY, payload: nextLibrary });
      libraryRef.current = nextLibrary;
    });

    const unsubscribeSettingsChanges = comicAPI.onSettingsChanged((nextSettings) => {
      libraryState.dispatch({ type: UPDATE_SETTINGS, payload: nextSettings });
    });

    const unsubscribeUpdateStatus = comicAPI.onUpdateStatus((nextUpdateState) => {
      setUpdateState((current) => ({
        ...current,
        ...nextUpdateState,
      }));
    });

    comicAPI.getLibrary().then((library) => {
      libraryState.dispatch({ type: SET_LIBRARY, payload: library });
      libraryRef.current = library;
    });

    comicAPI.getSettings().then((settings) => {
      libraryState.dispatch({ type: UPDATE_SETTINGS, payload: settings });
    });

    comicAPI.getAppInfo().then((info) => {
      if (info?.version) {
        libraryState.dispatch({ type: SET_APP_VERSION, payload: info.version });
        setUpdateState((current) => ({
          ...current,
          currentVersion: info.version,
        }));
      }
    });

    return () => {
      unsubscribeBoot?.();
      unsubscribeDrops?.();
      unsubscribeFocus?.();
      unsubscribeLibraryChanges?.();
      unsubscribeSettingsChanges?.();
      unsubscribeUpdateStatus?.();
      window.clearTimeout(progressRef.current.timer);
      if (pendingExtractionRef.current) {
        comicAPI.cancelExtraction(pendingExtractionRef.current);
      }
      thumbnailWorkerRef.current?.terminate();
      thumbnailWorkerRef.current = null;
    };
  }, []);

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
          const inspected = await getComicAPI().inspectComic(comic.filePath);
          if (cancelled) {
            return;
          }
          await generateCoverThumbnail(comic, inspected.coverPage);
          await new Promise((resolve) => {
            window.setTimeout(resolve, 0);
          });
        } catch (error) {
          if (!cancelled) {
            enqueueToast(`Unable to refresh the cover for ${comic.title}.`, 'error');
          }
        }
      }
    };

    const timer = window.setTimeout(() => {
      hydrateMissingCovers();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enqueueToast, generateCoverThumbnail, libraryState.library]);

  const dismissToast = useCallback((toastId) => {
    libraryState.dispatch({ type: DISMISS_TOAST, payload: toastId });
  }, [libraryState.dispatch]);

  const pickFiles = useCallback(async () => {
    try {
      const filePaths = await getComicAPI().openFilePicker();
      if (filePaths?.length) {
        await ingestFiles(filePaths);
      }
    } catch (error) {
      enqueueToast(error.message || 'Unable to open the file picker.', 'error');
    }
  }, [enqueueToast, ingestFiles]);

  const toggleFullscreen = useCallback(async () => {
    try {
      return await getComicAPI().toggleFullscreen();
    } catch (error) {
      enqueueToast(error.message || 'Unable to toggle fullscreen.', 'error');
      return false;
    }
  }, [enqueueToast]);

  const checkForUpdates = useCallback(async () => {
    try {
      const nextState = await getComicAPI().checkForUpdates();
      if (nextState) {
        setUpdateState((current) => ({
          ...current,
          ...nextState,
        }));
      }
      return nextState;
    } catch (error) {
      enqueueToast(error.message || 'Unable to check for updates.', 'error');
      return null;
    }
  }, [enqueueToast]);

  const installUpdate = useCallback(async () => {
    try {
      return await getComicAPI().installUpdate();
    } catch (error) {
      enqueueToast(error.message || 'Unable to install the update.', 'error');
      return false;
    }
  }, [enqueueToast]);

  return {
    library: libraryState.library,
    settings: libraryState.settings,
    updateState,
    currentComic: readerState.currentComic,
    currentPage: readerState.currentPage,
    pickFiles,
    openComic,
    closeComic,
    queueProgressSave,
    removeComic,
    setView,
    updateSettings,
    syncLibrary,
    dismissToast,
    toggleFullscreen,
    checkForUpdates,
    installUpdate,
  };
}
