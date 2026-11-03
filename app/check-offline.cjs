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
    if (rel.endsWith('/')) rel += 'index.html';
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

  for (const rel of ['animals/', 'guide/', 'legal/privacy.html', 'legal/terms.html']) {
    await page.goto(base + rel);
    await fontsOk(rel);
  }
  await page.goto(base + 'animals/');
  await page.screenshot({ path: path.join(__dirname, 'offline-book.png') });

  await browser.close(); server.close();
  if (problems.length) {
    console.log([...new Set(problems)].join('\n'));
    process.exit(1);
  }
  console.log(`offline check passed (${engine.name()}): ${placed} animals placed, 4 pages opened, no network used`);
})().catch(e => { console.error(e); process.exit(1); });
