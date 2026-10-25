import { act, render, renderHook } from '@testing-library/react';
import CoverCard from '../src/components/CoverCard';
import { AppProvider, useReaderContext } from '../src/context/AppContext';
import { useDelayedValue } from '../src/hooks/useDelayedValue';
import { useLibrary } from '../src/hooks/useLibrary';

const extractions = new Map();
const api = {
  extractComic: vi.fn((filePath) => new Promise((resolve, reject) => extractions.set(filePath, { resolve, reject }))),
  cancelExtraction: vi.fn((filePath) => extractions.get(filePath)?.reject(new Error('Extraction cancelled'))),
  syncLibrary: vi.fn(() => Promise.resolve([])),
  inspectComic: vi.fn(() => Promise.reject(new Error('not needed'))),
  // Boot-time reads never settle so they cannot update state after a test ends.
  getLibrary: vi.fn(() => new Promise(() => {})),
  getSettings: vi.fn(() => new Promise(() => {})),
  getAppInfo: vi.fn(() => new Promise(() => {})),
  rendererReady: vi.fn(),
  onLibraryBoot: vi.fn(() => () => {}),
  onFilesDropped: vi.fn(() => () => {}),
  onAppFocusChange: vi.fn(() => () => {}),
  onSettingsChanged: vi.fn(() => () => {}),
  onUpdateStatus: vi.fn(() => () => {}),
};

vi.mock('../src/platform/desktopApi', () => ({ getDesktopApi: () => api }));

beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
});

function extracted(filePath) {
  return { pages: [`asset://${filePath}/1.jpg`], title: filePath, pageCount: 1 };
}

function renderLibraryHook() {
  return renderHook(() => ({ library: useLibrary(), reader: useReaderContext() }), { wrapper: AppProvider });
}

describe('useDelayedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits before showing a value and clears it immediately', () => {
    const { result, rerender } = renderHook(({ value }) => useDelayedValue(value, 150), { initialProps: { value: '' } });

    rerender({ value: 'a.cbz' });
    expect(result.current).toBe('');
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe('a.cbz');

    rerender({ value: '' });
    expect(result.current).toBe('');
  });

  it('never shows a value that was cleared before the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDelayedValue(value, 150), { initialProps: { value: '' } });

    rerender({ value: 'a.cbz' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: '' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('');
  });
});

describe('CoverCard opening state', () => {
  const comic = { filePath: '/a.cbz', title: 'A', coverURL: '', pageCount: 10, progress: 0 };

  it('shows an opening overlay and marks the card busy', () => {
    const { getByText, getByRole } = render(<CoverCard comic={comic} onOpen={vi.fn()} isOpening />);

    expect(getByText('Opening')).toBeInTheDocument();
    expect(getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('has no overlay otherwise', () => {
    const { queryByText } = render(<CoverCard comic={comic} onOpen={vi.fn()} />);

    expect(queryByText('Opening')).not.toBeInTheDocument();
  });
});

describe('openComic', () => {
  beforeEach(() => {
    extractions.clear();
    api.extractComic.mockClear();
    api.cancelExtraction.mockClear();
  });

  it('tracks which comic is opening and opens it when ready', async () => {
    const { result } = renderLibraryHook();

    act(() => { result.current.library.openComic({ filePath: '/a.cbz', progress: 0 }); });
    expect(result.current.reader.openingFilePath).toBe('/a.cbz');
    expect(result.current.reader.isLoading).toBe(true);

    await act(async () => { extractions.get('/a.cbz').resolve(extracted('/a.cbz')); });
    expect(result.current.reader.view).toBe('reader');
    expect(result.current.reader.currentComic.filePath).toBe('/a.cbz');
    expect(result.current.reader.openingFilePath).toBe('');
  });

  it('ignores repeat clicks on the comic that is already opening', () => {
    const { result } = renderLibraryHook();

    act(() => { result.current.library.openComic({ filePath: '/a.cbz', progress: 0 }); });
    act(() => { result.current.library.openComic({ filePath: '/a.cbz', progress: 0 }); });

    expect(api.extractComic).toHaveBeenCalledTimes(1);
    expect(api.cancelExtraction).not.toHaveBeenCalled();
  });

  it('switches to a newly picked comic and keeps showing it as opening', async () => {
    const { result } = renderLibraryHook();

    act(() => { result.current.library.openComic({ filePath: '/a.cbz', progress: 0 }); });
    await act(async () => { result.current.library.openComic({ filePath: '/b.cbz', progress: 0 }); });

    expect(api.cancelExtraction).toHaveBeenCalledWith('/a.cbz');
    expect(result.current.reader.openingFilePath).toBe('/b.cbz');
    expect(result.current.reader.isLoading).toBe(true);
  });

  it('does not open a comic that finished after another one was picked', async () => {
    api.cancelExtraction.mockImplementationOnce(() => {});
    const { result } = renderLibraryHook();

    act(() => { result.current.library.openComic({ filePath: '/a.cbz', progress: 0 }); });
    act(() => { result.current.library.openComic({ filePath: '/b.cbz', progress: 0 }); });
    await act(async () => { extractions.get('/a.cbz').resolve(extracted('/a.cbz')); });

    expect(result.current.reader.view).toBe('library');
    expect(result.current.reader.openingFilePath).toBe('/b.cbz');

    await act(async () => { extractions.get('/b.cbz').resolve(extracted('/b.cbz')); });
    expect(result.current.reader.currentComic.filePath).toBe('/b.cbz');
  });
});
