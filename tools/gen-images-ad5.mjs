// AFTER DARK V: five stills for the displacement gallery. Output: assets/img/ad5/*.png
// Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
// Usage: node tools/gen-images-ad5.mjs [name ...]   (no args = all)
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';

const OUT = new URL('../assets/img/ad5/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const out = (name) => fileURLToPath(new URL(`${name}.png`, OUT));
const SIZE = '1536x1024';
const STYLE = 'Cinematic film still, pure black background, dark moody night, ultra detailed, 35mm, cobalt blue and magenta light, no text, no letters, no watermark, no logo.';

const JOBS = {
  koi: 'A glowing koi fish made of neon light swimming through black water, trails of cobalt and magenta light.',
  moth: 'A giant moth with wings made of stained glass and fiber optics, lit from within, hovering in darkness.',
  city: 'A miniature glass city floating in a black void, tiny windows glowing, reflections underneath like water.',
  diver: 'A lone deep sea diver in an old brass helmet standing on a black seabed, surrounded by bioluminescent particles.',
  bloom: 'An enormous chrome flower slowly opening, petals reflecting neon light, dew drops like mercury.',
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
await Promise.all(names.map(async (name) => {
  if (!JOBS[name]) throw new Error(`unknown job ${name}`);
  const r = await generateImage({ prompt: `${STYLE} ${JOBS[name]}`, size: SIZE, quality: 'high', outPath: out(name) });
  console.log('ok', name, r.outPath);
}));
