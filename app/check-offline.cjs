// Plays the app build (app/www) with the network cut off: any request that
// is not to the local server is blocked and reported. Fails on page errors,
// on blocked requests, or when a page falls back to a system font.
//
//   node app/check-offline.cjs            Chromium
//   node app/check-offline.cjs --webkit   WebKit (closest to the iPhone)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const pw = require(path.join(__dirname, '..', 'node_modules', 'playwright'));

const WWW = path.join(__dirname, 'www');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // Like the app (Capacitor): a path with no file extension gets the front page.
    if (!path.extname(rel)) rel = '/index.html';
    const file = path.join(WWW, rel);
    if (!file.startsWith(WWW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
  const engine = process.argv.includes('--webkit') ? pw.webkit : pw.chromium;
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await (engine === pw.webkit ? engine.launch() : engine.launch({ channel: process.env.BIOCONNECT_BROWSER_CHANNEL || 'chrome' }));
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: engine === pw.chromium, hasTouch: true });
  const problems = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    problems.push('blocked network request: ' + url);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e => problems.push('page error: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) problems.push(`missing file (${r.status()}): ${r.url()}`); });

  const fontsOk = async name => {
    const missing = await page.evaluate(async () => {
      await document.fonts.ready;
      const used = new Set();
      for (const el of document.querySelectorAll('body *')) {
        if (!el.textContent.trim()) continue;
        used.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
      }
      const ours = ['Fredoka', 'IM Fell English', 'IM Fell English SC', 'Special Elite'];
      return [...used].filter(f => ours.includes(f) && !document.fonts.check(`16px "${f}"`));
    });
    if (missing.length) problems.push(`${name}: font not loaded: ${missing.join(', ')}`);
  };

  // The game: title, play, a few placements.
  await page.goto(base);
  await page.locator('#startBtn').waitFor({ state: 'visible' });
  await fontsOk('title');
  // No sign-in, store, wallet or ads anywhere in the app.
  const noStore = async where => {
    const seen = await page.evaluate(() => {
      const ids = ['startShopBtn', 'startWallet', 'startNoAdsBtn', 'shopBtn', 'shopModal', 'reviveDawnLocked',
        'reviveDaily', 'reviveCrystal', 'reviveAd', 'reviveFind'];
      const shown = ids.filter(id => { const el = document.getElementById(id); return el && el.checkVisibility(); });
      const text = document.body.innerText;
      const words = ['Sign in', 'Crystal', 'No Ads', 'Stripe', 'browser'].filter(w => text.includes(w));
      return shown.concat(words.map(w => `"${w}"`));
    });
    if (seen.length) problems.push(`${where}: visible in the app: ${seen.join(', ')}`);
  };
  await noStore('title');
  await page.locator('#startBtn').focus(); await page.locator('#startBtn').press('Enter');  // it pulses, so a click never sees it still
  if (await page.locator('#lessonBar').isVisible()) await page.locator('#lessonSkip').click();
  await page.locator('#countdown').waitFor({ state: 'hidden', timeout: 15000 });
  for (let i = 0; i < 6; i++) {
    const empty = page.locator('#board .cell:not(.filled):not([hidden])').first();
    if (await empty.count()) await empty.click({ force: true });
    await page.waitForTimeout(400);
  }
  const placed = await page.evaluate(() => state.cells.filter(Boolean).length);
  if (!placed) problems.push('game: nothing was placed on the board');
  await page.screenshot({ path: path.join(__dirname, 'offline-game.png') });

  // A finished game: the results must not offer a paid revive or a sign-in.
  await page.evaluate(() => { state.over = false; state.paused = true; render(); endRun(); });
  await page.locator('#gameover').waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);
  await noStore('game over');
  await page.screenshot({ path: path.join(__dirname, 'offline-gameover.png') });

  // Walk the pages by their own links, as a player would, and back home.
  const walk = [['#startAnimalsLink', 'animals/index.html'], ['a[href="../guide/index.html"]', 'guide/index.html'],
    ['a[href="../legal/privacy.html"]', 'legal/privacy.html'], ['a[href="terms.html"]', 'legal/terms.html'],
    ['a[href="../index.html"]', 'index.html']];
  await page.goto(base);
  for (const [link, rel] of walk) {
    if (link === '#startAnimalsLink') {  // the dusk opening asks for one tap before its buttons
      await page.locator('#startBtn').waitFor({ state: 'visible' });
      await page.locator('.start-stage').click({ position: { x: 195, y: 300 } });
      await page.waitForTimeout(1500);
    }
    await page.locator(link).first().click({ timeout: 5000 });
    await page.waitForURL(u => (new URL(u).pathname.slice(1) || 'index.html') === rel, { timeout: 8000 }).catch(() => {});
    await page.waitForLoadState('load');
    const at = new URL(page.url()).pathname.slice(1) || 'index.html';
    if (process.env.DEBUG_WALK) console.log('after', link, '->', page.url());
    if (at !== rel) problems.push(`link ${link} led to ${at}, not ${rel}`);
    await fontsOk(rel);
    await noStore(rel);
    if (rel === 'animals/index.html') await page.screenshot({ path: path.join(__dirname, 'offline-book.png') });
  }

  await browser.close(); server.close();
  if (problems.length) {
    console.log([...new Set(problems)].join('\n'));
    process.exit(1);
  }
  console.log(`offline check passed (${engine.name()}): ${placed} animals placed, 5 pages walked by their links, no store or sign-in shown, no network used`);
})().catch(e => { console.error(e); process.exit(1); });
