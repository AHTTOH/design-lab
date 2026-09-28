// POP-UP: printed art for the book boards. Output: assets/popup/*.png (then converted to webp)
// Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
// Usage: node tools/gen-images-popup.mjs [name ...]   (no args = all)
// Runs ONE AT A TIME (the proxy is shared). HTTP 429 -> wait 60s, retry up to 5 times.
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';

const OUT = new URL('../assets/popup/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (name, ext) => fileURLToPath(new URL(`${name}.${ext}`, OUT));
const SIZE = '1536x1024';
const RETRY = { max: 5, waitMs: 60_000 };
const WEBP_QUALITY = '82';
const WEBP_WIDTH = '1024';
const STYLE = 'Flat top-down scan of a printed children\'s book board, cut paper collage made of saturated coloured card stock, visible paper fibre grain, crisp scissor-cut edges with tiny soft drop shadows between layers, bold graphic shapes, no cream, no beige, no kraft brown, no text, no letters, no numbers, no watermark, no logo, fills the whole frame edge to edge.';

const JOBS = {
  cover: `${STYLE} Background solid tomato red card. Layered shapes: cobalt blue rolling hills at the bottom, emerald green pine tree silhouettes, a sunflower yellow sun, hot pink and deep teal clouds and confetti circles, playful and dense around the edges, calmer empty tomato area in the middle.`,
  back: `${STYLE} Background solid cobalt blue card. Scattered cut paper stars, crescent moons and small planets in sunflower yellow, hot pink, emerald green, tomato red and white, a deep teal wave band along the bottom edge, evenly spread pattern.`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runJob(name) {
  const prompt = JOBS[name];
  if (!prompt) throw new Error(`unknown job ${name}`);
  for (let attempt = 1; attempt <= RETRY.max; attempt++) {
    try {
      await generateImage({ prompt, size: SIZE, quality: 'high', outPath: file(name, 'png') });
      return;
    } catch (e) {
      const is429 = /\b429\b/.test(String(e.message));
      if (!is429 || attempt === RETRY.max) throw e;
      console.log(`429 on ${name}, attempt ${attempt}, waiting ${RETRY.waitMs / 1000}s`);
      await sleep(RETRY.waitMs);
    }
  }
}

function toWebp(name) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file(name, 'png'), '-vf', `scale=${WEBP_WIDTH}:-2`, '-q:v', WEBP_QUALITY, file(name, 'webp')]);
  unlinkSync(file(name, 'png'));
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
for (const name of names) {
  if (existsSync(file(name, 'webp'))) { console.log('skip', name); continue; }
  await runJob(name);
  toWebp(name);
  console.log('ok', name);
}
