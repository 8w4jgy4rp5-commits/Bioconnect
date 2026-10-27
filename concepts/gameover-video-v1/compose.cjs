// Builds the "doubling game overs" video from capture.cjs output:
// 1 game over, then 2, 4, ... 1024. Each doubling shrinks the whole mosaic
// into one half and fills the other half with new runs ending; every new
// run adds its own sad horn to the mix.   node compose.cjs [--preview]
const fs = require('fs'), path = require('path'), http = require('http');
const { spawnSync } = require('child_process');
const { chromium } = require('../../node_modules/playwright');
const dir = path.join(__dirname, '../../output/playwright/gameover-video');
const W = 1080, H = 1920, FPS = 30, RATE = 48000;
const report = JSON.parse(fs.readFileSync(dir + '/capture-report.json'));
const { times, clips } = report;

// seconds each level stays up (1, 2, 4 ... 1024 game overs), then a hold
const DUR = [4.6, 2.8, 2.4, 2.0, 1.7, 1.5, 1.4, 1.3, 1.3, 1.3, 1.3];
const HOLD = 2.2, MOVE = 0.3, HORN = 2.5;
const levelAt = [0];
for (const d of DUR) levelAt.push(levelAt[levelAt.length - 1] + d);
const TOTAL = levelAt[DUR.length] + HOLD;

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// Tile t at level k: each split (newest outermost) halves the region,
// left/right on odd levels, top/bottom on even ones.
function rect(t, k) {
  let x = 0, y = 0, w = W, h = H;
  for (let j = k; j >= 1; j--) {
    const b = (t >> (j - 1)) & 1;
    if (j % 2) { w /= 2; x += b * w; } else { h /= 2; y += b * h; }
  }
  // a 9:16 tile centred in its cell
  const tw = Math.min(w, h * 9 / 16), th = tw * 16 / 9;
  return { x: x + (w - tw) / 2, y: y + (h - th) / 2, w: tw, h: th };
}

// when each tile's run ends (its endRun), and which recorded run it shows
const hero = clips[0].end - clips[0].from;
const tiles = [{ clip: 0, born: 0, k: 0, at: hero }];
for (let k = 1; k < DUR.length; k++) {
  const n = 1 << (k - 1), spread = Math.min(0.6, DUR[k] * 0.45);
  for (let i = 0; i < n; i++) {
    const t = n + i;
    tiles.push({ clip: t < clips.length ? t : 1 + Math.floor(rand() * (clips.length - 1)), born: k,
      at: levelAt[k] + MOVE + (n === 1 ? 0 : rand() * spread), pitch: 0.96 + rand() * 0.08 });
  }
}

function frameOf(c, tau) {
  const clip = clips[c];
  const want = Math.min(clip.to, Math.max(clip.from, clip.end + tau));
  let lo = 0, hi = times.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (times[m] <= want) lo = m; else hi = m - 1; }
  return lo;
}

const ease = p => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
function plan(T) {
  let k = 0;
  while (k + 1 < DUR.length && T >= levelAt[k + 1]) k++;
  const p = ease((T - levelAt[k]) / MOVE);
  const out = [];
  for (let t = 0; t < 1 << k; t++) {
    const tile = tiles[t], to = rect(t, k);
    let r = to, alpha = 1;
    if (tile.born < k && k > 0) {
      const from = rect(t, k - 1);
      r = { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, w: from.w + (to.w - from.w) * p, h: from.h + (to.h - from.h) * p };
    } else if (tile.born === k && k > 0) alpha = p;
    const tau = T - tile.at;
    const set = r.w > 400 ? 'frames' : r.w > 140 ? 'f270' : 'f135';
    const f = frameOf(tile.clip, tau);
    out.push([set, set === 'frames' ? f : f + 1, r.x, r.y, r.w, r.h, alpha]);
  }
  return out;
}

