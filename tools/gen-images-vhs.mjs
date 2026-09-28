// VHS: extra channel stills for the channel-surf scene. Output: assets/vhs/*.png (convert to webp afterwards).
// Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
// The proxy is shared with other agents, so jobs run one at a time and back off on HTTP 429.
// Usage: node tools/gen-images-vhs.mjs [name ...]   (no args = all)
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';

const OUT = new URL('../assets/vhs/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const out = (name) => fileURLToPath(new URL(`${name}.png`, OUT));
const SIZE = '1536x1024';
const RETRIES = 5;
const BACKOFF_MS = 60000;
const STYLE = 'Still frame from 1990s home video camcorder footage, VHS tape look, soft analog blur, slight colour bleed, saturated tape colours, deep blacks, no people, no faces, no text, no letters, no timestamp, no date stamp, no watermark, no logo, no border.';

const JOBS = {
  aquarium: 'A large public aquarium tank at night seen from a dark hallway, glowing electric blue water, silhouettes of fish and jellyfish drifting, green and cyan light rays, dark foreground.',
  bowling: 'An empty bowling alley at night, glossy wooden lanes lit by magenta and cyan neon strips, white pins far away at the end of the lanes, dark ceiling.',
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
