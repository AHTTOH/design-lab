// Builds chrome/index.html from index.src.html:
//  1. concatenates chrome/src/*.js in file-name order into the single inline module (file:// cannot load module files),
//  2. inlines the textures WebGL samples as data URIs (file:// images taint the canvas).
// Edit index.src.html or src/*.js, then run: node chrome/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const IMAGE_DIR = '../assets/chrome/';
const JS_SLOT = '%%JS%%';
const IMG_SLOT = /%%IMG:([a-z0-9-]+)%%/g;

const parts = readdirSync(new URL('src/', here)).filter((f) => f.endsWith('.js')).sort();
if (!parts.length) throw new Error('no src/*.js fragments');
const js = parts.map((f) => `/* ── src/${f} ── */\n` + readFileSync(new URL(`src/${f}`, here), 'utf8')).join('\n');

const src = readFileSync(new URL('index.src.html', here), 'utf8');
if (!src.includes(JS_SLOT)) throw new Error(`index.src.html has no ${JS_SLOT} slot`);
const out = src.replace(JS_SLOT, () => js).replace(IMG_SLOT, (_, name) =>
  'data:image/webp;base64,' + readFileSync(new URL(`${IMAGE_DIR}${name}.webp`, here)).toString('base64'));
if (out.includes('%%IMG:') || out.includes(JS_SLOT)) throw new Error('unreplaced placeholder');
writeFileSync(new URL('index.html', here), out);
console.log('index.html', (out.length / 1024).toFixed(0) + 'KB', 'from', parts.join(', '));
