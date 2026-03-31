#!/usr/bin/env node

import {build, createServer} from 'vite';
import electronPath from 'electron';
import {spawn} from 'child_process';

const mode = (process.env.MODE = process.env.MODE || 'development');
const logLevel = 'warn';

function setupMainPackageWatcher({resolvedUrls}) {
  process.env.VITE_DEV_SERVER_URL = resolvedUrls.local[0];

  let electronApp = null;

  return build({
    mode,
    logLevel,
    configFile: 'packages/main/vite.config.js',
    build: {
      watch: {},
    },
    plugins: [
      {
        name: 'reload-app-on-main-package-change',
        writeBundle() {
          if (electronApp !== null) {
            electronApp.removeListener('exit', process.exit);
            electronApp.kill('SIGINT');
            electronApp = null;
          }

          electronApp = spawn(String(electronPath), ['.'], {
            stdio: 'inherit',
          });

          electronApp.addListener('exit', process.exit);
        },
      },
    ],
  });
}

function setupPreloadPackageWatcher({ws}) {
  return build({
    mode,
    logLevel,
    configFile: 'packages/preload/vite.config.js',
    build: {
      watch: {},
    },
    plugins: [
      {
        name: 'reload-page-on-preload-package-change',
        writeBundle() {
          ws.send({
            type: 'full-reload',
          });
        },
      },
    ],
  });
}

const rendererWatchServer = await createServer({
  mode,
  logLevel,
  configFile: 'packages/renderer/vite.config.js',
}).then(s => s.listen());

await setupPreloadPackageWatcher(rendererWatchServer);
await setupMainPackageWatcher(rendererWatchServer);
