// Drives the instafactory Flow pipeline (reuses its CDP + UI helpers) for design-lab videos.
// Works around two gaps found on 2026-09-28: the changelog modal and 720p completion detection.
// Usage: node flow-video.mjs download <outFile>
//        node flow-video.mjs gen <outFile> "<prompt>" "<filename keyword regex>"
import { readdirSync, statSync, copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const SHORTS = 'C:/Users/sh/instafactory/factories/shorts/src';
const imp = (p) => import(new URL(`file:///${SHORTS}/${p}`).href);
const { loadVideoConfig } = await imp('lib/config.mjs');
const { launchChrome, openPage } = await imp('music/cdp.mjs');
const { outputDir, stateFile } = await imp('video/paths.mjs');
const flow = await imp('video/flow.mjs');

const RESOLUTION = '720p';
const DURATION_SEC = 8;
const MAX_CREDITS = 20;
const GEN_TIMEOUT_MS = 15 * 60 * 1000;

const [mode, outFile, prompt] = process.argv.slice(2);
if (!mode || !outFile) throw new Error('usage: flow-video.mjs <download|gen> <outFile> [prompt]');

const videoCfg = loadVideoConfig();
const state = JSON.parse(readFileSync(stateFile(), 'utf8'));
const chrome = await launchChrome(videoCfg, { headless: false });
const page = await openPage(chrome.port, state.projectUrl);

// The changelog modal ("시작하기") appeared on 2026-09-28 and is not covered by dismissTransientDialogs.
const dismissAll = async () => {
  await flow.dismissTransientDialogs(page);
  await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').trim() === '시작하기'); if (b) b.click(); return true; })()`);
  await sleep(500);
};
// In-progress tiles show a percentage.
const hasProgress = () => page.evaluate(`[...document.querySelectorAll('*')].some(e => e.children.length === 0 && /^\\d{1,3}%$/.test((e.textContent||'').trim()))`);

async function download() {
  const dir = outputDir(videoCfg);
  await page.setDownloadDir(dir);
  const before = new Set(readdirSync(dir));
  await dismissAll();
  await flow.downloadLatest(page, `${RESOLUTION} 원본 크기`);
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    await sleep(1500);
    const files = readdirSync(dir);
    if (files.some((f) => f.endsWith('.crdownload'))) continue;
    const fresh = files.filter((f) => /\.mp4$/i.test(f) && !before.has(f));
    if (!fresh.length) continue;
    const newest = fresh.map((f) => ({ f, m: statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.m - a.m)[0].f;
    copyFileSync(path.join(dir, newest), outFile);
    console.log(`saved ${outFile} (from ${newest})`);
    return newest;
  }
  throw new Error('download did not appear');
}

async function generate() {
  if (!prompt) throw new Error('prompt required');
  await sleep(3000);
  await dismissAll();
  await flow.requireProjectReady(page, state.projectUrl);
  await flow.setPrompt(page, prompt);
  await dismissAll();
  await flow.openSettings(page);
  const model = videoCfg.models['omni-1.1-flash'];
  const { previewCredits } = await flow.configureVideoSettings(page, { model, resolution: RESOLUTION, durationSec: DURATION_SEC, count: 1, aspect: '16:9' });
  console.log(`credits ${previewCredits}`);
  if (previewCredits > MAX_CREDITS) throw new Error(`credits ${previewCredits} > ${MAX_CREDITS}`);
  await flow.closeSettings(page);
  await flow.startGenerate(page);
  console.log('started');
  // Flow names the download after the content, so the newest tile is ours once its file name matches.
  const expect = new RegExp(process.argv[5] ?? '.', 'i');
  const deadline = Date.now() + GEN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(30000);
    await dismissAll();
    if (await hasProgress()) continue;
    const name = await download();
    if (expect.test(name)) return;
    console.log(`latest is ${name}, still waiting`);
  }
  throw new Error('generation timed out');
}

try {
  if (mode === 'download') await download();
  else if (mode === 'gen') await generate();
  else throw new Error(`unknown mode ${mode}`);
} finally {
  await page.close();
}
