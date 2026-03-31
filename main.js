const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const fsPromises = require('fs/promises');
const crypto = require('crypto');
const path = require('path');
const { fileURLToPath, pathToFileURL } = require('url');
const JSZip = require('jszip');
const Store = require('electron-store');
const unrar = require('node-unrar-js');

const { createExtractorFromFile } = unrar;

const libraryStore = new Store({
  name: 'panel-library',
  defaults: {
    library: [],
  },
});

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif']);
const ARCHIVE_EXTENSIONS = new Set(['.cbz', '.cbr', '.zip', '.rar']);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

let mainWindow = null;
let isWindowFocused = true;

const libraryCache = sanitizeLibrary(libraryStore.get('library'));
const extractionCache = new Map();
const extractionControllers = new Map();
const extractionJobs = new Map();
const focusWaiters = new Set();
const pendingOpenFiles = [];

app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true');
app.commandLine.appendSwitch('disable-renderer-backgrounding', 'true');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function sanitizeLibrary(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && entry.filePath)
    .map((entry) => ({
      filePath: entry.filePath,
      title: entry.title || getTitleFromPath(entry.filePath),
      coverURL: entry.coverURL || '',
      progress: Number.isFinite(entry.progress) ? entry.progress : 0,
      pageCount: Number.isFinite(entry.pageCount) ? entry.pageCount : 0,
      lastOpened: entry.lastOpened || null,
    }));
}

function persistLibrary() {
  libraryStore.set('library', libraryCache);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('library:changed', libraryCache);
  }
}

function getTitleFromPath(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  return baseName.replace(/[_-]+/g, ' ').trim();
}

function isImageEntry(entryName) {
  return IMAGE_EXTENSIONS.has(path.extname(entryName).toLowerCase());
}

function isComicArchive(filePath) {
  return ARCHIVE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function getTempRoot() {
  return path.join(app.getPath('temp'), 'panel-cache');
}

async function ensureTempRoot() {
  await fsPromises.mkdir(getTempRoot(), { recursive: true });
}

async function removePath(targetPath) {
  if (!targetPath) {
    return;
  }

  await fsPromises.rm(targetPath, { recursive: true, force: true }).catch(() => {});
}

function stableTempDir(filePath) {
  const hash = crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12);
  const fileStem = path.basename(filePath, path.extname(filePath)).replace(/[^\w.-]+/g, '-').slice(0, 48);
  return path.join(getTempRoot(), `${fileStem}-${hash}`);
}

function toFileUrl(targetPath) {
  return pathToFileURL(targetPath).href;
}

function throwIfAborted(signal) {
  if (signal.aborted) {
    const error = new Error('Extraction cancelled');
    error.code = 'ABORT_ERR';
    throw error;
  }
}

async function waitIfBackgrounded(signal) {
  if (isWindowFocused) {
    return;
  }

  await new Promise((resolve, reject) => {
    const onAbort = () => {
      focusWaiters.delete(resume);
      reject(Object.assign(new Error('Extraction cancelled'), { code: 'ABORT_ERR' }));
    };

    const resume = () => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    };

    signal.addEventListener('abort', onAbort, { once: true });
    focusWaiters.add(resume);
  });
}

async function walkFiles(rootDir) {
  const results = [];
  const entries = await fsPromises.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFiles(fullPath));
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

async function extractCbz(filePath, targetDir, signal) {
  const fileBuffer = await fsPromises.readFile(filePath);
  throwIfAborted(signal);

  const archive = await JSZip.loadAsync(fileBuffer);
  const fileEntries = Object.values(archive.files)
    .filter((entry) => !entry.dir && isImageEntry(entry.name))
    .sort((left, right) => collator.compare(left.name, right.name));

  const pages = [];

  for (let index = 0; index < fileEntries.length; index += 1) {
    await waitIfBackgrounded(signal);
    throwIfAborted(signal);

    const entry = fileEntries[index];
    const rawBuffer = await entry.async('nodebuffer');
    throwIfAborted(signal);

    const outputName = `${String(index + 1).padStart(4, '0')}-${path.basename(entry.name).replace(/[^\w.-]+/g, '_')}`;
    const outputPath = path.join(targetDir, outputName);
    await fsPromises.writeFile(outputPath, rawBuffer);
    pages.push(toFileUrl(outputPath));
  }

  return pages;
}

