// Builds marble/index.html from index.src.html by concatenating marble/src/*.js in file-name order
// into the single inline module (file:// cannot load module files). No images: everything is procedural.
// Edit index.src.html or src/*.js, then run: node marble/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const JS_SLOT = '%%JS%%';

const parts = readdirSync(new URL('src/', here)).filter((f) => f.endsWith('.js')).sort();
if (!parts.length) throw new Error('no src/*.js fragments');
const js = parts.map((f) => `/* ---- src/${f} ---- */\n` + readFileSync(new URL(`src/${f}`, here), 'utf8')).join('\n');

const src = readFileSync(new URL('index.src.html', here), 'utf8');
if (!src.includes(JS_SLOT)) throw new Error(`index.src.html has no ${JS_SLOT} slot`);
const out = src.replace(JS_SLOT, () => js);
if (out.includes(JS_SLOT)) throw new Error('unreplaced placeholder');
writeFileSync(new URL('index.html', here), out);
console.log('index.html', (out.length / 1024).toFixed(0) + 'KB', 'from', parts.join(', '));
