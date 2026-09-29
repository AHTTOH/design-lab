// CLAY: stop-motion keyframes for the scroll-driven claymation short.
// Output: assets/clay/ref.webp (character reference) and assets/clay/s<scene>/<nn>.webp
// Needs the ChatGPT OAuth proxy: npx openai-oauth --port 10531
// Usage: node tools/gen-images-clay.mjs [s1 s2 ...]   (no args = reference + all scenes)
// Resumable: frames whose .webp already exists are skipped. Delete a .webp to regenerate that frame.
// Runs ONE AT A TIME (the proxy is shared). 429 or empty response -> wait 60s, retry up to 5 times.
// Consistency: every frame gets refImagePaths = [character reference, previous frame].
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateImage } from 'file:///C:/Users/sh/.claude/reference/codex-oauth-image/codex-image.mjs';

const OUT = new URL('../assets/clay/', import.meta.url);
const SIZE = '1536x1024';
const RETRY = { max: 5, waitMs: 60_000 };
const WEBP = { width: '1280', quality: '70' };
// The image engine sometimes ignores `size` and returns a square. Frames must be landscape for the player.
const MIN_ASPECT = 1.35;
const FRAME = 'Wide landscape 3:2 film frame, horizontal composition, 1536x1024.';

const STYLE = 'Handmade plasticine claymation, visible fingerprints and tool marks on clay, miniature set, soft studio lighting, shallow depth of field, saturated playful colours, bold clay colours, no cream, no beige, no text, no letters, no numbers, no logo, no watermark.';
const HERO = 'Pip, a small round plasticine creature (not a human, not an animal from any existing franchise): an egg-shaped body of vivid tangerine orange clay, two big round white clay eyes with glossy black pupils, small rosy pink cheek dots, a tiny curved smile line, two short stubby arms, two short stubby feet, a single little teal clay sprout with two leaves on top of its head.';
const KEEP = 'Keep Pip exactly the same character as in the reference images: same body shape, same tangerine orange colour, same eyes, same teal sprout, same size relative to the set. Pip is always fully visible inside the frame, never cropped.';
const CONT = 'This is the next frame of a stop-motion animation: keep the same set, same props, same lighting and the same camera angle and framing as the previous frame (second reference image), only change what is described.';
const OPEN = 'This is the first frame of a new stop-motion shot on a new miniature set. Match the clay style of the reference images.';

const REF = { name: 'ref', prompt: `${STYLE} Character reference photo: ${HERO} Pip stands facing the camera in a neutral happy pose, full body, centred, on a plain seamless sky blue backdrop with a teal clay floor. Studio product shot.` };

