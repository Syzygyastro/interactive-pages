import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.resolve(__dirname, '..');
const dataDir = path.join(projectDir, 'data');

const files = fs.readdirSync(dataDir)
  .filter(name => name.endsWith('.json'))
  .sort();

const records = files.map(file => {
  const source = fs.readFileSync(path.join(dataDir, file), 'utf8');
  return JSON.parse(source);
});

const bundlePath = path.join(dataDir, 'bundle.js');
const manifestPath = path.join(dataDir, 'manifest.json');

const bundleSource = `window.GRID_DATA = ${JSON.stringify(records, null, 2)};\n`;
fs.writeFileSync(bundlePath, bundleSource);

const manifest = {
  generatedAt: new Date().toISOString(),
  files
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${files.length} countries to ${path.relative(projectDir, bundlePath)}`);
