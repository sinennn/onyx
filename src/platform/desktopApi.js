import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TAURI_COMMANDS, TAURI_EVENTS } from './tauriContract';

function toMediaUrl(path) {
  if (!path || path.startsWith('data:') || path.startsWith('http') || path.startsWith('asset:')) {
    return path;
  }

  return convertFileSrc(path);
}

function normalizeInspection(result) {
  return result ? { ...result, coverPage: toMediaUrl(result.coverPage) } : result;
}

function normalizeExtraction(result) {
  return result ? { ...result, pages: (result.pages || []).map(toMediaUrl) } : result;
}

// Wraps an async Tauri subscription in the synchronous unsubscribe contract the renderer expects.
function subscribe(register) {
  let active = true;
  let unlisten;

  register(() => active).then((cleanup) => {
    if (active) {
      unlisten = cleanup;
    } else {
      cleanup();
    }
  });

  return () => {
    active = false;
    unlisten?.();
  };
}

function listenTo(eventName, callback) {
  return subscribe((isActive) => listen(eventName, (event) => {
    if (isActive()) callback(event.payload);
  }));
}

function createTauriApi() {
  const currentWindow = getCurrentWindow();

  return {
    openFilePicker: () => invoke(TAURI_COMMANDS.openFilePicker),
    inspectComic: (filePath) => invoke(TAURI_COMMANDS.inspectComic, { filePath }).then(normalizeInspection),
    extractComic: (filePath) => invoke(TAURI_COMMANDS.extractComic, { filePath }).then(normalizeExtraction),
    cancelExtraction: (filePath) => { void invoke(TAURI_COMMANDS.cancelExtraction, { filePath }); },
    getLibrary: () => invoke(TAURI_COMMANDS.getLibrary),
    getSettings: () => invoke(TAURI_COMMANDS.getSettings),
    syncLibrary: (library) => invoke(TAURI_COMMANDS.syncLibrary, { nextLibrary: library }),
    saveSettings: (settings) => invoke(TAURI_COMMANDS.saveSettings, { nextSettings: settings }),
    saveProgress: (filePath, page) => invoke(TAURI_COMMANDS.saveProgress, { filePath, page }),
    removeFromLibrary: (filePath) => invoke(TAURI_COMMANDS.removeFromLibrary, { filePath }),
    toggleFullscreen: () => invoke(TAURI_COMMANDS.toggleFullscreen),
    getAppInfo: () => invoke(TAURI_COMMANDS.getAppInfo),
    checkForUpdates: () => invoke(TAURI_COMMANDS.checkForUpdates),
    installUpdate: () => invoke(TAURI_COMMANDS.installUpdate),
    rendererReady: () => {},
    onLibraryBoot: (callback) => {
      let active = true;
      invoke(TAURI_COMMANDS.getBootPayload).then((payload) => {
        if (active) callback(payload);
      });
      return () => { active = false; };
    },
    onFilesDropped: (callback) => {
      const unsubscribeDrop = subscribe((isActive) => currentWindow.onDragDropEvent(({ payload }) => {
        if (isActive() && payload.type === 'drop' && payload.paths?.length) callback(payload.paths);
      }));
      const unsubscribeOpened = listenTo(TAURI_EVENTS.filesDropped, callback);
      let active = true;
      invoke(TAURI_COMMANDS.getLaunchFiles).then((paths) => {
        if (active && paths?.length) callback(paths);
      });
      return () => {
        active = false;
        unsubscribeDrop();
        unsubscribeOpened();
      };
    },
    // Tauri handles file drops natively, so the webview never sees HTML5 dragenter/dragleave.
    onDragStateChange: (callback) => subscribe((isActive) => currentWindow.onDragDropEvent(({ payload }) => {
      if (isActive()) callback(payload.type === 'enter' || payload.type === 'over');
    })),
    onAppFocusChange: (callback) => subscribe((isActive) => currentWindow.onFocusChanged(({ payload }) => {
      if (isActive()) callback(payload);
    })),
    onLibraryChanged: (callback) => listenTo(TAURI_EVENTS.libraryChanged, callback),
    onSettingsChanged: (callback) => listenTo(TAURI_EVENTS.settingsChanged, callback),
    onUpdateStatus: (callback) => {
      const unsubscribe = listenTo(TAURI_EVENTS.updateStatus, callback);
      let active = true;
      invoke(TAURI_COMMANDS.getUpdateStatus).then((status) => {
        if (active && status) callback(status);
      });
      return () => {
        active = false;
        unsubscribe();
      };
    },
  };
}

let desktopApi = null;

export function getDesktopApi() {
  if (desktopApi) {
    return desktopApi;
  }

  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
    desktopApi = createTauriApi();
    return desktopApi;
  }

  throw new Error('Desktop bridge unavailable. Launch Onyx through Tauri to import comics.');
}