function unwrapFileHeaders(listResult) {
  if (Array.isArray(listResult)) {
    const [state, payload] = listResult;
    if (!state || state.state !== 'SUCCESS') {
      throw new Error(state && state.msg ? state.msg : 'Unable to inspect CBR archive');
    }

    return Array.isArray(payload.fileHeaders) ? payload.fileHeaders : [];
  }

  if (listResult && listResult.fileHeaders) {
    return Array.from(listResult.fileHeaders);
  }

  return [];
}

async function extractCbr(filePath, targetDir, signal) {
  let extractor;

  try {
    extractor = await createExtractorFromFile({
      filepath: filePath,
      targetPath: targetDir,
    });
  } catch (error) {
    extractor = await createExtractorFromFile(filePath, targetDir);
  }

  const headers = unwrapFileHeaders(extractor.getFileList())
    .filter((header) => header && !header.flags?.directory && !(header.name || '').endsWith('/') && isImageEntry(header.name || ''))
    .sort((left, right) => collator.compare(left.name, right.name));

  for (const header of headers) {
    await waitIfBackgrounded(signal);
    throwIfAborted(signal);

    const extracted = typeof extractor.extract === 'function'
      ? extractor.extract({ files: [header.name] })
      : extractor.extractFiles([header.name]);

    if (extracted && extracted.files) {
      Array.from(extracted.files);
    } else if (Array.isArray(extracted) && extracted[1] && extracted[1].files) {
      extracted[1].files.forEach(() => {});
    }
  }

  throwIfAborted(signal);

  const files = (await walkFiles(targetDir))
    .filter((entry) => isImageEntry(entry))
    .sort((left, right) => collator.compare(path.basename(left), path.basename(right)));

  return files.map((entry) => toFileUrl(entry));
}

async function extractArchive(filePath, signal) {
  await ensureTempRoot();
  const targetDir = stableTempDir(filePath);
  await removePath(targetDir);
  await fsPromises.mkdir(targetDir, { recursive: true });

  const extension = path.extname(filePath).toLowerCase();
  const pages = extension === '.cbr' || extension === '.rar'
    ? await extractCbr(filePath, targetDir, signal)
    : await extractCbz(filePath, targetDir, signal);

  if (!pages.length) {
    throw new Error('No readable pages were found in this archive.');
  }

  const payload = {
    directory: targetDir,
    pages,
    title: getTitleFromPath(filePath),
    pageCount: pages.length,
  };

  extractionCache.set(filePath, payload);
  return payload;
}

function upsertLibraryEntry(filePath, payload) {
  const index = libraryCache.findIndex((entry) => entry.filePath === filePath);
  const current = index >= 0 ? libraryCache[index] : null;
  const nextEntry = {
    filePath,
    title: payload.title || (current && current.title) || getTitleFromPath(filePath),
    coverURL: Object.prototype.hasOwnProperty.call(payload, 'coverURL') ? payload.coverURL : (current && current.coverURL) || '',
    progress: Object.prototype.hasOwnProperty.call(payload, 'progress') ? payload.progress : (current && current.progress) || 0,
    pageCount: Object.prototype.hasOwnProperty.call(payload, 'pageCount') ? payload.pageCount : (current && current.pageCount) || 0,
    lastOpened: Object.prototype.hasOwnProperty.call(payload, 'lastOpened') ? payload.lastOpened : (current && current.lastOpened) || null,
  };

  if (index >= 0) {
    libraryCache.splice(index, 1, nextEntry);
  } else {
    libraryCache.push(nextEntry);
  }

  persistLibrary();
  return nextEntry;
}

