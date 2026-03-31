const { contextBridge, ipcRenderer } = require('electron');

const fileDropSubscribers = new Set();
const bootSubscribers = new Set();
const focusSubscribers = new Set();
const librarySubscribers = new Set();
const settingsSubscribers = new Set();

let dropListenersBound = false;

function notify(set, value) {
  set.forEach((callback) => {
    callback(value);
  });
}

function bindFileDropListeners() {
  if (dropListenersBound) {
    return;
  }

  dropListenersBound = true;

  window.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  window.addEventListener('drop', (event) => {
    event.preventDefault();
    const filePaths = Array.from(event.dataTransfer?.files || [])
      .map((file) => file.path)
      .filter(Boolean);

    if (filePaths.length) {
      notify(fileDropSubscribers, filePaths);
    }
  });
}

function serializeError(error) {
  if (!error) {
    return {
      message: 'Unknown error',
      stack: '',
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack || '',
    };
  }

  return {
    message: typeof error === 'string' ? error : JSON.stringify(error),
    stack: '',
  };
}

window.addEventListener('DOMContentLoaded', () => {
  bindFileDropListeners();
});

window.addEventListener('error', (event) => {
  const details = serializeError(event.error || event.message);
  ipcRenderer.send('dev:renderer-error', {
    kind: 'error',
    message: details.message,
    stack: details.stack,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const details = serializeError(event.reason);
  ipcRenderer.send('dev:renderer-error', {
    kind: 'unhandledrejection',
    message: details.message,
    stack: details.stack,
  });
});

ipcRenderer.on('files:dropped', (_event, filePaths) => {
  notify(fileDropSubscribers, filePaths);
});

ipcRenderer.on('library:boot', (_event, payload) => {
  notify(bootSubscribers, payload);
});

ipcRenderer.on('app:focus-change', (_event, isFocused) => {
  notify(focusSubscribers, isFocused);
});

ipcRenderer.on('library:changed', (_event, library) => {
  notify(librarySubscribers, library);
});

ipcRenderer.on('settings:changed', (_event, settings) => {
  notify(settingsSubscribers, settings);
});

contextBridge.exposeInMainWorld('comicAPI', {
  openFilePicker: () => ipcRenderer.invoke('comic:open-file-picker'),
  inspectComic: (filePath) => ipcRenderer.invoke('comic:inspect', filePath),
  extractComic: (filePath) => ipcRenderer.invoke('comic:extract', filePath),
  cancelExtraction: (filePath) => ipcRenderer.send('comic:cancel-extraction', filePath),
  getLibrary: () => ipcRenderer.invoke('comic:get-library'),
  getSettings: () => ipcRenderer.invoke('comic:get-settings'),
  syncLibrary: (library) => ipcRenderer.invoke('comic:sync-library', library),
  saveSettings: (settings) => ipcRenderer.invoke('comic:save-settings', settings),
  saveProgress: (filePath, page) => ipcRenderer.invoke('comic:save-progress', filePath, page),
  removeFromLibrary: (filePath) => ipcRenderer.invoke('comic:remove-from-library', filePath),
  toggleFullscreen: () => ipcRenderer.invoke('comic:toggle-fullscreen'),
  getAppInfo: () => ipcRenderer.invoke('comic:get-app-info'),
  rendererReady: () => ipcRenderer.send('comic:renderer-ready'),
  onFilesDropped: (callback) => {
    fileDropSubscribers.add(callback);
    return () => {
      fileDropSubscribers.delete(callback);
    };
  },
  onLibraryBoot: (callback) => {
    bootSubscribers.add(callback);
    return () => {
      bootSubscribers.delete(callback);
    };
  },
  onAppFocusChange: (callback) => {
    focusSubscribers.add(callback);
    return () => {
      focusSubscribers.delete(callback);
    };
  },
  onLibraryChanged: (callback) => {
    librarySubscribers.add(callback);
    return () => {
      librarySubscribers.delete(callback);
    };
  },
  onSettingsChanged: (callback) => {
    settingsSubscribers.add(callback);
    return () => {
      settingsSubscribers.delete(callback);
    };
  },
});
