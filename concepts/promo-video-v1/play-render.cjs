// Renders the play section — the bot's recorded run on the real board,
// cut together with fast-forwards and one slow-motion meal — then joins it
// to the intro and lays the whole soundtrack under both.
// Needs out/frames/ from render.cjs (the intro), ffmpeg, and a static
// server on 127.0.0.1:8770 at the repo root.
//   node concepts/promo-video-v1/play-render.cjs
//
// The page's clock is driven by hand (Playwright's clock), so every frame
// is exact however slow the machine is, and the run replays identically.
// The cut list below names moments of watch/elephant-run.json in page
// seconds after PLAY; if the rules or the recorded run change, run with
// `--log` to list the merges and meals again and pick new moments.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'out'), FPS = 30, BASE = 'http://127.0.0.1:8770/';
const VIEW = { width: 390, height: 693 }, DPR = 1920 / 693;

// [from, to, speed] in page seconds after PLAY. Speed above 3 is a
// fast-forward (badge, whoosh, no finger); below 1 is the slow-motion meal.
const CUTS = [
  [1.9, 10.4, 2.5],      // first plantings: rabbit, fox, then a deer
  [10.4, 18.6, 10],
  [18.6, 20.4, 1],       // four in a row up to the first zebra
  [20.4, 84.8, 30],
  [84.8, 86.7, 1],       // five in a row up to the first wolf
  [86.7, 123.9, 30],
  [123.9, 125.0, .4],    // a fox takes a rabbit, slowly
  [125.0, 125.6, 1],
  [125.6, 150.3, 30],
  [150.3, 152.0, 1]      // the bear arrives
];
const MEAL = { t: 124.45, at: 19 };          // fox at 19 takes the rabbit at 14
const END_HOLD = 3.6;                        // seconds of end card
const INTRO = 8.5;                           // the intro's length, seconds