// ---- audio: the hero's real recording, then one horn per new tile ----
function audio() {
  const raw = fs.readFileSync(dir + '/audio.f32');
  const src = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  const len = Math.ceil(TOTAL * RATE), mix = new Float32Array(len * 2);
  // hero: everything from its clip start (game music, then the horn)
  const h0 = Math.round(clips[0].from * RATE), hn = Math.round((clips[0].to - clips[0].from) * RATE);
  // the horn is much quieter than the music in the game; lift it so the pile-up can outgrow the music
  const lift = Math.round((clips[0].end - clips[0].from - 0.05) * RATE);
  for (let i = 0; i < hn && i < len; i++) { const g = i < lift ? 0.5 : HORN; mix[2 * i] += g * src[2 * (h0 + i)]; mix[2 * i + 1] += g * src[2 * (h0 + i) + 1]; }
  // the horn alone, taken from the second run (no music under it)
  const w0 = Math.round((clips[1].end - 0.01) * RATE), wn = Math.round(3.3 * RATE);
  for (const tile of tiles.slice(1)) {
    const n = 1 << Math.max(0, tile.born - 1), gain = HORN * Math.pow(n, -0.3);
    const start = Math.round((tile.at - 0.01) * RATE);
    for (let i = 0; i < wn / tile.pitch; i++) {
      const o = start + i; if (o >= len) break;
      const s = i * tile.pitch, j = Math.floor(s), f = s - j;
      for (let c = 0; c < 2; c++) mix[2 * o + c] += gain * (src[2 * (w0 + j) + c] * (1 - f) + src[2 * (w0 + j + 1) + c] * f);
    }
  }
  const out = Buffer.alloc(len * 4);
  for (let i = 0; i < len; i++) {
    const fade = Math.min(1, (TOTAL - i / RATE) / 0.8);
    for (let c = 0; c < 2; c++) out.writeInt16LE(Math.round(32767 * 0.92 * Math.tanh(mix[2 * i + c] * 3.2) * fade), (2 * i + c) * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + out.length, 4); head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(out.length, 40);
  fs.writeFileSync(dir + '/mix.wav', Buffer.concat([head, out]));
}

const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<body style="margin:0"><canvas id=c width=' + W + ' height=' + H + '></canvas>'); }
  fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', 'image/jpeg'); res.end(data); });
});

(async () => {
  audio();
  await new Promise(r => server.listen(8796, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/tians/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  await page.goto('http://127.0.0.1:8796/');
  await page.evaluate(() => {
    const cx = document.getElementById('c').getContext('2d');
    const cache = new Map();
    const load = key => {
      if (!cache.has(key)) {
        if (cache.size > 900) cache.delete(cache.keys().next().value);
        cache.set(key, fetch('/' + key).then(r => r.blob()).then(createImageBitmap));
      }
      return cache.get(key);
    };
    window.draw = async (list) => {
      const imgs = await Promise.all(list.map(([set, f]) => load(set + '/' + String(f).padStart(5, '0') + '.jpg')));
      cx.fillStyle = '#0d130c'; cx.fillRect(0, 0, 1080, 1920);
      cx.imageSmoothingQuality = 'high';
      list.forEach(([, , x, y, w, h, a], i) => { cx.globalAlpha = a; cx.drawImage(imgs[i], x, y, w, h); });
      cx.globalAlpha = 1;
      return cx.canvas.toDataURL('image/jpeg', 0.93).split(',')[1];
    };
  });
  const preview = process.argv.includes('--preview');
  const outDir = dir + (preview ? '/preview' : '/out');
  fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const shots = preview ? levelAt.slice(0, DUR.length).map((t, k) => t + DUR[k] - 0.05).concat([2.5, levelAt[3] + 0.15]) : null;
  const count = preview ? shots.length : Math.round(TOTAL * FPS);
  for (let i = 0; i < count; i++) {
    const T = preview ? shots[i] : i / FPS;
    const b64 = await page.evaluate(list => draw(list), plan(T));
    fs.writeFileSync(outDir + '/' + String(i).padStart(5, '0') + '.jpg', Buffer.from(b64, 'base64'));
    if (!preview && i % 90 === 0) console.log('frame', i, '/', count);
  }
  await browser.close(); server.close();
  if (preview) return console.log('preview frames', count, 'total', TOTAL.toFixed(2));
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', outDir + '/%05d.jpg', '-i', dir + '/mix.wav',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', dir + '/gameover-doubling.mp4'], { stdio: 'inherit' });
  console.log('video', r.status === 0 ? 'ok' : 'failed', TOTAL.toFixed(2) + 's');
})().catch(e => { console.error(e); process.exit(1); });
