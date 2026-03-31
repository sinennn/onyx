const { contextBridge, ipcRenderer } = require('electron');

const fileDropSubscribers = new Set();
const bootSubscribers = new Set();
const focusSubscribers = new Set();

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

window.addEventListener('DOMContentLoaded', () => {
  bindFileDropListeners();
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

contextBridge.exposeInMainWorld('comicAPI', {
  openFilePicker: () => ipcRenderer.invoke('comic:open-file-picker'),
  extractComic: (filePath) => ipcRenderer.invoke('comic:extract', filePath),
  cancelExtraction: (filePath) => ipcRenderer.send('comic:cancel-extraction', filePath),
  getLibrary: () => ipcRenderer.invoke('comic:get-library'),
  syncLibrary: (library) => ipcRenderer.invoke('comic:sync-library', library),
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
});
