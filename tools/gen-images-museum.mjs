// MUSEUM: six fictional paintings for the night museum walk. Output: assets/museum/*.webp
// Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
// Usage: node tools/gen-images-museum.mjs [name ...]   (no args = all)
// Runs ONE AT A TIME (the proxy is shared). HTTP 429 -> wait 60s, retry up to 5 times.
// Each PNG becomes a webp of at most MAX_KB (quality steps down until it fits), then the PNG is deleted.
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';

const OUT = new URL('../assets/museum/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const file = (name, ext) => fileURLToPath(new URL(`${name}.${ext}`, OUT));
const PORTRAIT = '1024x1536';
const LANDSCAPE = '1536x1024';
const RETRY = { max: 5, waitMs: 60_000 };
const MAX_KB = 250;
const QUALITY_STEPS = [82, 74, 66, 58, 50];
const CANVAS = 'Flat frontal archival scan of the painted canvas only, the artwork fills the entire frame edge to edge, no frame, no wall, no gallery, no border, visible paint texture, museum quality, no text, no letters, no signature, no watermark, no logo.';

const JOBS = {
  garden: { size: PORTRAIT, prompt: `${CANVAS} Abstract expressionist oil painting titled night garden: thick gestural impasto strokes of deep ultramarine, viridian and black, sudden scrapes of cadmium red and a few luminous white blossoms, energetic drips, layered palette knife marks.` },
  // 2026-09-28: the first wording ("Colour field painting: two ... rectangles") came back without an image five times in a row.
  // The second wording (soft blocks on crimson) failed five more times; a horizon of colour bands went through.
  field: { size: PORTRAIT, prompt: `${CANVAS} Minimalist colour field painting of a horizon at dusk reduced to three wide horizontal bands of soft colour: glowing cobalt blue on top, a thin warm magenta line in the middle, deep violet below, hazy feathered edges, thin stained washes on raw canvas.` },
  stairs: { size: LANDSCAPE, prompt: `${CANVAS} Surrealist oil painting of a moonlit sea at night with a white marble staircase rising out of the still water into a deep teal sky, a single open door floating above the horizon, long soft shadows, dreamlike and quiet, fine glazing technique.` },
  orbits: { size: PORTRAIT, prompt: `${CANVAS} Minimal geometric abstract painting: three precise circles and one thin diagonal line on a flat deep navy ground, colours signal red, lemon yellow and warm grey, hard edges, matte acrylic, balanced asymmetric composition.` },
  mountain: { size: LANDSCAPE, prompt: `${CANVAS} Korean contemporary ink and colour painting on hanji mulberry paper: layered misty mountain ridges in soft black sumi ink washes, a pale full moon, a few pine trees, bold accents of mineral blue and vermilion pigment, modern composition with generous empty space, subtle paper fibres.` },
  kettle: { size: PORTRAIT, prompt: `${CANVAS} Pop art painting of a single glossy red enamel kettle on a flat bright cyan background, bold black outlines, Ben-Day halftone dots in the shadows, flat saturated colours, screenprint texture, no people.` },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runJob(name) {
  const job = JOBS[name];
  if (!job) throw new Error(`unknown job ${name}`);
  for (let attempt = 1; attempt <= RETRY.max; attempt++) {
    try {
      await generateImage({ prompt: job.prompt, size: job.size, quality: 'high', outPath: file(name, 'png') });
      return;
    } catch (e) {
      // 429 and an empty image stream (seen 2026-09-28 on a busy proxy) are both transient.
      const retryable = /\b429\b|no image/.test(String(e.message));
      if (!retryable || attempt === RETRY.max) throw e;
      console.log(`${e.message} on ${name}, attempt ${attempt}, waiting ${RETRY.waitMs / 1000}s`);
      await sleep(RETRY.waitMs);
    }
  }
}

function toWebp(name) {
  for (const q of QUALITY_STEPS) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file(name, 'png'), '-q:v', String(q), file(name, 'webp')]);
    const kb = statSync(file(name, 'webp')).size / 1024;
    if (kb <= MAX_KB) { unlinkSync(file(name, 'png')); return kb; }
  }
  throw new Error(`${name}.webp stays above ${MAX_KB}KB at quality ${QUALITY_STEPS.at(-1)}`);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
for (const name of names) {
  if (existsSync(file(name, 'webp'))) { console.log('skip', name); continue; }
  await runJob(name);
  const kb = toWebp(name);
  console.log('ok', name, kb.toFixed(0) + 'KB');
}
