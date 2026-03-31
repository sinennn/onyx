module.exports = {
  appId: 'com.openai.comicreader',
  productName: 'Panel',
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
};
