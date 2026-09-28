// Inlines the gallery stills that WebGL samples (file:// images taint canvases) and writes index.html.
// Edit index.src.html, then run: node after-dark-5/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const IMAGE_DIR = '../assets/img/ad5/';
const PLACEHOLDER = /%%IMG:([a-z0-9-]+)%%/g;

const src = readFileSync(new URL('index.src.html', here), 'utf8');
const out = src.replace(PLACEHOLDER, (_, name) =>
  'data:image/webp;base64,' + readFileSync(new URL(`${IMAGE_DIR}${name}.webp`, here)).toString('base64'));
if (out.includes('%%IMG:')) throw new Error('unreplaced placeholder');
writeFileSync(new URL('index.html', here), out);
console.log('index.html', (out.length / 1024).toFixed(0) + 'KB');