async function handleComicExtraction(filePath) {
  if (!isComicArchive(filePath)) {
    throw new Error('Unsupported file type. Choose a CBZ or CBR archive.');
  }

  const cached = extractionCache.get(filePath);
  if (cached && cached.pages.every((page) => fs.existsSync(fileURLToPath(page)))) {
    return {
      pages: cached.pages,
      title: cached.title,
      pageCount: cached.pageCount,
    };
  }

  if (extractionJobs.has(filePath)) {
    return extractionJobs.get(filePath);
  }

  const controller = new AbortController();
  extractionControllers.set(filePath, controller);

  const job = extractArchive(filePath, controller.signal)
    .then((result) => {
      upsertLibraryEntry(filePath, {
        title: result.title,
        pageCount: result.pageCount,
      });

      return {
        pages: result.pages,
        title: result.title,
        pageCount: result.pageCount,
      };
    })
    .catch(async (error) => {
      const cachedResult = extractionCache.get(filePath);
      if (cachedResult && error.code === 'ABORT_ERR') {
        await removePath(cachedResult.directory);
        extractionCache.delete(filePath);
      }

      if (error.code === 'ABORT_ERR') {
        throw new Error('Extraction cancelled');
      }

      throw error;
    })
    .finally(() => {
      extractionControllers.delete(filePath);
      extractionJobs.delete(filePath);
    });

  extractionJobs.set(filePath, job);
  return job;
}

function flushOpenFiles(filePaths) {
  if (!filePaths || !filePaths.length) {
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('files:dropped', filePaths);
    return;
  }

  pendingOpenFiles.push(...filePaths);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#0d0d0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 16 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
      enableWebSQL: false,
      v8CacheOptions: 'bypassHeatCheck',
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('library:boot', {
      library: libraryCache,
      version: app.getVersion(),
    });
    mainWindow.webContents.send('app:focus-change', isWindowFocused);

    if (pendingOpenFiles.length) {
      mainWindow.webContents.send('files:dropped', pendingOpenFiles.splice(0));
    }
  });

  const isDev = !app.isPackaged || process.env.DEV === 'true';
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

ipcMain.handle('comic:open-file-picker', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Comic Archives', extensions: ['cbz', 'cbr', 'zip', 'rar'] },
    ],
  });

  if (!result.canceled && result.filePaths.length) {
    flushOpenFiles(result.filePaths);
  }
});

ipcMain.handle('comic:extract', async (_event, filePath) => {
  return handleComicExtraction(filePath);
});

ipcMain.handle('comic:get-library', async () => libraryCache);

ipcMain.handle('comic:sync-library', async (_event, nextLibrary) => {
  const clean = sanitizeLibrary(nextLibrary);
  libraryCache.splice(0, libraryCache.length, ...clean);
  persistLibrary();
  return libraryCache;
});

ipcMain.handle('comic:save-progress', async (_event, filePath, page) => {
  upsertLibraryEntry(filePath, {
    progress: page,
    lastOpened: new Date().toISOString(),
  });
});

ipcMain.handle('comic:remove-from-library', async (_event, filePath) => {
  const index = libraryCache.findIndex((entry) => entry.filePath === filePath);
  if (index >= 0) {
    libraryCache.splice(index, 1);
    persistLibrary();
  }

  const cached = extractionCache.get(filePath);
  if (cached) {
    await removePath(cached.directory);
    extractionCache.delete(filePath);
  }
});

ipcMain.handle('comic:toggle-fullscreen', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  const nextState = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(nextState);
  return nextState;
});

ipcMain.handle('comic:get-app-info', async () => ({
  version: app.getVersion(),
}));

ipcMain.on('comic:cancel-extraction', (_event, filePath) => {
  const controller = extractionControllers.get(filePath);
  if (controller) {
    controller.abort();
  }
});

ipcMain.on('comic:renderer-ready', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('library:boot', {
      library: libraryCache,
      version: app.getVersion(),
    });
  }
});

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }

  const filePaths = commandLine.filter((value) => isComicArchive(value));
  flushOpenFiles(filePaths);
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (isComicArchive(filePath)) {
    flushOpenFiles([filePath]);
  }
});

app.on('browser-window-blur', () => {
  isWindowFocused = false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:focus-change', false);
  }
});

app.on('browser-window-focus', () => {
  isWindowFocused = true;
  focusWaiters.forEach((resume) => resume());
  focusWaiters.clear();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:focus-change', true);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.whenReady().then(async () => {
  await ensureTempRoot();
  createMainWindow();
});

app.on('before-quit', async () => {
  await Promise.all(Array.from(extractionCache.values()).map((entry) => removePath(entry.directory)));
});