// Each scene: set description (kept in every frame prompt) + camera + per-frame action.
const SCENES = {
  s1: {
    set: 'Set: a tiny clay bedroom with teal walls, a coral pink bed with a sunflower yellow blanket, a round window with morning sun, a cobalt blue rug, a small green alarm clock on a violet nightstand.',
    cam: 'Camera: wide shot from the front at bed height, locked off.',
    frames: [
      'Pip is asleep in the bed under the yellow blanket, eyes closed, only head and sprout showing, the sprout drooping.',
      'Pip opens one eye sleepily, a warm sun ray from the window falls on its face, sprout still drooping.',
      'Pip sits up in bed, both stubby arms stretched high above its head in a big yawn, mouth open wide, sprout standing up.',
      'Pip hops out of bed, one foot touching the blue rug, blanket pushed aside.',
      'Pip stands on the blue rug in the middle of the room, arms out wide, bright awake eyes, big smile.',
      'Pip walks toward the open coral door on the right side of the room, mid-step, looking back over its shoulder at the camera.',
      'Pip stands in the open doorway on the right, bright daylight pouring in, one arm raised in a small wave.',
    ],
  },
  s2: {
    set: 'Set: a clay town street seen from the side, a row of small clay houses in coral, sunflower yellow, violet and mint green with round windows, a sky blue sky with puffy white clay clouds, a cobblestone sidewalk made of little clay pebbles, a teal lamp post, a green hedge.',
    cam: 'Camera: side view at sidewalk height, locked off, the street runs left to right.',
    frames: [
      'Pip steps out of the coral house door on the far left onto the sidewalk.',
      'Pip walks to the right, mid-stride, left foot forward, at the left third of the frame.',
      'Pip walks to the right, mid-stride, right foot forward, a little further right, passing the teal lamp post.',
      'Pip walks near the centre, waving at a small cobalt blue clay bird sitting on the green hedge.',
      'Pip walks past a tiny fruit stand with clay oranges and lemons, right of centre.',
      'Pip stops right of centre and looks up and to the right in surprise, eyes wide, sprout straight up.',
      'Pip runs toward the right side of the frame, both arms swinging, still fully inside the frame.',
    ],
  },
  s3: {
    set: 'Set: a small clay town square with a violet clay tree with round leaves, a mint green bench, a sky blue sky, a sunflower yellow fountain in the background, coral paving tiles.',
    cam: 'Camera: medium wide shot from the front, locked off.',
    frames: [
      'A single glossy red clay balloon on a white string is caught in the branches of the violet tree. Pip enters from the left side of the frame.',
      'Pip stands under the tree looking up at the red balloon, head tilted, curious.',
      'Pip jumps up with both arms stretched toward the balloon string, feet off the ground.',
      'Pip holds the balloon string in both hands, standing, beaming with a big smile, the balloon now free above it.',
      'The balloon pulls upward and Pip stands on tiptoe, string taut, surprised face.',
      'Pip is lifted a little off the ground, feet dangling above the coral tiles, holding the string, the balloon above.',
      'Pip floats higher, at the height of the bench top, legs kicking happily, the balloon above, the ground lower in the frame.',
    ],
  },
  s4: {
    set: 'Set: a clay sky above a miniature clay town, rooftops in coral, violet and yellow far below, a bright sky blue backdrop, fluffy white and pale pink clay clouds on wires.',
    cam: 'Camera: follows Pip, Pip stays near the centre of the frame while the scenery changes around it.',
    frames: [
      'Pip floats holding the red balloon string with both hands, clay rooftops and chimneys just below at the bottom of the frame.',
      'Pip floats higher, the rooftops are now small and far below, a few clouds around.',
      'Pip still holds the red balloon string tightly with both hands, the red balloon above it, and floats among fluffy white clay clouds, a small cobalt blue clay bird flies beside it.',
      'Pip waves one arm at the cobalt bird while holding the string with the other hand, happy.',
      'Pip floats above the clouds, a big round sunflower yellow clay sun in the upper corner, deep sky blue.',
      'Pip floats above the clouds, the sky starts to turn violet, dark grey-violet storm clouds appear at the side, Pip looks toward them worried.',
      'Dark violet storm clouds fill half the frame, wind bends the balloon string, Pip holds on tight with both hands.',
    ],
  },
  s5: {
    set: 'Set: a stormy clay sky with dark violet and indigo clouds, clear blue clay raindrops on wires, and later a clay garden below with giant flowers.',
    cam: 'Camera: follows Pip, Pip stays near the centre of the frame.',
    frames: [
      'Pip clings to the red balloon string in a storm, dark violet clouds, clay raindrops slanting, wind pushing everything sideways.',
      'A zigzag sunflower yellow clay lightning bolt flashes behind Pip, Pip scared with eyes squeezed shut, the balloon swinging sideways.',
      'The balloon is half deflated and wrinkled, Pip drifts downward, the storm clouds above, a green clay garden with giant flowers visible far below.',
      'Pip drifts down slowly holding the wrinkled balloon, giant coral and magenta clay flowers and big green leaves just below its feet, the rain thinning.',
      'Pip lands softly on a big green clay leaf in the garden, knees bent, the limp balloon beside it, last raindrops.',
      'Pip sits on the leaf in the garden looking up, dazed but okay, the clouds parting, a bright clay rainbow arcing in a clearing sky blue sky.',
      'Pip stands on the leaf smiling, holding the small limp red balloon, rainbow behind, giant flowers around.',
    ],
  },
  s6: {
    set: 'Set: a round clay hill covered in green clay grass and small clay flowers, a sunset sky of coral, magenta and violet bands, a big half-set orange-pink clay sun on the horizon, a few violet clay clouds.',
    cam: 'Camera: wide shot from the front, locked off.',
    frames: [
      'Pip walks up the hill carrying the small red balloon, now reinflated and tied to a flower stem, the sun on the horizon.',
      'Pip sits on top of the hill with its back three-quarters to the camera, watching the sunset, the red balloon tied to a flower beside it.',
      'Pip turns its head toward the camera while still sitting, eyes soft and happy.',
      'Pip stands and faces the camera, one arm raised starting to wave.',
      'Pip waves a big goodbye at the camera with one arm high, eyes closed in a happy smile.',
      'Pip waves goodbye with both arms high, the sun lower, sky deeper magenta and violet.',
      'Pip waves one last time, smaller glow, the sun almost set, first tiny clay stars appearing in the violet sky.',
    ],
  },
};

