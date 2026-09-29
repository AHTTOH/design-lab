// Opens every page at desktop, mobile and reduced-motion, then prints console errors, 4xx/5xx responses and horizontal overflow.
// Usage: npm i && node tools/check-pages.mjs [baseUrl]
//   baseUrl defaults to the published site. For local work: python -m http.server 4190, then pass http://127.0.0.1:4190/
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://ahttoh.github.io/design-lab/';
const PAGES = ['', 'stardust/', 'after-dark-1/', 'after-dark-2/', 'after-dark-3/', 'after-dark-4/', 'after-dark-5/', 'chrome/', 'sumi/', 'toytown/', 'vhs/', '8bit/', 'popup/', 'museum/', 'deepsea/', 'marble/', 'seasons/', 'clay/'];
const CONDITIONS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' },
  { name: 'mobile', viewport: { width: 375, height: 812 }, reducedMotion: 'no-preference' },
  { name: 'reduced', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
];
const SCROLL_PX = 4000;
const SETTLE_MS = 1500;

const browser = await chromium.launch();
let failures = 0;
for (const cond of CONDITIONS) {
  const context = await browser.newContext({ viewport: cond.viewport, reducedMotion: cond.reducedMotion });
  for (const path of PAGES) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.mouse.wheel(0, SCROLL_PX);
    await page.waitForTimeout(SETTLE_MS);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (errors.length || overflow) failures++;
    console.log(`${cond.name.padEnd(8)} ${(path || 'index').padEnd(14)} errors=${errors.length} overflow=${overflow}${errors.length ? '  ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }
  await context.close();
}
await browser.close();
if (failures) { console.error(`${failures} page checks failed`); process.exit(1); }
