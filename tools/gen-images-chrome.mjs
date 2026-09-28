// CHROME: stills for the Y2K chrome study. Output: assets/chrome/*.png (then converted to webp)
// Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
// Usage: node tools/gen-images-chrome.mjs [name ...]   (no args = all)
// Runs ONE AT A TIME (the proxy is shared). HTTP 429 -> wait 60s, retry up to 5 times.
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';

const OUT = new URL('../assets/chrome/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (name, ext) => fileURLToPath(new URL(`${name}.${ext}`, OUT));
const SIZE = '1536x1024';
const RETRY = { max: 5, waitMs: 60_000 };
const WEBP_QUALITY = '82';
const STYLE = 'Y2K retro-futurist studio render, bright airy pale sky blue and periwinkle gradient background, liquid silver chrome, iridescent holographic highlights, soft diffuse daylight, ultra detailed, no text, no letters, no watermark, no logo.';

const JOBS = {
  sky: 'Equirectangular 360 degree panorama of a bright clear daytime sky, soft white cumulus clouds near the horizon band, deep cerulean blue at the top fading to pale periwinkle and lilac near the horizon, subtle rainbow haze, no ground, no sun disc, no text, no letters, no watermark.',
  foil: 'Flat macro scan of holographic rainbow foil paper filling the whole frame, fine diffraction grating ripples, cyan, lilac, pink and pale gold bands, soft crinkles, evenly lit, no objects, no text, no letters, no watermark.',
  player: `${STYLE} A floating chrome Y2K portable MP3 player with a rounded pebble body and a jelly translucent periwinkle click wheel, mirror reflections of clouds, three quarter view, centered.`,
  star: `${STYLE} An inflated puffy chrome four pointed star, like a mylar balloon, rainbow iridescent sheen on the edges, floating, centered.`,
  butterfly: `${STYLE} A liquid chrome butterfly with wings made of mercury and holographic film, symmetrical, floating, centered.`,
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
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file(name, 'png'), '-q:v', WEBP_QUALITY, file(name, 'webp')]);
  unlinkSync(file(name, 'png'));
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
for (const name of names) {
  if (existsSync(file(name, 'webp'))) { console.log('skip', name); continue; }
  await runJob(name);
  toWebp(name);
  console.log('ok', name);
}
