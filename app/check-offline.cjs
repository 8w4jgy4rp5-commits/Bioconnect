// Plays the app build (app/www) with the network cut off: any request that
// is not to the local server is blocked and reported. Apple's store is a
// stand-in here; the shop, a purchase and a revive are played through it. Fails on page errors,
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
  // A stand-in for Apple's store (the app reads window.__BIO_APP_STORE__ only off the iPhone).
  await context.addInitScript(() => {
    const prices = { crystals5: '$0.99', crystals11: '$1.99', crystals30: '$4.99', crystals65: '$9.99' };
    let n = 0;
    window.__BIO_APP_STORE__ = {
      call: async (method, o) => {
        if (method === 'getProducts') return { products: o.productIdentifiers.map(id => ({ identifier: id, priceString: prices[id] })) };
        if (method === 'purchaseProduct') {
          if (window.__fakeCancel) throw new Error('User cancelled');
          return { transactionId: window.__fakeTx || String(++n), productIdentifier: o.productIdentifier, quantity: 1 };
        }
        if (method === 'acknowledgePurchase') return {};
        throw new Error('unexpected store call ' + method);
      },
      listen: (event, fn) => { if (event === 'transactionUpdated') window.__fakeEmit = fn; }
    };
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
  // No sign-in, Stripe or No Ads anywhere in the app; Crystals only, through Apple.
  const noWebStore = async where => {
    const seen = await page.evaluate(() => {
      const ids = ['startNoAdsBtn', 'reviveDawnLocked', 'reviveDaily', 'reviveAd'];
      const shown = ids.filter(id => { const el = document.getElementById(id); return el && el.checkVisibility(); });
      const text = document.body.innerText;
      const words = ['Sign in', 'No Ads', 'Stripe', 'browser'].filter(w => text.includes(w));
      return shown.concat(words.map(w => `"${w}"`));
    });
    if (seen.length) problems.push(`${where}: visible in the app: ${seen.join(', ')}`);
  };
  const crystals = () => page.evaluate(() => BioEconomy.summary().wallet.crystals);
  const expect = async (what, want) => { const got = await crystals(); if (got !== want) problems.push(`${what}: ${got} Crystals, expected ${want}`); };
  await noWebStore('title');
  if (!await page.locator('#startWallet').isVisible() || await page.locator('#startCrystalCount').textContent() !== '0') problems.push('title: Crystal balance 0 not shown');

  // The shop, with the stand-in Apple store: prices from Apple, the free 3,
  // a purchase, a repeated transaction, a cancel, and one Apple finishes later.
  await page.evaluate(() => BioEconomy.openShop());
  await page.locator('[data-product="crystals5"] .pack-price', { hasText: '$0.99' }).waitFor({ timeout: 5000 });
  await noWebStore('shop');
  await page.screenshot({ path: path.join(__dirname, 'offline-shop.png') });
  await page.locator('#claimBtn').click(); await expect('free Crystals', 3);
  if (await page.locator('#claimBtn').isVisible()) problems.push('shop: free Crystals offered twice');
  await page.locator('[data-product="crystals5"]').click();
  await page.locator('#shopStatus', { hasText: '5 Crystals added.' }).waitFor({ timeout: 5000 }).catch(() => {});
  await expect('after buying 5', 8);
  await page.evaluate(() => { window.__fakeTx = '1'; });
  await page.locator('[data-product="crystals11"]').click(); await page.waitForTimeout(300);
  await expect('same transaction again', 8);
  await page.evaluate(() => { window.__fakeTx = null; window.__fakeCancel = true; });
  await page.locator('[data-product="crystals65"]').click();
  await page.locator('#shopStatus', { hasText: 'cancelled' }).waitFor({ timeout: 5000 }).catch(() => problems.push('shop: cancel not reported'));
  await expect('after a cancel', 8);
  await page.evaluate(() => { window.__fakeCancel = false; window.__fakeEmit({ transactionId: '99', productIdentifier: 'crystals30' }); });
  await expect('purchase finished later', 38);
  await page.locator('#shopClose').click();

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

  // A finished game: revive with 1 Crystal, nothing about ads or signing in.
  await page.evaluate(() => { state.over = false; state.paused = true; render(); endRun(); });
  await page.locator('#gameover').waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);
  await noWebStore('game over');
  await page.screenshot({ path: path.join(__dirname, 'offline-gameover.png') });
  await page.locator('#reviveCrystal').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await expect('after a revive', 37);
  if (!await page.evaluate(() => state.revived)) problems.push('game over: revive did not happen');

  // In play: the Crystal balance sits top right, and Pause → Title screen
  // goes back to the opening screen with the run kept for PLAY.
  await page.evaluate(() => { state.revivalWait = false; document.getElementById('reviveResume').hidden = true; });
  if (await page.locator('#gameCrystalCount').textContent() !== '37') problems.push('game: the Crystal balance is not shown during play');
  await page.locator('#pauseBtn').click();
  await page.locator('#pauseHome').click();
  if (!await page.locator('#startScreen').isVisible()) problems.push('pause: Title screen did not open the opening screen');
  if (await page.evaluate(() => BioAudio.band().theme) !== 'title') problems.push('pause: the title music did not come back');

  // Walk the pages by their own links, as a player would. They open over the
  // game in a frame, share its music player, and a link home closes them.
  const walk = [['#startAnimalsLink', 'animals/index.html'], ['a[href="../guide/index.html"]', 'guide/index.html'],
    ['a[href="../legal/privacy.html"]', 'legal/privacy.html'], ['a[href="terms.html"]', 'legal/terms.html'],
    ['a[href="../index.html"]', 'index.html']];
  await page.goto(base);
  const frame = () => page.frames().find(f => f !== page.mainFrame());
  for (const [link, rel] of walk) {
    if (link === '#startAnimalsLink') {  // the dusk opening asks for one tap before its buttons
      await page.locator('#startBtn').waitFor({ state: 'visible' });
      await page.locator('.start-stage').click({ position: { x: 195, y: 300 } });
      await page.waitForTimeout(1500);
      await page.locator(link).click({ timeout: 5000 });
    } else {
      await frame().locator(link).first().click({ timeout: 5000 });
    }
    await page.waitForTimeout(800);
    const layerOpen = await page.locator('.app-page-layer').isVisible().catch(() => false);
    if (rel === 'index.html') {
      if (layerOpen) problems.push('the link home did not close the page layer');
      if (new URL(page.url()).pathname !== '/') problems.push('the link home reloaded the game');
      continue;
    }
    const f = frame();
    const at = f && new URL(f.url()).pathname.slice(1);
    if (!layerOpen || at !== rel) { problems.push(`link ${link} led to ${at}, not ${rel} over the game`); continue; }
    if (new URL(page.url()).pathname !== '/') problems.push(`link ${link} left the game page`);
    if (!await f.evaluate(() => !window.BioAudio || window.BioAudio === window.parent.BioAudio)) problems.push(rel + ': has its own music player');
    if (rel === 'animals/index.html') {
      await f.locator('#next').click();
      await f.locator('#next').click();
      const count = await f.locator('#count').textContent();
      if (!/^3 \/ 10$/.test(count)) problems.push('field book: Next did not turn the page (' + count + ')');
      await page.screenshot({ path: path.join(__dirname, 'offline-book.png') });
    }
  }

  if (await page.locator('#startCrystalCount').textContent() !== '37') problems.push('the Crystal balance was not kept on the device');

  // Without a store (no connection to Apple): it says so and sells nothing.
  const bare = await browser.newPage();
  bare.on('pageerror', e => problems.push('page error (no store): ' + e.message));
  await bare.goto(base); await bare.locator('#startBtn').waitFor({ state: 'visible' });
  await bare.evaluate(() => BioEconomy.openShop());
  await bare.waitForTimeout(300);
  if (!/unavailable/.test(await bare.locator('#shopStatus').textContent())) problems.push('no store: the shop does not say it is unavailable');
  if (await bare.locator('[data-product]:not([disabled])').count()) problems.push('no store: a pack can still be bought');
  await browser.close(); server.close();
  if (problems.length) {
    console.log([...new Set(problems)].join('\n'));
    process.exit(1);
  }
  console.log(`offline check passed (${engine.name()}): ${placed} animals placed, 5 pages walked by their links over the game, Crystals bought, kept and spent, no sign-in or web store shown, no network used`);
})().catch(e => { console.error(e); process.exit(1); });
