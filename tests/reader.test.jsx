import { act, fireEvent, render } from '@testing-library/react';
import { useEffect } from 'react';
import Reader from '../src/views/Reader';
import { AppProvider, useLibraryContext, useReaderContext } from '../src/context/AppContext';
import { OPEN_COMIC, UPDATE_SETTINGS } from '../src/context/actions';

const pages = Array.from({ length: 10 }, (_, index) => `asset://comic/${String(index + 1).padStart(4, '0')}.jpg`);

beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

function Harness({ settings, startPage, libraryApi }) {
  const reader = useReaderContext();
  const library = useLibraryContext();

  useEffect(() => {
    library.dispatch({ type: UPDATE_SETTINGS, payload: settings });
    reader.dispatch({
      type: OPEN_COMIC,
      payload: { comic: { filePath: '/a.cbz', title: 'A', pages, pageCount: pages.length }, startPage },
    });
  }, []);

  return (
    <>
      <Reader libraryApi={libraryApi} />
      <output data-testid="page">{reader.currentPage}</output>
    </>
  );
}

function renderReader(settings, startPage = 0) {
  const libraryApi = {
    queueProgressSave: vi.fn(),
    closeComic: vi.fn(),
    toggleFullscreen: vi.fn(),
    updateSettings: vi.fn(),
  };
  const view = render(<AppProvider><Harness settings={settings} startPage={startPage} libraryApi={libraryApi} /></AppProvider>);
  const page = () => Number(view.getByTestId('page').textContent);
  const shown = () => [...view.container.querySelectorAll('img[alt^="Page "]')].map((image) => image.alt);
  const press = (key) => act(() => { fireEvent.keyDown(window, { key }); });
  return { ...view, libraryApi, page, shown, press };
}

describe('spread layout', () => {
  it('opens on the spread containing the saved page and steps two pages at a time', () => {
    const { page, shown, press, getAllByText } = renderReader({ readingLayout: 'spread', readingDirection: 'ltr' }, 4);

    expect(page()).toBe(3);
    expect(shown()).toEqual(['Page 4', 'Page 5']);
    expect(getAllByText('4–5 / 10').length).toBeGreaterThan(0);

    press('ArrowRight');
    expect(shown()).toEqual(['Page 6', 'Page 7']);
    press(' ');
    expect(page()).toBe(7);
    press('Backspace');
    expect(page()).toBe(5);
    press('ArrowLeft');
    expect(page()).toBe(3);
  });

  it('shows the cover on its own', () => {
    const { shown, press } = renderReader({ readingLayout: 'spread', readingDirection: 'ltr' }, 0);

    expect(shown()).toEqual(['Page 1']);
    press('ArrowRight');
    expect(shown()).toEqual(['Page 2', 'Page 3']);
  });

  it('swaps the arrow keys and mirrors the spread in manga mode', () => {
    const { page, press, container } = renderReader({ readingLayout: 'spread', readingDirection: 'rtl' }, 3);

    expect(container.querySelector('.flex-row-reverse')).not.toBeNull();
    press('ArrowLeft');
    expect(page()).toBe(5);
    press('ArrowRight');
    expect(page()).toBe(3);
    press(' ');
    expect(page()).toBe(5);
  });
});

describe('single page layout', () => {
  it('moves one page at a time and saves progress as you go', () => {
    const { page, shown, press, libraryApi } = renderReader({ readingLayout: 'single', readingDirection: 'ltr' }, 2);

    expect(shown()).toEqual(['Page 3']);
    press('ArrowRight');
    expect(page()).toBe(3);
    expect(libraryApi.queueProgressSave).toHaveBeenLastCalledWith('/a.cbz', 3, 10);
  });
});

describe('layout switching', () => {
  it('cycles the layout with the L key', () => {
    const { press, libraryApi } = renderReader({ readingLayout: 'single', readingDirection: 'ltr' }, 0);

    press('l');
    expect(libraryApi.updateSettings).toHaveBeenCalledWith({ readingLayout: 'spread' });
  });

  it('keeps the scroll layout as before', () => {
    const { container, press, libraryApi } = renderReader({ readingLayout: 'scroll', readingDirection: 'rtl' }, 0);

    expect(container.querySelectorAll('article[data-page-index]')).toHaveLength(10);
    press('l');
    expect(libraryApi.updateSettings).toHaveBeenCalledWith({ readingLayout: 'single' });
  });
});

describe('rendering', () => {
  // Regression: the Reader used to re-render forever while a comic was open, because dispatch
  // changed identity on every state change and no-op updates still produced new state.
  it('settles after opening a comic, even when libraryApi is a new object every render', async () => {
    let renders = 0;
    function Probe() { renders += 1; return null; }
    function Unstable() {
      const reader = useReaderContext();
      useEffect(() => {
        reader.dispatch({ type: OPEN_COMIC, payload: { comic: { filePath: '/a.cbz', title: 'A', pages, pageCount: pages.length }, startPage: 0 } });
      }, []);
      const libraryApi = { queueProgressSave() {}, closeComic() {}, toggleFullscreen() {}, updateSettings() {} };
      return <><Reader libraryApi={libraryApi} /><Probe /></>;
    }

    render(<AppProvider><Unstable /></AppProvider>);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
    expect(renders).toBeLessThan(10);
  });
});
