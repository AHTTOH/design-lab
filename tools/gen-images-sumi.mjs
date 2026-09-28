// SUMI: stills for the ink-wash study. Output: assets/sumi/*.png (convert to webp afterwards).
// Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
// The proxy is shared with other agents, so jobs run one at a time and back off on HTTP 429.
// Usage: node tools/gen-images-sumi.mjs [name ...]   (no args = all)
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';

const OUT = new URL('../assets/sumi/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const out = (name) => fileURLToPath(new URL(`${name}.png`, OUT));
const SIZE = '1536x1024';
const RETRIES = 5;
const BACKOFF_MS = 60000;
const STYLE = 'Traditional East Asian ink wash painting on pure white paper (#FFFFFF, not cream, not ivory, not beige), black sumi ink with soft grey washes, high resolution scan, no text, no letters, no signature, no watermark, no border, no frame.';

const JOBS = {
  paper: 'Macro scan of blank white Korean hanji mulberry paper, pure neutral white, only extremely faint pale grey fibres and a few thin long fibres visible, perfectly even lighting, completely empty, no ink.',
  brush: 'A single bold horizontal dry-brush stroke of black ink across the middle of the white paper, thick at the start, splitting into dry bristle streaks and flying white at the end, strong texture of hair marks, lots of empty white paper around it.',
  seal: 'A single square red cinnabar seal stamp impression (Korean nakgwan) centered on white paper, carved relief pattern of abstract geometric lines inside a square border, uneven vermilion ink pressure, slightly worn edges, small in the frame with lots of white space, no other marks.',
  mountains: 'Layered misty mountain ranges in the style of a Korean sumukhwa landscape, jagged peaks fading into mist, darkest ink on the nearest ridge and pale grey washes on distant ranges, a few tiny pine trees on the ridges, large empty white sky, wide composition.',
  plum: 'A gnarled old plum tree branch entering from the left edge painted in dark dry-brush ink, thin twigs, a few blossoms painted in small red dots, lots of empty white space on the right.',
};

async function run(name) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const r = await generateImage({ prompt: `${STYLE} ${JOBS[name]}`, size: SIZE, quality: 'high', outPath: out(name) });
      console.log('ok', name, r.outPath);
      return;
    } catch (e) {
      const limited = /429/.test(String(e?.message ?? e));
      console.error(`fail ${name} attempt ${attempt}: ${e?.message ?? e}`);
      if (!limited || attempt === RETRIES) throw e;
      await sleep(BACKOFF_MS);
    }
  }
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
for (const name of names) {
  if (!JOBS[name]) throw new Error(`unknown job ${name}`);
  await run(name);
}
