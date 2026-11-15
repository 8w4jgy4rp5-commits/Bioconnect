/* The iPhone app's pacing (app/build-app.cjs ships this; styles in app/app.css).
 *  - Opening: a loading screen that waits for the pictures and fonts, then
 *    the sun comes up over the lake, then the title; the music starts only
 *    once the title is there.
 *  - Leaving a game (New game or Title screen) always asks first.
 *  - Going back to the title fades out and in, instead of cutting. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = id => document.getElementById(id);
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // ---------- opening ----------
  let opening = true, swallowUntil = 0, dawnTimer = 0;
  function music() { window.BioAudio?.hold?.(false); }
  function titleReady() {
    if (!opening) return;
    opening = false;
    clearTimeout(dawnTimer);
    root.classList.remove('bio-loading', 'bio-dawn');
    $('appLoading')?.remove();
    music();
  }
  // A tap during the opening skips to the title and does nothing else.
  function skip(e) {
    if (opening && !root.classList.contains('bio-loading')) { titleReady(); swallowUntil = Date.now() + 500; }
    if (opening || Date.now() < swallowUntil) { e.stopImmediatePropagation(); e.preventDefault(); }
  }
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, skip, { capture: true, passive: false });
  }

  // The bar follows the pictures actually arriving; it never sits at 0 or
  // rushes past in a blink (at least about a second and a half).
  async function load() {
    const fill = $('appLoadingFill'), started = performance.now(), least = 1500, most = 6000;
    const loaded = new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    }).then(() => document.fonts?.ready);
    let done = false;
    loaded.then(() => { done = true; });
    while (true) {
      const elapsed = performance.now() - started;
      const images = [...document.images];
      const real = images.length ? images.filter(i => i.complete).length / images.length : 1;
      const share = done ? 1 : Math.min(real, .9);
      const shown = Math.min(share, elapsed / least);
      if (fill) fill.style.transform = `scaleX(${Math.max(.04, shown)})`;
      if ((done && elapsed >= least) || elapsed >= most) break;
      await wait(60);
    }
    if (fill) fill.style.transform = 'scaleX(1)';
    await wait(250);
  }

  async function open() {
    await load();
    const screen = $('appLoading');
    if (calm) { titleReady(); return; }
    // The dawn plays behind the loading screen as it fades away.
    root.classList.add('bio-dawn');
    root.classList.remove('bio-loading');
    screen?.classList.add('is-done');
    window.addEventListener('animationend', e => { if (e.animationName === 'dawn-title') titleReady(); });
    dawnTimer = setTimeout(titleReady, 5000);
  }
  open();

  // ---------- leaving a game asks first ----------
  const ASK = {
    pauseHome: () => ({ title: 'Back to the title?', text: 'Your meadow waits. PLAY picks this game up again.', yes: 'Go to the title' }),
    goHome: () => ({ title: 'Back to the title?', text: canRevive() ? 'This game ends here. You can no longer revive it.' : 'This game ends here.', yes: 'Go to the title' }),
    goAgain: () => ({ title: 'Start a new game?', text: canRevive() ? 'This meadow is cleared, and you can no longer revive it.' : 'This meadow is cleared and a new one begins.', yes: 'Start a new game' })
  };
  function canRevive() { const s = window.BioGame?.summary?.(); return !!(s && s.over && !s.revived); }

  let asking = null, passing = false;
  function ask({ title, text, yes }) {
    const sheet = $('appConfirm');
    $('appConfirmTitle').textContent = title;
    $('appConfirmText').textContent = text;
    $('appConfirmYes').textContent = yes;
    sheet.hidden = false;
    $('appConfirmNo').focus();
    return new Promise(resolve => { asking = resolve; });
  }
  function answer(ok) {
    if (!asking) return;
    $('appConfirm').hidden = true;
    window.BioAudio?.coin?.();
    const resolve = asking; asking = null; resolve(ok);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest?.('#pauseHome, #goHome, #goAgain');
    if (!btn || passing) return;
    e.stopImmediatePropagation(); e.preventDefault();
    window.BioAudio?.coin?.();
    ask(ASK[btn.id]()).then(ok => {
      if (!ok) return;
      if (btn.id === 'goAgain') { press(btn); return; }
      toTitle(btn);
    });
  }, true);
  function press(btn) { passing = true; try { btn.click(); } finally { passing = false; } }

  // ---------- back to the title: fade out, then in ----------
  async function toTitle(btn) {
    const curtain = $('appCurtain');
    if (calm || !curtain) { press(btn); return; }
    curtain.hidden = false;
    void curtain.offsetWidth;
    curtain.classList.add('is-closed');
    await wait(650);
    press(btn);
    root.classList.add('bio-return');
    await wait(250);
    curtain.classList.remove('is-closed');
    await wait(900);
    curtain.hidden = true;
    root.classList.remove('bio-return');
  }

  function init() {
    $('appConfirmYes').onclick = () => answer(true);
    $('appConfirmNo').onclick = () => answer(false);
    $('appConfirm').addEventListener('click', e => { if (e.target === $('appConfirm')) answer(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && asking) { e.stopImmediatePropagation(); answer(false); } }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
