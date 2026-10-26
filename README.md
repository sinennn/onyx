# Onyx

Premium macOS comic reader built with Tauri, React, and Tailwind.

## Prerequisites

- Node.js 20+
- Rust (stable) via [rustup](https://rustup.rs) — make sure `~/.cargo/bin` is on your `PATH`
- Xcode Command Line Tools

## Development

```bash
npm install
npm run dev
```

`npm run dev` starts Vite on `127.0.0.1:5173` and launches the Tauri shell against it. Rust changes in `src-tauri/` trigger a rebuild and restart automatically.

## Tests

```bash
npm test          # renderer + desktop bridge (Vitest)
npm run test:rust # backend (cargo test)
```

## Builds

```bash
npm run build
```

This creates a local `.app` and `.dmg` in `src-tauri/target/release/bundle/` for the current architecture.

Intel-only DMG:

```bash
npm run build:mac:intel
```

Apple Silicon-only DMG:

```bash
npm run build:mac:apple
```

Universal (Intel + Apple Silicon) DMG:

```bash
npm run build:mac:all
```

Cross-arch builds need the matching Rust target, e.g. `rustup target add aarch64-apple-darwin x86_64-apple-darwin`.

## Layout

- `src/` — React renderer. All native access goes through `src/platform/desktopApi.js`.
- `src-tauri/` — Rust backend: archive extraction (CBZ via `zip`, CBR via `unrar`), library/settings persistence, window commands.
- `src/platform/tauriContract.js` — command and event names shared with the Rust side.

Library data is stored in `~/Library/Application Support/com.sinennn.onyx/onyx-library.json`. On first launch, an existing library from the Electron build (`~/Library/Application Support/Onyx/panel-library.json`) is imported automatically.

## OTA Releases

Onyx updates itself from GitHub Releases using [`tauri-plugin-updater`](https://v2.tauri.app/plugin/updater/). Packaged builds check for updates on launch, download them in the background, and install either from Settings or automatically on quit. Debug builds report that auto-updates are only available in packaged builds.

Ship an update with one command, from an up-to-date `main`:

```bash
make release                       # 1.0.0 -> 1.0.1
make release BUMP=minor            # 1.0.0 -> 1.1.0
make release NOTES="What changed"  # custom notes (default: generated from merged PRs)
```

It checks that you're on a clean `main` in sync with GitHub, bumps the version in `package.json`, commits and pushes that, then builds a universal (Intel + Apple Silicon) bundle, signs the update archive, writes `latest.json` and creates the `v<version>` GitHub release. Installed copies of Onyx pick it up on their next launch. If the build fails after the bump, fix the problem and run `make publish` to retry without bumping again. `make check` runs only the pre-flight checks, and `npm run release -- --dry-run` builds everything without publishing.

Requirements:

- `gh` logged in with push access to `sinennn/onyx`
- `rustup target add aarch64-apple-darwin x86_64-apple-darwin`
- The updater signing key at `~/.tauri/onyx.key` (or `TAURI_SIGNING_PRIVATE_KEY` / `ONYX_SIGNING_KEY_PATH`). Its public half is in `src-tauri/tauri.conf.json`. **Back the private key up somewhere safe**: if it is lost, installed copies of Onyx can no longer accept updates.

Optional, for builds that open without a Gatekeeper warning: `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific password) and `APPLE_TEAM_ID`, which `tauri build` picks up for code signing and notarization.
