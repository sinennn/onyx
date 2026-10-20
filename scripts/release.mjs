#!/usr/bin/env node
// Builds a signed universal macOS bundle, writes the updater manifest (latest.json) and publishes a GitHub release.
// Usage: npm run release [-- --dry-run] [-- --notes "What changed"]

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const rootDir = process.cwd();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const notesIndex = args.indexOf('--notes');
const notes = notesIndex >= 0 ? args[notesIndex + 1] : '';

const { version } = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const tauriConfig = JSON.parse(readFileSync(path.join(rootDir, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const productName = tauriConfig.productName;
const [endpoint] = tauriConfig.plugins.updater.endpoints;
const [, owner, repo] = new URL(endpoint).pathname.split('/');
const tag = `v${version}`;
const target = 'universal-apple-darwin';

function run(command, commandArgs, options = {}) {
  console.log(`[release] ${command} ${commandArgs.join(' ')}`);
  return execFileSync(command, commandArgs, { stdio: 'inherit', cwd: rootDir, ...options });
}

function signingEnv() {
  if (process.env.TAURI_SIGNING_PRIVATE_KEY) {
    return {};
  }

  const keyPath = process.env.ONYX_SIGNING_KEY_PATH || path.join(homedir(), '.tauri', 'onyx.key');
  if (!existsSync(keyPath)) {
    throw new Error(`Updater signing key not found at ${keyPath}. Set TAURI_SIGNING_PRIVATE_KEY or ONYX_SIGNING_KEY_PATH.`);
  }

  return {
    TAURI_SIGNING_PRIVATE_KEY: readFileSync(keyPath, 'utf8'),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? '',
  };
}

const env = { ...process.env, ...signingEnv() };
run('npx', ['tauri', 'build', '--target', target, '--config', JSON.stringify({ bundle: { createUpdaterArtifacts: true } })], { env });

const bundleDir = path.join(rootDir, 'src-tauri', 'target', target, 'release', 'bundle');
const archive = path.join(bundleDir, 'macos', `${productName}.app.tar.gz`);
const dmg = path.join(bundleDir, 'dmg', `${productName}_${version}_universal.dmg`);
const signature = readFileSync(`${archive}.sig`, 'utf8').trim();
const archiveUrl = `https://github.com/${owner}/${repo}/releases/download/${tag}/${path.basename(archive)}`;

// One universal archive serves both architectures.
const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'darwin-aarch64': { signature, url: archiveUrl },
    'darwin-x86_64': { signature, url: archiveUrl },
  },
};
const manifestPath = path.join(bundleDir, 'latest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const assets = [dmg, archive, `${archive}.sig`, manifestPath];
assets.forEach((asset) => {
  if (!existsSync(asset)) {
    throw new Error(`Missing release asset: ${asset}`);
  }
});

if (dryRun) {
  console.log(`[release] dry run: ${tag} for ${owner}/${repo} is ready but was not published.`);
  assets.forEach((asset) => console.log(`  ${path.relative(rootDir, asset)}`));
} else {
  run('gh', ['release', 'create', tag, ...assets, '--repo', `${owner}/${repo}`, '--title', `${productName} ${version}`, '--notes', notes || `${productName} ${version}`]);
}
