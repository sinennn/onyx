import { useEffect } from 'react';

export function useKeyNav(handlers, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.target instanceof HTMLElement) {
        const tagName = event.target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'select' || event.target.isContentEditable) {
          return;
        }
      }

      if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        handlers.onFullscreen?.();
        return;
      }

      if (event.metaKey && event.key === '\\') {
        event.preventDefault();
        handlers.onToggleThumbnails?.();
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
        case 'Backspace':
          event.preventDefault();
          handlers.onPrevious?.();
          break;
        case 'ArrowRight':
        case ' ':
          event.preventDefault();
          handlers.onNext?.();
          break;
        case 'Escape':
          event.preventDefault();
          handlers.onBack?.();
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          handlers.onToggleFit?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, handlers]);
}