function timeline() {
  let out = 0;
  const segs = CUTS.map(([a, b, s]) => { const seg = { a, b, s, o0: out, o1: out + (b - a) / s }; out = seg.o1; return seg; });
  return { segs, playLen: out, total: out + END_HOLD };
}
const { segs, playLen, total } = timeline();
const pageTime = o => {                     // video seconds into the play section -> page seconds
  for (const g of segs) if (o < g.o1) return g.a + (o - g.o0) * g.s;
  return CUTS[CUTS.length - 1][1] + (o - playLen);
};
const outTime = v => {                      // page seconds -> video seconds (first cut that holds it)
  for (const g of segs) if (v >= g.a && v < g.b) return g.o0 + (v - g.a) / g.s;
  return null;
};
const segAt = o => segs.find(g => o < g.o1) || null;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: DPR });
  page.on('pageerror', e => { if (!/supabase/i.test(e.message)) console.log('page error:', e.message); });
  await page.clock.install({ time: new Date('2026-10-10T12:00:00Z') });
  const runLoaded = page.waitForResponse(r => r.url().includes('elephant-run.json')).catch(() => {});
  await page.goto(BASE + 'index.html?watch');
  // install() alone lets page time keep flowing with real time, which a
  // second-per-frame screenshot would leak into the run; pause it, so it
  // only moves when runFor() moves it
  await page.clock.pauseAt(new Date('2026-10-10T12:00:10Z'));
  await page.addScriptTag({ path: path.join(__dirname, 'promo-play.js') });
  await page.clock.runFor(1500);
  // the bot's move list arrives over the network in real time; let it land
  // before PLAY so the run starts at the same page time on every render
  await runLoaded;
  await page.waitForTimeout(800);
  const t0 = await page.evaluate(() => { document.getElementById('startBtn').click(); return performance.now(); });
  let v = 0;                                // page seconds after PLAY, so far

  if (process.argv.includes('--log')) {
    await page.clock.runFor(170000);
    const log = await page.evaluate(() => PromoPlay.log);
    console.log('first placement', ((log[0].t - t0) / 1000).toFixed(2));
    for (const e of log) if (e.type === 'meal' || (e.grew && e.grew.length)) console.log(((e.t - t0) / 1000).toFixed(2), e.type, e.at, e.grew ? e.grew.map(g => g.kind).join('>') : e.kind + '<' + e.ateKind);
    return browser.close();
  }

  const dir = path.join(OUT, 'play-frames');
  fs.mkdirSync(dir, { recursive: true });
  if (!process.argv.includes('--audio')) for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const frames = Math.ceil(total * FPS);
  // `--test 3,12.5` only shoots those moments (video seconds of the play
  // section) to test/, for a quick look
  const ti = process.argv.indexOf('--test');
  const only = ti > 0 ? new Set(process.argv[ti + 1].split(',').map(x => Math.round(parseFloat(x) * FPS))) : null;
  let endStart = playLen - .25;
  for (let i = 0; i < frames; i++) {
    const o = i / FPS, target = pageTime(o);
    // whole milliseconds only, and counted as moved, so rounding never adds up
    const ms = Math.round((target - v) * 1000);
    if (ms > 0) { await page.clock.runFor(ms); v += ms / 1000; }
    if (process.argv.includes('--audio')) continue;   // sound only: the run, no pictures
    const g = segAt(o);
    const fast = g && g.s > 3, slowSeg = g && g.s < 1;
    let slow = 0;
    const sg = segs.find(x => x.s < 1);
    if (sg) slow = clamp((o - sg.o0 + .2) / .25) * clamp((sg.o1 + .15 - o) / .25);
    const end = clamp((o - endStart) / .5);
    await page.evaluate(x => PromoPlay.frame(x), {
      white: clamp(1 - o / .35),
      finger: !!g && !fast,
      ff: fast ? '▶▶ ×' + g.s : '',
      slow, meal: { at: MEAL.at }, eatPop: (v - MEAL.t) / .45,
      zoom: { scale: process.env.NOZOOM ? 1 : 1 + .6 * slow, at: MEAL.at },
      ghost: end > .5 ? 'hide' : 'shadow',
      end, reveal: clamp((o - endStart - 1.1) / .5)
    });
    if (only && !only.has(i)) continue;
    if (process.env.DEBUG) console.log('o', o.toFixed(2), 'v', v.toFixed(2), 'real', ((await page.evaluate(() => performance.now()) - t0) / 1000).toFixed(2), await page.evaluate(() => state.cells.map(c => c ? c.kind[0] : '.').join('') + ' meals ' + PromoPlay.log.filter(e => e.type === 'meal' && e.ateKind === 'rabbit').map(e => e.t.toFixed(0) + '@' + e.at).join(',')));
    await page.screenshot({ path: only ? path.join(OUT, 'test-' + (i / FPS).toFixed(2) + '.jpg') : path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (i % 60 === 0) console.log('frame', i, '/', frames);
  }
  if (only) return browser.close();
  const log = await page.evaluate(() => PromoPlay.log);

  // --- the soundtrack cues, in seconds from the start of the whole video
  const at = o => INTRO + o;
  const cue = { musicStart: INTRO, musicStop: at(endStart), taps: [], pops: [], whooshes: [], slow: [], chomps: [], length: INTRO + total };
  for (const e of log) {
    const o = outTime((e.t - t0) / 1000);
    if (o == null) continue;
    const g = segAt(o);
    if (e.type === 'place' && g.s <= 3) {
      cue.taps.push(at(o));
      // one pop per rung of the chain, climbing, spaced as the game spaces them
      e.grew.forEach((r, n) => cue.pops.push([at(o + (.05 + n * .16) / Math.max(1, g.s)), [69, 72, 74, 76, 79, 81, 84][Math.min(n, 6)]]));
    }
    if (e.type === 'meal' && Math.abs((e.t - t0) / 1000 - MEAL.t) < .05) cue.chomps.push(at(o));
  }
  for (const g of segs) {
    if (g.s > 3) cue.whooshes.push(at(g.o0) - .1);
    if (g.s < 1) cue.slow.push([at(g.o0), at(g.o1)]);
  }
  cue.bell = at(endStart + .2);
  cue.fanfare = at(endStart + 1.1);
  cue.reveal = at(endStart + 1.15);

  const audio = await browser.newPage();
  await audio.goto(BASE + 'concepts/promo-video-v1/index.html?render');
  await audio.waitForFunction(() => window.promoReady, null, { timeout: 30000 });
  const { wav, peak } = await audio.evaluate(c => window.promoAudio('full', c), cue);
  fs.writeFileSync(path.join(OUT, 'full.wav'), Buffer.from(wav, 'base64'));
  console.log('full.wav peak', peak.toFixed(3), 'cues', cue.taps.length, 'taps', cue.pops.length, 'pops');
  await browser.close();

  // `--audio`: the frames from the last full render are kept; only the
  // soundtrack is made again and laid under them
  const ff = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  ff(['-framerate', String(FPS), '-i', path.join(OUT, 'frames', '%04d.jpg'),
    '-framerate', String(FPS), '-i', path.join(dir, '%04d.jpg'), '-i', path.join(OUT, 'full.wav'),
    '-filter_complex', '[0:v]scale=1080:1920,setsar=1[a];[1:v]scale=1080:1920,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]',
    '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', '-shortest',
    path.join(OUT, 'promo-full.mp4')]);
  console.log('wrote out/promo-full.mp4', (INTRO + total).toFixed(1) + 's');
})();
