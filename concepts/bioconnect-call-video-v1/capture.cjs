// Plays chosen 7+ chain scenes on the real page and records frames + game audio.
//   node capture.cjs --preview   one framing screenshot only
//   node capture.cjs             record
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('../../node_modules/playwright');
const root = path.join(__dirname, '../..');
const out = path.join(root, 'output/playwright/bioconnect-call-video');
const W = Number(process.env.VW) || 432, H = Number(process.env.VH) || 768, DSF = Number(process.env.DSF) || 2.5;
const PICK = [[113, 10], [138, 11]]; // [seed, square]
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith(path.sep)) p += 'index.html';
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(r => server.listen(8794, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/tians/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=' + DSF, '--window-size=' + W + ',' + H] });
  // Screencast frames come out at CSS-pixel size under Playwright's own
  // viewport emulation; a forced DPR plus a raw metrics override gives 1080x1920.
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 0, mobile: false });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.setItem('ecosystem-puzzle:basics:v1', 'done'); } catch (e) {} });
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...args) {
      if (dest instanceof AudioDestinationNode) {
        if (!window.__tap) window.__tap = this.context.createMediaStreamDestination();
        connect.call(this, window.__tap);
      }
      return connect.call(this, dest, ...args);
    };
  });
  await page.goto('http://127.0.0.1:8794/');
  await page.locator('#startBtn').press('Enter');
  await page.locator('#countdown').waitFor({ state: 'hidden', timeout: 15000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { clearInterval(tickTimer); tickTimer = 0; syncClock = () => {}; writeBest = () => {}; writeMet = () => {}; });
  const scenes = JSON.parse(fs.readFileSync(out + '/scenes.json'));
  const chosen = PICK.map(([s, i]) => scenes.find(x => x.seed === s && x.i === i));
  async function load(s) {
    await page.evaluate(s => {
      cancelChain(); hideWord();
      Object.assign(state, s.state, { paused: false, over: false, celebrating: false });
      for (const k of LADDER) { met.add(k); state.seen[k] = true; }
      render([], [], []);
      BioAudio.discover(state.cells.filter(Boolean).map(c => c.kind));
      setTicker('');
    }, s);
  }
  await load(chosen[0]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/framing.png' });
  if (process.argv.includes('--preview')) { console.log('errors', errors); await browser.close(); server.close(); return; }

  fs.rmSync(out + '/frames', { recursive: true, force: true });
  fs.mkdirSync(out + '/frames', { recursive: true });
  const audioAt = await page.evaluate(() => {
    window.__chunks = [];
    const mr = new MediaRecorder(__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
    mr.ondataavailable = e => { if (e.data.size) __chunks.push(e.data); };
    mr.start(250); window.__mr = mr;
    return Date.now();
  });
  let rec = true, frames = 0;
  const times = [], begin = Date.now(), marks = [];
  cdp.on('Page.screencastFrame', e => {
    if (rec) { times.push((Date.now() - begin) / 1000); fs.writeFileSync(out + '/frames/' + String(frames).padStart(5, '0') + '.jpg', Buffer.from(e.data, 'base64')); frames++; }
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  for (let j = 0; j < chosen.length; j++) {
    const s = chosen[j];
    if (j) await load(s);
    await page.waitForTimeout(1200);
    const box = await page.locator('#board').boundingBox();
    const x = box.x + (s.i % 5 + .5) * box.width / 5, y = box.y + (Math.floor(s.i / 5) + .5) * box.height / 5;
    await page.mouse.move(x, y, { steps: 12 });
    await page.waitForTimeout(700);
    const n = await page.evaluate(i => previewGrowth(i).length, s.i);
    marks.push({ scene: j + 1, seed: s.seed, chain: n, kind: s.kind, tap: (Date.now() - begin) / 1000 });
    await page.mouse.click(x, y);
    let sawShout = false;
    for (let k = 0; k < 40; k++) { await page.waitForTimeout(100); if (await page.locator('.fx-shout').count()) { sawShout = true; marks[j].shout = (Date.now() - begin) / 1000; break; } }
    marks[j].sawShout = sawShout;
    await page.waitForTimeout(2600);
    await page.mouse.move(W - 5, H - 5, { steps: 6 });
    await page.waitForTimeout(800);
    console.log('SCENE', marks[j]);
  }
  rec = false;
  await cdp.send('Page.stopScreencast');
  const b64 = await page.evaluate(() => new Promise(done => {
    __mr.onstop = async () => {
      const buf = new Uint8Array(await new Blob(__chunks, { type: 'audio/webm' }).arrayBuffer());
      let bin = ''; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
      done(btoa(bin));
    };
    __mr.stop();
  }));
  fs.writeFileSync(out + '/game-audio.webm', Buffer.from(b64, 'base64'));
  let list = '';
  for (let i = 0; i < frames; i++) list += "file 'frames/" + String(i).padStart(5, '0') + ".jpg'\nduration " + (i < frames - 1 ? times[i + 1] - times[i] : .05).toFixed(4) + '\n';
  list += "file 'frames/" + String(frames - 1).padStart(5, '0') + ".jpg'\n";
  fs.writeFileSync(out + '/frames.txt', list);
  const report = { frames, duration: (Date.now() - begin) / 1000, firstFrame: times[0], audioOffset: (audioAt - begin) / 1000, marks, errors };
  fs.writeFileSync(out + '/capture-report.json', JSON.stringify(report, null, 2));
  console.log('DONE', JSON.stringify(report));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
