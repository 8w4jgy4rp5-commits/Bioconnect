// Renders the promo intro and the BGM preview to MP4 (1080×1920, 30 fps).
// Frames are drawn one by one with promoFrame(t), so the video is exact
// however slow the machine is; the sound is rendered offline in the page.
// Needs ffmpeg and a static server on 127.0.0.1:8770 at the repo root
// (python -m http.server 8770 --bind 127.0.0.1).
//   node concepts/promo-video-v1/render.cjs
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'out'), FPS = 30;
const URL = 'http://127.0.0.1:8770/concepts/promo-video-v1/index.html?render';

(async () => {
  fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, 'frames'))) fs.unlinkSync(path.join(OUT, 'frames', f));
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(URL);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(i => i.complete));

  for (const which of ['intro', 'bgm']) {
    const { wav, peak } = await page.evaluate(w => window.promoAudio(w), which);
    fs.writeFileSync(path.join(OUT, which + '.wav'), Buffer.from(wav, 'base64'));
    console.log(which + '.wav peak', peak.toFixed(3));
  }

  const duration = await page.evaluate(() => PromoIntro.DURATION);
  const frames = Math.ceil(duration * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.promoFrame(t), i / FPS);
    await page.screenshot({ path: path.join(OUT, 'frames', String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  }
  await browser.close();
  console.log('frames', frames);

  const ff = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  ff(['-framerate', String(FPS), '-i', path.join(OUT, 'frames', '%04d.jpg'), '-i', path.join(OUT, 'intro.wav'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-shortest', path.join(OUT, 'promo-intro.mp4')]);
  // the BGM preview: the music under a still of the title moment
  ff(['-loop', '1', '-framerate', '2', '-i', path.join(OUT, 'frames', String(Math.floor(frames * .3)).padStart(4, '0') + '.jpg'), '-i', path.join(OUT, 'bgm.wav'),
    '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', path.join(OUT, 'bgm-preview.mp4')]);
  console.log('wrote out/promo-intro.mp4 and out/bgm-preview.mp4');
})();
