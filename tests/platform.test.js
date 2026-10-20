import { TAURI_COMMANDS, TAURI_EVENTS } from '../src/platform/tauriContract';

const invoke = vi.fn();
const listen = vi.fn(() => Promise.resolve(() => {}));
const onDragDropEvent = vi.fn(() => Promise.resolve(() => {}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args) => invoke(...args),
  convertFileSrc: (path) => `asset://localhost/${encodeURIComponent(path)}`,
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: (...args) => listen(...args) }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: (...args) => onDragDropEvent(...args),
    onFocusChanged: () => Promise.resolve(() => {}),
  }),
}));

async function loadApi() {
  vi.resetModules();
  const { getDesktopApi } = await import('../src/platform/desktopApi');
  return getDesktopApi;
}

describe('Tauri contract', () => {
  it('keeps command and event names aligned with the Rust boundary', () => {
    expect(TAURI_COMMANDS.inspectComic).toBe('inspect_comic');
    expect(TAURI_COMMANDS.extractComic).toBe('extract_comic');
    expect(TAURI_COMMANDS.getBootPayload).toBe('get_boot_payload');
    expect(TAURI_COMMANDS.getUpdateStatus).toBe('get_update_status');
    expect(TAURI_EVENTS.filesDropped).toBe('files_dropped');
    expect(TAURI_EVENTS.libraryChanged).toBe('library_changed');
  });
});

describe('desktop API', () => {
  afterEach(() => {
    delete window.__TAURI_INTERNALS__;
    invoke.mockReset();
  });

  it('fails clearly when not running inside Tauri', async () => {
    const getDesktopApi = await loadApi();

    expect(() => getDesktopApi()).toThrow('Launch Onyx through Tauri');
  });

  it('sends camelCase arguments, which Tauri maps to snake_case Rust parameters', async () => {
    window.__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValue({ pages: ['/tmp/onyx-cache/a/0001-p.jpg'], coverPage: '/tmp/c.jpg' });
    const api = (await loadApi())();

    await api.extractComic('/comics/a.cbz');
    await api.inspectComic('/comics/a.cbz');
    await api.syncLibrary([]);
    await api.saveSettings({ theme: 'onyx' });
    await api.saveProgress('/comics/a.cbz', 3);

    expect(invoke).toHaveBeenCalledWith('extract_comic', { filePath: '/comics/a.cbz' });
    expect(invoke).toHaveBeenCalledWith('sync_library', { nextLibrary: [] });
    expect(invoke).toHaveBeenCalledWith('save_settings', { nextSettings: { theme: 'onyx' } });
    expect(invoke).toHaveBeenCalledWith('save_progress', { filePath: '/comics/a.cbz', page: 3 });
  });

  it('turns extracted file paths into asset URLs', async () => {
    window.__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValue({ pages: ['/tmp/p1.jpg'], title: 'A', pageCount: 1 });
    const api = (await loadApi())();

    const result = await api.extractComic('/comics/a.cbz');

    expect(result.pages[0]).toBe(`asset://localhost/${encodeURIComponent('/tmp/p1.jpg')}`);
  });

  it('reads the current update status on subscribe instead of starting a second check', async () => {
    window.__TAURI_INTERNALS__ = {};
    const status = { state: 'downloading', progress: 42 };
    invoke.mockResolvedValue(status);
    const api = (await loadApi())();
    const callback = vi.fn();

    api.onUpdateStatus(callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(status));

    expect(invoke).toHaveBeenCalledWith('get_update_status');
    expect(invoke).not.toHaveBeenCalledWith('check_for_updates');
    expect(listen).toHaveBeenCalledWith('update_status', expect.any(Function));
  });

  it('exposes everything useLibrary calls', async () => {
    window.__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValue(null);
    const api = (await loadApi())();

    [
      'rendererReady', 'onLibraryBoot', 'onFilesDropped', 'onAppFocusChange', 'onLibraryChanged',
      'onSettingsChanged', 'onUpdateStatus', 'onDragStateChange', 'getLibrary', 'getSettings', 'getAppInfo',
      'openFilePicker', 'cancelExtraction', 'removeFromLibrary', 'toggleFullscreen', 'checkForUpdates', 'installUpdate',
    ].forEach((method) => expect(typeof api[method]).toBe('function'));
  });
});
