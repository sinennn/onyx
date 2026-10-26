import { act, fireEvent, render, renderHook, within } from '@testing-library/react';
import Library from '../src/views/Library';
import { AppProvider, useLibraryContext } from '../src/context/AppContext';
import { useLibrary } from '../src/hooks/useLibrary';

const library = [
  { filePath: '/comics/Gideon_Falls_v01.cbr', title: 'Gideon Falls Book 01', pageCount: 393, progress: 19, lastOpened: '2026-10-20T00:00:00Z', coverURL: '' },
  { filePath: '/comics/Nameless.cbr', title: 'Nameless', pageCount: 193, progress: 192, lastOpened: '2026-10-21T00:00:00Z', coverURL: '' },
  { filePath: '/comics/Nice_House.cbz', title: 'The Nice House on the Lake', pageCount: 374, progress: 0, lastOpened: null, coverURL: '' },
];

const api = {
  openFolderPicker: vi.fn(),
  expandComicPaths: vi.fn(),
  inspectComic: vi.fn((filePath) => Promise.resolve({ title: filePath, pageCount: 10, coverPage: '' })),
  syncLibrary: vi.fn(() => Promise.resolve([])),
  getLibrary: vi.fn(() => new Promise(() => {})),
  getSettings: vi.fn(() => new Promise(() => {})),
  getAppInfo: vi.fn(() => new Promise(() => {})),
  rendererReady: vi.fn(),
  onLibraryBoot: vi.fn(() => () => {}),
  onFilesDropped: vi.fn(() => () => {}),
  onAppFocusChange: vi.fn(() => () => {}),
  onSettingsChanged: vi.fn(() => () => {}),
  onUpdateStatus: vi.fn(() => () => {}),
  onDragStateChange: vi.fn(() => () => {}),
};

vi.mock('../src/platform/desktopApi', () => ({ getDesktopApi: () => api }));

vi.mock('../src/context/AppContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useLibraryContext: (...args) => (globalThis.mockLibraryContext ? globalThis.mockLibraryContext : actual.useLibraryContext(...args)),
    useReaderContext: (...args) => (globalThis.mockLibraryContext ? { openingFilePath: '' } : actual.useReaderContext(...args)),
  };
});

beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
});

function renderLibrary(libraryApi = {}) {
  globalThis.mockLibraryContext = { library, settings: { librarySort: 'recent', showProgressBars: true } };
  const props = {
    openComic: vi.fn(),
    removeComic: vi.fn(),
    pickFiles: vi.fn(),
    updateSettings: vi.fn(),
    setComicProgress: vi.fn(),
    ...libraryApi,
  };
  const view = render(<Library libraryApi={props} />);
  const shelfTitles = () => view.container.querySelectorAll('.cover-grid .shelf-card');
  return { ...view, props, shelfTitles };
}

afterEach(() => {
  delete globalThis.mockLibraryContext;
});

describe('Library shelf', () => {
  it('filters the shelf as you search and shows how many match', () => {
    const { getByLabelText, getByText, shelfTitles } = renderLibrary();
    expect(shelfTitles()).toHaveLength(3);

    fireEvent.change(getByLabelText('Search library'), { target: { value: 'gideon' } });
    expect(shelfTitles()).toHaveLength(1);
    expect(getByText('1 of 3')).toBeInTheDocument();

    fireEvent.change(getByLabelText('Search library'), { target: { value: 'zzz' } });
    expect(getByText('No Matches')).toBeInTheDocument();
  });

  it('saves the chosen sort order', () => {
    const { getByLabelText, props } = renderLibrary();

    fireEvent.change(getByLabelText('Sort library'), { target: { value: 'title' } });
    expect(props.updateSettings).toHaveBeenCalledWith({ librarySort: 'title' });
  });

  it('keeps the comic you are reading in the banner rather than a finished one', () => {
    const { container } = renderLibrary();
    // Nameless was opened more recently but is finished, so Gideon Falls stays "Currently reading".
    expect(container.querySelector('section h3, section h2').textContent).toMatch(/gideon/i);
  });

  it('marks a comic as read or unread from the right-click menu', () => {
    const { shelfTitles, getByText, queryByText, props } = renderLibrary();
    const cards = [...shelfTitles()];
    const gideon = cards.find((card) => /gideon/i.test(card.textContent));
    const nameless = cards.find((card) => /nameless/i.test(card.textContent));

    fireEvent.contextMenu(gideon);
    expect(getByText('Mark as Unread')).toBeInTheDocument();
    fireEvent.click(getByText('Mark as Read'));
    expect(props.setComicProgress).toHaveBeenCalledWith('/comics/Gideon_Falls_v01.cbr', 392);

    fireEvent.contextMenu(nameless);
    expect(queryByText('Mark as Read')).not.toBeInTheDocument();
    fireEvent.click(getByText('Mark as Unread'));
    expect(props.setComicProgress).toHaveBeenCalledWith('/comics/Nameless.cbr', 0);
  });
});

describe('Folder import', () => {
  function renderLibraryHook() {
    return renderHook(() => ({ library: useLibrary(), state: useLibraryContext() }), { wrapper: AppProvider });
  }

  beforeEach(() => {
    api.inspectComic.mockClear();
  });

  it('imports the comics found inside a picked folder', async () => {
    api.openFolderPicker.mockResolvedValue(['/Users/me/Comics']);
    api.expandComicPaths.mockResolvedValue(['/Users/me/Comics/Issue 1.cbz', '/Users/me/Comics/Issue 2.cb7']);
    const { result } = renderLibraryHook();

    await act(async () => { await result.current.library.pickFolder(); });

    expect(api.expandComicPaths).toHaveBeenCalledWith(['/Users/me/Comics']);
    expect(api.inspectComic).toHaveBeenCalledWith('/Users/me/Comics/Issue 1.cbz');
  });

  it('says so when a folder has no comics', async () => {
    api.openFolderPicker.mockResolvedValue(['/Users/me/Empty']);
    api.expandComicPaths.mockResolvedValue([]);
    const { result } = renderLibraryHook();

    await act(async () => { await result.current.library.pickFolder(); });

    expect(api.inspectComic).not.toHaveBeenCalled();
    expect(result.current.state.toasts.at(-1).message).toMatch(/no cbz, cbr or cb7 comics/i);
  });
});
