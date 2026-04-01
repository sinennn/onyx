# Onyx

Premium macOS comic reader built with Electron, React, and Tailwind.

## Development

```bash
npm install
npm run dev
```

## Builds

```bash
npm run build
```

This creates a local packaged build without publishing an update.

Intel-only DMG:

```bash
npm run build:mac:intel
```

Apple Silicon-only DMG:

```bash
npm run build:mac:apple
```

Both macOS DMGs in one go:

```bash
npm run build:mac:all
```


(BTW, i haven't implemented this fully yet)
## OTA Releases

Onyx is configured for non-App-Store updates through GitHub Releases using `electron-builder` and `electron-updater`.

Publish a release with:

```bash
npm run release
```

Required environment variables for publishing:

```bash
GH_TOKEN=your_github_token
```

Required environment variables for signed macOS builds:

```bash
CSC_LINK=base64_or_file_url_to_your_developer_id_certificate
CSC_KEY_PASSWORD=your_certificate_password
APPLE_ID=your_apple_id
APPLE_APP_SPECIFIC_PASSWORD=your_app_specific_password
APPLE_TEAM_ID=your_apple_team_id
```

Electron Builder handles the GitHub release metadata used by the in-app updater. The app checks for updates automatically in packaged builds, and you can also check manually from Settings.
