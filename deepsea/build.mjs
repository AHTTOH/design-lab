// Builds deepsea/index.html from index.src.html by concatenating deepsea/src/*.js (file-name order)
// into the single inline module slot. file:// cannot load module files, so the page must be one file.
// DEEP SEA uses no image files: every surface, creature and texture is procedural, so there is no texture inlining step.
// Edit index.src.html or src/*.js, then run: node deepsea/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const JS_SLOT = '%%JS%%';

const parts = readdirSync(new URL('src/', here)).filter((f) => f.endsWith('.js')).sort();
if (!parts.length) throw new Error('no src/*.js fragments');
const js = parts.map((f) => `/* ── src/${f} ── */\n` + readFileSync(new URL(`src/${f}`, here), 'utf8')).join('\n');

const src = readFileSync(new URL('index.src.html', here), 'utf8');
if (!src.includes(JS_SLOT)) throw new Error(`index.src.html has no ${JS_SLOT} slot`);
const out = src.replace(JS_SLOT, () => js);
if (out.includes(JS_SLOT)) throw new Error('unreplaced placeholder');
writeFileSync(new URL('index.html', here), out);
console.log('index.html', (out.length / 1024).toFixed(0) + 'KB', 'from', parts.join(', '));
