import { useCallback, useEffect, useRef } from 'react';

const IDLE_TIMEOUT = 5 * 60 * 1000;

function createPageWorker() {
  return new Worker(new URL('../workers/pageWorker.js', import.meta.url), { type: 'module' });
}

export function usePageBuffer({ pages, currentPage, imgRef }) {
  const bufferRef = useRef(new Map());
  const inflightRef = useRef(new Map());
  const promiseRef = useRef(new Map());
  const workerRef = useRef(null);
  const messageIdRef = useRef(0);
  const radiusRef = useRef(2);
  const currentSrcRef = useRef('');
  const idleTimerRef = useRef(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current;
    }

    const worker = createPageWorker();
    worker.onmessage = (event) => {
      const { id, buffer, mimeType, error } = event.data;
      const handlers = promiseRef.current.get(id);
      if (!handlers) {
        return;
      }

      promiseRef.current.delete(id);

      if (error) {
        handlers.reject(new Error(error));
        return;
      }

      handlers.resolve({ buffer, mimeType });
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const releasePage = useCallback((index) => {
    const current = bufferRef.current.get(index);
    if (current) {
      URL.revokeObjectURL(current);
      bufferRef.current.delete(index);
    }
  }, []);

  const releaseAll = useCallback(() => {
    bufferRef.current.forEach((value) => URL.revokeObjectURL(value));
    bufferRef.current.clear();
    inflightRef.current.clear();
    currentSrcRef.current = '';
    if (imgRef.current) {
      imgRef.current.removeAttribute('src');
      imgRef.current.classList.remove('reader-image-ready');
      imgRef.current.classList.add('reader-image-enter');
    }
  }, [imgRef]);

  const swapImage = useCallback((nextUrl) => {
    if (!imgRef.current || !nextUrl || currentSrcRef.current === nextUrl) {
      return;
    }

    const image = imgRef.current;
    image.style.willChange = 'opacity, transform';
    image.classList.remove('reader-image-ready');
    image.classList.add('reader-image-enter');

    requestAnimationFrame(() => {
      image.src = nextUrl;
      image.onload = () => {
        image.classList.remove('reader-image-enter');
        image.classList.add('reader-image-ready');
        image.style.willChange = 'auto';
      };
      currentSrcRef.current = nextUrl;
    });
  }, [imgRef]);

  const processBlob = useCallback(async (blob, sourceUrl) => {
    const worker = ensureWorker();
    const id = messageIdRef.current + 1;
    messageIdRef.current = id;

    const buffer = await blob.arrayBuffer();
    const extension = sourceUrl.split('.').pop()?.toLowerCase() || '';
    const mimeType = blob.type || (extension === 'jpg' ? 'image/jpeg' : `image/${extension}`);

    const result = await new Promise((resolve, reject) => {
      promiseRef.current.set(id, { resolve, reject });
      worker.postMessage({
        type: 'process-page',
        id,
        buffer,
        mimeType,
      }, [buffer]);
    });

    return new Blob([result.buffer], { type: result.mimeType });
  }, [ensureWorker]);

  const loadPage = useCallback(async (index) => {
    if (index < 0 || index >= pages.length) {
      return '';
    }

    if (bufferRef.current.has(index)) {
      return bufferRef.current.get(index);
    }

    if (inflightRef.current.has(index)) {
      return inflightRef.current.get(index);
    }

    const task = (async () => {
      const response = await fetch(pages[index]);
      const originalBlob = await response.blob();
      const processedBlob = await processBlob(originalBlob, pages[index]);
      const objectUrl = URL.createObjectURL(processedBlob);
      bufferRef.current.set(index, objectUrl);

      if (index === currentPage) {
        swapImage(objectUrl);
      }

      inflightRef.current.delete(index);
      return objectUrl;
    })().catch((error) => {
      inflightRef.current.delete(index);
      throw error;
    });

    inflightRef.current.set(index, task);
    return task;
  }, [currentPage, pages, processBlob, swapImage]);

  const syncBuffer = useCallback(() => {
    if (!pages.length) {
      releaseAll();
      return;
    }

    const radius = radiusRef.current;
    const needed = new Set();

    for (let index = Math.max(0, currentPage - radius); index <= Math.min(pages.length - 1, currentPage + radius); index += 1) {
      needed.add(index);
      loadPage(index);
    }

    Array.from(bufferRef.current.keys()).forEach((index) => {
      if (!needed.has(index)) {
        releasePage(index);
      }
    });

    const currentUrl = bufferRef.current.get(currentPage);
    if (currentUrl) {
      swapImage(currentUrl);
    }
  }, [currentPage, loadPage, pages.length, releaseAll, releasePage, swapImage]);

  useEffect(() => {
    syncBuffer();
  }, [pages, currentPage, syncBuffer]);

  useEffect(() => releaseAll, [releaseAll]);

  useEffect(() => {
    const resetIdleTimer = () => {
      if (radiusRef.current === 1) {
        radiusRef.current = 2;
        syncBuffer();
      }

      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        radiusRef.current = 1;
        syncBuffer();
      }, IDLE_TIMEOUT);
    };

    resetIdleTimer();
    const passive = { passive: true };
    window.addEventListener('keydown', resetIdleTimer, passive);
    window.addEventListener('click', resetIdleTimer, passive);
    window.addEventListener('mousemove', resetIdleTimer, passive);

    return () => {
      window.clearTimeout(idleTimerRef.current);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      window.removeEventListener('mousemove', resetIdleTimer);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [syncBuffer]);
}
