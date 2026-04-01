module.exports = {
  appId: 'com.sinennn.onyx',
  productName: 'Onyx',
  directories: {
    output: 'release',
    buildResources: 'buildResources',
  },
  files: [
    'dist/**/*',
    'main.js',
    'preload.js',
    'package.json',
  ],
  mac: {
    category: 'public.app-category.entertainment',
    icon: 'buildResources/icon.icns',
    target: ['dmg', 'zip'],
  },
  publish: {
    provider: 'github',
    owner: 'sinennn',
    repo: 'onyx',
    releaseType: 'release',
  },
};
