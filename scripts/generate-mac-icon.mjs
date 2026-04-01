import fs from 'node:fs';
import path from 'node:path';
import png2icons from 'png2icons';

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, 'buildResources', 'icon.png');
const outputPath = path.join(rootDir, 'buildResources', 'icon.icns');

const input = fs.readFileSync(sourcePath);
const output = png2icons.createICNS(input, png2icons.BICUBIC, 0);

if (!output) {
  throw new Error(`Unable to generate macOS icon from ${sourcePath}`);
}

fs.writeFileSync(outputPath, output);
console.log(`Generated ${outputPath}`);
