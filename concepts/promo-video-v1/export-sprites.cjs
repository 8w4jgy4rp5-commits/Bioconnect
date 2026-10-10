// Saves each tile of the ladder, painted by the game itself, as a PNG
// for the promo intro. Needs a static server on 127.0.0.1:8770 at the
// repo root (python -m http.server 8770 --bind 127.0.0.1).
//   node concepts/promo-video-v1/export-sprites.cjs
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'sprites');
const KINDS = ['sprout','grass','rabbit','fox','deer','zebra','buffalo','wolf','bear','lion','tiger','elephant'];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 3 });
  await page.goto('http://127.0.0.1:8770/index.html?skin=eldritch');
  await page.waitForFunction(() => typeof paintTile === 'function' && typeof spritesReady !== 'undefined' && spritesReady);
  for (const kind of KINDS) {
    await page.evaluate(k => {
      let box = document.getElementById('promo-sprite');
      if (!box) {
        box = document.createElement('div');
        box.id = 'promo-sprite';
        box.style.cssText = 'position:fixed;left:20px;top:20px;width:160px;height:160px;z-index:99999;background:transparent;display:grid';
        document.body.appendChild(box);
        // only the tile: the title screen and page colour stay out of the shot
        const hide = document.createElement('style');
        hide.textContent = 'html,body{background:transparent!important}body>*:not(#promo-sprite){visibility:hidden!important}';
        document.head.appendChild(hide);
      }
      box.className = 'cell';
      box.style.background = 'transparent'; box.style.border = '0'; box.style.boxShadow = 'none';
      paintTile(box, k, 1);
    }, kind);
    await page.waitForTimeout(400);
    await page.locator('#promo-sprite').screenshot({ path: path.join(OUT, kind + '.png'), omitBackground: true });
    console.log('saved', kind);
  }
  await browser.close();
})();