const file = (rel, ext) => fileURLToPath(new URL(`${rel}.${ext}`, OUT));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');

function aspectOf(p) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p]).toString().trim();
  const [w, h] = out.split(',').map(Number);
  return w / h;
}

async function generate(rel, prompt, refs, needsLandscape) {
  mkdirSync(new URL(`${rel}/..`, OUT), { recursive: true });
  for (let attempt = 1; attempt <= RETRY.max; attempt++) {
    try {
      const t = Date.now();
      await generateImage({ prompt, size: SIZE, quality: 'high', outPath: file(rel, 'png'), refImagePaths: refs });
      const a = aspectOf(file(rel, 'png'));
      if (needsLandscape && a < MIN_ASPECT) {
        unlinkSync(file(rel, 'png'));
        if (attempt === RETRY.max) throw new Error(`${rel}: engine kept returning aspect ${a.toFixed(2)}, need ${MIN_ASPECT}+`);
        console.log(`reject ${rel} attempt ${attempt}: aspect ${a.toFixed(2)}`);
        continue;
      }
      console.log(`ok ${rel} (${Math.round((Date.now() - t) / 1000)}s)`);
      return;
    } catch (e) {
      const msg = String(e.message);
      const retryable = /\b429\b/.test(msg) || /no image/i.test(msg) || /fetch failed|ECONNRESET|terminated/i.test(msg);
      if (!retryable || attempt === RETRY.max) throw e;
      console.log(`retry ${rel} attempt ${attempt}: ${msg.slice(0, 120)} (waiting ${RETRY.waitMs / 1000}s)`);
      await sleep(RETRY.waitMs);
    }
  }
}

function toWebp(rel) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file(rel, 'png'), '-vf', `scale=${WEBP.width}:-2`, '-c:v', 'libwebp', '-quality', WEBP.quality, file(rel, 'webp')]);
  unlinkSync(file(rel, 'png'));
}

async function job(rel, prompt, refs, needsLandscape = true) {
  if (existsSync(file(rel, 'webp'))) { console.log('skip', rel); return; }
  await generate(rel, prompt, refs, needsLandscape);
  toWebp(rel);
}

const wanted = process.argv.slice(2);
const sceneIds = wanted.length ? wanted : Object.keys(SCENES);
await job(REF.name, REF.prompt, [], false);
const refPath = file(REF.name, 'webp');

for (const id of sceneIds) {
  const sc = SCENES[id];
  if (!sc) throw new Error(`unknown scene ${id}`);
  for (let i = 0; i < sc.frames.length; i++) {
    const rel = `${id}/${pad(i + 1)}`;
    const prev = i === 0 ? null : file(`${id}/${pad(i)}`, 'webp');
    const lead = i === 0 ? OPEN : CONT;
    const prompt = `${FRAME} ${STYLE} ${lead} ${HERO} ${KEEP} ${sc.set} ${sc.cam} Action: ${sc.frames[i]}`;
    await job(rel, prompt, prev ? [refPath, prev] : [refPath]);
  }
}
console.log('done');
