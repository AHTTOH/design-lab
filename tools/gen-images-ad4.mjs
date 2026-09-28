// AFTER DARK IV: assembled car, then an exploded view generated from it so both frames share car, angle and light.
// Output: assets/img/ad4/*.png. Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
// Usage: node tools/gen-images-ad4.mjs [assembled|exploded|all]
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';

const OUT = new URL('../assets/img/ad4/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const out = (name) => fileURLToPath(new URL(`${name}.png`, OUT));
const SIZE = '1536x1024';

const STYLE = 'Studio product render, pure black background, three-quarter front view from slightly above, car centered with generous empty space around it, dramatic cobalt blue and magenta rim lighting, glossy reflections, ultra detailed, photorealistic, no text, no logo, no badge, no watermark, no people.';
const CAR = 'A fictional sleek futuristic hypercar with no brand, low wide body, smooth liquid chrome and black carbon surfaces, thin light bar headlights.';

const JOBS = {
  assembled: () => generateImage({
    prompt: `${STYLE} ${CAR} The car is fully assembled and complete.`,
    size: SIZE, quality: 'high', outPath: out('assembled'),
  }),
  exploded: () => generateImage({
    prompt: `Using the reference image, show the exact same car, same camera angle, same lighting and same black background, as a technical exploded view. Every part floats apart in mid air along clean axes: body panels, doors, hood, wheels, tires, brake discs, suspension, seats, engine and battery modules, chassis frame, all separated with even gaps and perfectly aligned, still centered. ${STYLE}`,
    refImagePaths: [fileURLToPath(new URL('assembled.png', OUT))],
    size: SIZE, quality: 'high', outPath: out('exploded'),
  }),
};

const which = process.argv[2] ?? 'all';
const order = which === 'all' ? ['assembled', 'exploded'] : [which];
for (const name of order) {
  if (!JOBS[name]) throw new Error(`unknown job ${name}`);
  const r = await JOBS[name]();
  console.log('ok', name, r.outPath);
}
