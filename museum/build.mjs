// Builds museum/index.html from index.src.html:
//  1. concatenates museum/src/*.js in file-name order into the single inline module (file:// cannot load module files),
//  2. inlines the textures WebGL samples as data URIs (file:// images taint the canvas), downscaled with ffmpeg
//     to TEX_LONG_SIDE on the long side so the page stays near 1MB.
// Slot syntax: %%IMG:<folder under assets>/<name>%% -> assets/<folder>/<name>.webp
// Edit index.src.html or src/*.js, then run: node museum/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url);
const ASSETS = new URL('../assets/', here);
const JS_SLOT = '%%JS%%';
const IMG_SLOT = /%%IMG:([a-z0-9-]+\/[a-z0-9-]+)%%/g;
const TEX_LONG_SIDE = 1024;
const TEX_QUALITY = '74';

const parts = readdirSync(new URL('src/', here)).filter((f) => f.endsWith('.js')).sort();
if (!parts.length) throw new Error('no src/*.js fragments');
const js = parts.map((f) => `/* ── src/${f} ── */\n` + readFileSync(new URL(`src/${f}`, here), 'utf8')).join('\n');

const cache = new Map();
function texture(path) {
  if (cache.has(path)) return cache.get(path);
  const input = fileURLToPath(new URL(`${path}.webp`, ASSETS));
  const scale = `scale='if(gt(iw,ih),min(${TEX_LONG_SIDE},iw),-2)':'if(gt(iw,ih),-2,min(${TEX_LONG_SIDE},ih))'`;
  const buf = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', input, '-vf', scale, '-c:v', 'libwebp', '-quality', TEX_QUALITY, '-f', 'webp', 'pipe:1'],
    { maxBuffer: 64 * 1024 * 1024 });
  if (!buf.length) throw new Error(`ffmpeg produced nothing for ${input}`);
  const uri = 'data:image/webp;base64,' + buf.toString('base64');
  cache.set(path, uri);
  console.log('texture', path, (buf.length / 1024).toFixed(0) + 'KB');
  return uri;
}

const src = readFileSync(new URL('index.src.html', here), 'utf8');
if (!src.includes(JS_SLOT)) throw new Error(`index.src.html has no ${JS_SLOT} slot`);
const out = src.replace(JS_SLOT, () => js).replace(IMG_SLOT, (_, path) => texture(path));
if (out.includes('%%IMG:') || out.includes(JS_SLOT)) throw new Error('unreplaced placeholder');
writeFileSync(new URL('index.html', here), out);
console.log('index.html', (out.length / 1024).toFixed(0) + 'KB', 'from', parts.join(', '));
