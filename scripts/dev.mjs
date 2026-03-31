#!/usr/bin/env node

import { watch } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import electronPath from 'electron';
import { createServer } from 'vite';

const rootDir = process.cwd();
const watchedFiles = ['main.js', 'preload.js']
  .map((file) => path.join(rootDir, file));

let viteServer;
let electronProcess = null;
let restartPending = false;
let shutdownRequested = false;
let restartTimer = null;
let forceKillTimer = null;
let watchers = [];

function clearTimers() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (forceKillTimer) {
    clearTimeout(forceKillTimer);
    forceKillTimer = null;
  }
}

async function shutdown(exitCode = 0) {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  clearTimers();

  watchers.forEach((currentWatcher) => currentWatcher.close());
  watchers = [];

  if (electronProcess) {
    electronProcess.kill('SIGTERM');
  }

  if (viteServer) {
    await viteServer.close();
  }

  process.exit(exitCode);
}

function startElectron(devServerURL) {
  electronProcess = spawn(String(electronPath), ['.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DEV: 'true',
      ONYX_DEV_SERVER_URL: devServerURL,
      FORCE_COLOR: '1',
    },
  });

  electronProcess.once('exit', async (code, signal) => {
    electronProcess = null;
    clearTimers();

    if (shutdownRequested) {
      return;
    }

    if (restartPending) {
      restartPending = false;
      startElectron(devServerURL);
      return;
    }

    if (signal === 'SIGTERM') {
      await shutdown(0);
      return;
    }

    await shutdown(code ?? 0);
  });
}

function scheduleRestart(reason) {
  if (shutdownRequested) {
    return;
  }

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    restartPending = true;
    console.log(`[dev] restarting Electron because ${reason}`);

    if (!electronProcess) {
      restartPending = false;
      return;
    }

    electronProcess.kill('SIGTERM');
    forceKillTimer = setTimeout(() => {
      if (electronProcess) {
        electronProcess.kill('SIGKILL');
      }
    }, 5000);
  }, 150);
}

async function start() {
  viteServer = await createServer({
    configFile: path.join(rootDir, 'vite.config.js'),
  });

  await viteServer.listen();

  const devServerURL = viteServer.resolvedUrls?.local?.[0] || 'http://127.0.0.1:5173/';
  console.log(`[dev] Vite ready at ${devServerURL}`);

  startElectron(devServerURL);

  watchers = watchedFiles.map((target) => watch(target, () => {
    scheduleRestart(path.relative(rootDir, target));
  }));
}

process.on('SIGINT', () => {
  shutdown(0);
});

process.on('SIGTERM', () => {
  shutdown(0);
});

start().catch(async (error) => {
  console.error('[dev] failed to start development environment');
  console.error(error);
  await shutdown(1);
});
