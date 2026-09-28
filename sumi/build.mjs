// Inlines the images that WebGL samples and CSS masks read (both fail on file:// as cross-origin) and writes index.html.
// Edit index.src.html, then run: node sumi/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const ASSET_DIR = '../assets/sumi/';

const src = readFileSync(new URL('index.src.html', here), 'utf8');
const out = src.replace(/%%IMG:([a-z-]+)%%/g, (_, name) =>
  'data:image/webp;base64,' + readFileSync(new URL(`${ASSET_DIR}${name}.webp`, here)).toString('base64'));
if (out.includes('%%IMG:')) throw new Error('unreplaced placeholder');
writeFileSync(new URL('index.html', here), out);
console.log('index.html', (out.length / 1024).toFixed(0) + 'KB');
