// Replays each ending from endings.json on the real page: the full board, then
// the game's own endRun (Game Over wilt, sad horn, score card). Records frames
// for every ending and the game audio (the first ending is the one heard).
//   node capture.cjs
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('../../node_modules/playwright');
const root = path.join(__dirname, '../..');
const out = path.join(root, 'output/playwright/gameover-video');
const W = 432, H = 768, DSF = 2.5;
const PRE = [1.2, 0.4], AFTER = 4.2; // seconds of board before endRun (first / rest), seconds after
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
  await new Promise(r => server.listen(8795, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/tians/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=' + DSF, '--window-size=' + W + ',' + H] });
  // forced DPR plus a raw metrics override gives 1080x1920 screencast frames
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
  await page.goto('http://127.0.0.1:8795/');
  await page.locator('#startBtn').press('Enter');
  await page.locator('#countdown').waitFor({ state: 'hidden', timeout: 15000 });
  await page.waitForTimeout(800);
  // no world clock, and nothing these replays do is saved
  await page.evaluate(() => {
    clearInterval(tickTimer); tickTimer = 0;
    syncClock = () => {}; writeBest = () => {}; writeMet = () => {}; recordRun = () => {}; showSealToasts = () => {};
  });
  const endings = JSON.parse(fs.readFileSync(out + '/endings.json'));
  async function load(s) {
    await page.evaluate(s => {
      clearTimeout(overTimer); overTimer = 0;
      cancelChain(); hideWord();
      el.gameover.hidden = true; el.goPop.hidden = true;
      Object.assign(state, s, { paused: false, over: false, celebrating: false });
      for (const k of LADDER) { met.add(k); state.seen[k] = true; }
      render([], [], []);
      setTicker('');
    }, s.state);
  }

  fs.rmSync(out + '/frames', { recursive: true, force: true });
  fs.mkdirSync(out + '/frames', { recursive: true });
  const audioAt = await page.evaluate(() => {
    window.__chunks = [];
    const mr = new MediaRecorder(__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
    mr.ondataavailable = e => { if (e.data.size) __chunks.push(e.data); };
    mr.start(250); window.__mr = mr;
    return Date.now();
  });
  let frames = 0;
  const times = [], begin = Date.now(), clips = [];
  cdp.on('Page.screencastFrame', e => {
    times.push((Date.now() - begin) / 1000);
    fs.writeFileSync(out + '/frames/' + String(frames).padStart(5, '0') + '.jpg', Buffer.from(e.data, 'base64'));
    frames++;
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });
  await load(endings[0]);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1 });
  for (let j = 0; j < endings.length; j++) {
    if (j) await load(endings[j]);
    const pre = PRE[j ? 1 : 0];
    const from = (Date.now() - begin) / 1000;
    await page.waitForTimeout(pre * 1000);
    const at = await page.evaluate(() => { const t = Date.now(); endRun(); return t; });
    await page.waitForTimeout(AFTER * 1000);
    const card = await page.evaluate(() => !el.gameover.hidden && el.goScore.textContent);
    clips.push({ seed: endings[j].seed, from, end: (at - begin) / 1000, to: (Date.now() - begin) / 1000, card });
    console.log('CLIP', j, clips[j]);
  }
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
  const report = { frames, times, audioOffset: (audioAt - begin) / 1000, clips, errors };
  fs.writeFileSync(out + '/capture-report.json', JSON.stringify(report));
  console.log('DONE frames', frames, 'audioOffset', report.audioOffset, 'errors', errors);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
