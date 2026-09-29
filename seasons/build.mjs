// Joins js/*.js into one inline module (module scripts from file:// are blocked, inline ones are not) and writes index.html.
// Edit index.src.html, seasons.css or js/*.js, then run: node seasons/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
/* order matters: later files use names declared by earlier ones */
const ORDER = ['config', 'core', 'glsl', 'world', 'tree', 'foliage', 'weather', 'birds', 'seasons', 'camera', 'ui', 'main'];

const body = ORDER.map((name) => `/* ── js/${name}.js ── */\n${readFileSync(new URL(`js/${name}.js`, here), 'utf8')}`).join('\n');
const code = `import * as THREE from 'three';\n${body}`;
const src = readFileSync(new URL('index.src.html', here), 'utf8');
if (!src.includes('%%SCRIPTS%%')) throw new Error('index.src.html has no %%SCRIPTS%% placeholder');
const out = src.replace('%%SCRIPTS%%', () => code);
writeFileSync(new URL('index.html', here), out);
console.log('index.html', (out.length / 1024).toFixed(0) + 'KB');
