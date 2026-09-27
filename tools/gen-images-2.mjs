import { fileURLToPath } from 'node:url';
import { generateImage, isCodexProxyAlive } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';
// Output goes under design-lab/assets/. Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
const ASSETS = new URL('../assets/', import.meta.url);
const out = (name) => fileURLToPath(new URL(`${name}.png`, ASSETS));
console.log('alive', await isCodexProxyAlive?.());
const cine = 'Cinematic film still, pure black background, dark moody, ultra detailed, 35mm, no text, no letters, no watermark, no logo. ';
const jobs = [
  ['video/v1', '1536x1024', 'Thick volumetric smoke and fog drifting slowly through total darkness, faint cobalt blue and violet rim light catching the edges of the smoke, deep black negative space.'],
  ['video/v2', '1536x1024', 'A cosmic nebula slowly swirling in deep space, violet and magenta gas clouds with cobalt blue filaments, scattered bright stars, deep black space.'],
  ['video/v3', '1536x1024', 'An endless ocean of liquid chrome with rolling mirror-like waves at night, reflections of cobalt and magenta light on the metallic surface, black sky.'],
  ['img/eclipse', '1024x1536', 'A total solar eclipse corona glowing violet and lime green around a perfect black disc, thin light filaments, pure black sky.'],
  ['img/jelly', '1024x1536', 'A bioluminescent jellyfish floating in black water, glowing magenta and cobalt tentacles, delicate translucent bell.'],
  ['img/mask', '1024x1536', 'A front-facing sculpted human face made of polished black obsidian with thin glowing cobalt cracks, eyes closed, serene, centered, pure black background.'],
];
await Promise.all(jobs.map(([name, size, p]) => generateImage({ prompt: cine + p, size, quality: 'high', outPath: out(name) }).then(() => console.log('ok', name), (e) => console.log('fail', name, e.message))));
