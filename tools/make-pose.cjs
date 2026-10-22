// Re-export the opening-screen rabbit/fox from the board rig at native resolution,
// on a canvas big enough that ears and tail are never clipped.
const root = require("path").resolve(process.argv[2]), out = process.argv[3];
const {chromium} = require(root + '/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.mp3':'audio/mpeg'};
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': types[path.extname(p)] || 'application/octet-stream'}); fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1', async () => {
  const browser = await chromium.launch({channel: 'msedge'}).catch(() => chromium.launch());
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port + '/index.html');
  await page.waitForFunction(() => typeof RIG === 'object');
  for (const kind of ['rabbit', 'fox']) {
    const data = await page.evaluate(async (kind) => {
      const rig = RIG[kind], U = 5; // px per rig unit (parts are ~4-5 px/unit natively)
      const load = f => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'img/' + f; });
      const img = {};
      for (const [name] of rig.parts) { const k = name === '@head' ? rig.head.calm : name; img[name] = await load(SPRITE_FILES[k]); }
      const c = document.createElement('canvas'); c.width = c.height = rig.fit.span * U * 2;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      g.translate(c.width / 2 - rig.fit.ox * U, c.height / 2 + rig.fit.oy * U); g.scale(U, U);
      if (rig.fit.tilt) g.rotate(rig.fit.tilt * Math.PI / 180);
      for (const [name, p, alpha] of rig.parts) {
        const im = img[name], w = p.w, h = p.w * im.height / im.width;
        g.globalAlpha = alpha; g.save(); g.translate(p.x, p.y);
        if (p.r) g.rotate(p.r * Math.PI / 180);
        if (p.flip) g.scale(-1, 1);
        g.drawImage(im, -w * p.px, -h * p.py, w, h); g.restore();
      }
      // trim to the painted pixels, then give every side the same breathing room
      const a = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (a[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
      const o = document.createElement('canvas'); o.width = x1 - x0 + 1 + 2 * m; o.height = y1 - y0 + 1 + 2 * m;
      o.getContext('2d').drawImage(c, x0 - m, y0 - m, o.width, o.height, 0, 0, o.width, o.height);
      return o.toDataURL('image/png');
    }, kind);
    fs.writeFileSync(path.join(out, kind + '-pose-v2.png'), Buffer.from(data.split(',')[1], 'base64'));
    console.log('wrote', kind + '-pose-v2.png');
  }
  await browser.close(); server.close();
});
