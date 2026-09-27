import { fileURLToPath } from 'node:url';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';
// Output goes under design-lab/assets/. Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
const ASSETS = new URL('../assets/', import.meta.url);
const out = (name) => fileURLToPath(new URL(`${name}.png`, ASSETS));
const base = 'Editorial studio photograph, pure black background, dramatic rim lighting, ultra detailed, no text, no letters, no watermark. ';
const jobs = [
  ['chrome', 'A liquid chrome sculpture melting and twisting in mid air, iridescent blue and violet reflections.'],
  ['glass', 'A translucent glass human head profile filled with drifting stars and nebula, cobalt glow.'],
  ['orb', 'A floating obsidian sphere cracked open with molten electric blue light pouring out, smoke around it.'],
  ['bloom', 'A surreal black flower made of fiber optic strands glowing blue and pink at the tips, macro shot.'],
];
await Promise.all(jobs.map(([name, p]) => generateImage({ prompt: base + p, size: '1024x1536', quality: 'high', outPath: out(`img/${name}`) }).then(() => console.log('ok', name), (e) => console.log('fail', name, e.message))));
