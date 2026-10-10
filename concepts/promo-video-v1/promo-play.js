// Injected into `index.html?watch` by play-render.cjs. The bot's recorded
// run plays on the real board; this only watches it and draws on top:
//   - a log of what happened when (placements, merges, meals, the
//     elephant), so the edit can slow down for the right moments;
//   - the video's overlay: a finger on each placement, "EAT!" on a meal,
//     the fast-forward badge, the elephant's shadow in the corner that
//     turns into the real thing when one is born, and the end card.
// The game's rules and moves are untouched: the hooks call straight
// through and only record.
(function () {
  const log = [];
  const now = () => performance.now();      // the page clock, which the renderer drives

  // --- the log -----------------------------------------------------------
  const realGrow = growFrom;
  growFrom = function (i, cells, preview) {
    const real = !preview && (cells === undefined || cells === state.cells);
    const kind = real && state.cells[i] ? state.cells[i].kind : null;
    const grew = realGrow.apply(this, arguments);
    if (real) log.push({ t: now(), type: 'place', at: i, kind, grew: grew.map(g => ({ at: g.at, kind: g.kind })) });
    return grew;
  };
  const realFeed = feedEveryone;
  feedEveryone = function () {
    const meals = realFeed.apply(this, arguments);
    for (const m of meals) log.push({ t: now(), type: 'meal', at: m.at, ate: m.ate, kind: m.kind, ateKind: m.ateKind });
    return meals;
  };
  const realCelebrate = celebrate;
  celebrate = function () {
    log.push({ t: now(), type: 'celebrate' });
    return realCelebrate.apply(this, arguments);
  };
  // the bot's own messages stay out of a video meant to look like play
  const realTicker = setTicker;
  setTicker = function (text) {
    if (typeof text === 'string' && /\bbot\b/i.test(text)) text = 'Tap a square to plant.';
    return realTicker.apply(this, [text].concat([].slice.call(arguments, 1)));
  };

  // --- CSS animations on the page clock ---------------------------------
  // The renderer moves the page's clock by hand; CSS animations run on the
  // real one. Each is pinned to the page time it was first seen at.
  const born = new WeakMap();
  function seekAnimations() {
    const t = now();
    for (const a of document.getAnimations()) {
      if (!born.has(a)) born.set(a, t);
      a.pause();
      a.currentTime = t - born.get(a);
    }
  }

  // --- the overlay -------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = `
    .watch-badge, .first { display: none !important; }
    #pp { position: fixed; inset: 0; pointer-events: none; z-index: 100000; overflow: hidden; }
    #pp > * { position: absolute; left: 0; top: 0; will-change: transform, opacity; }
    .pp-finger { width: 64px; height: 84px; opacity: 0; }
    .pp-finger svg { width: 100%; height: 100%; filter: drop-shadow(0 4px 6px #0008); }
    .pp-ripple { width: 54px; height: 54px; border-radius: 50%; border: 3px solid #fff8d8; box-shadow: 0 0 14px #ffe58a; opacity: 0; }
    .pp-eat { font: 900 46px/1 'Fredoka', system-ui, sans-serif; color: #ffe066; -webkit-text-stroke: 3px #5a1414; paint-order: stroke fill;
      text-shadow: 0 4px 0 #5a1414, 0 0 24px #ff5a3c; letter-spacing: .02em; opacity: 0; white-space: nowrap; }
    .pp-slow { inset: 0; width: 100%; height: 100%; background: radial-gradient(ellipse at 50% 50%, #0000 45%, #1a0510cc 100%); opacity: 0; }
    .pp-slowtag { font: 700 13px/1 'Special Elite', monospace; color: #ffd6d6; letter-spacing: .2em; opacity: 0; }
    .pp-ff { font: 800 18px/1 'Fredoka', system-ui, sans-serif; color: #1d2a1f; background: #e9d58c; padding: 7px 12px; border-radius: 999px;
      box-shadow: 0 0 18px #e9d58c88; opacity: 0; white-space: nowrap; }
    .pp-ghost { width: 74px; height: 74px; border-radius: 22px; background: #120a1fdd; box-shadow: 0 0 0 2px #b98cff, 0 0 26px #b98cffaa;
      display: grid; place-items: center; overflow: hidden; }
    .pp-ghost img { width: 96px; height: auto; filter: brightness(0) drop-shadow(0 0 6px #b98cff); }
    .pp-ghost.is-real img { filter: none; }
    .pp-ghost b { position: absolute; inset: 0; display: grid; place-items: center; font: 700 44px/1 'Special Elite', monospace; color: #d6bcff;
      text-shadow: 0 0 14px #9d6cff; }
    .pp-ghost.is-real b { display: none; }
    .pp-ghost.is-real { box-shadow: 0 0 0 3px #ffd75e, 0 0 36px #ffd75e; background: #2a3a1ddd; }
    .pp-white { inset: 0; width: 100%; height: 100%; background: #fff; }
    .pp-end { inset: 0; width: 100%; height: 100%; opacity: 0; display: grid; place-items: center; align-content: center; gap: 14px; text-align: center;
      background: radial-gradient(ellipse at 50% 42%, #2c4a33 0%, #132218 55%, #070d09 100%); color: #f3e9c4; }
    .pp-end img { width: 300px; height: auto; margin: 0 auto 6px; }
    .pp-end .pp-q { position: absolute; left: 50%; top: 50%; font: 700 90px/1 'Special Elite', monospace; color: #d6bcff; text-shadow: 0 0 30px #9d6cff; }
    .pp-end h1 { margin: 0; font: 400 64px/1 'IM Fell English', Georgia, serif; letter-spacing: .01em; text-shadow: 0 4px 18px #000, 0 0 26px #ffd75e44; }
    .pp-end p { margin: 0; font: italic 400 22px/1.3 'IM Fell English', Georgia, serif; color: #e2d6ad; }
    .pp-end .pp-cta { margin-top: 14px; font: 800 20px/1 'Fredoka', system-ui, sans-serif; color: #1d2a1f; background: #e9d58c; padding: 12px 22px;
      border-radius: 999px; box-shadow: 0 0 24px #e9d58c66; justify-self: center; }
    .pp-end .pp-url { font: 400 14px/1 'Special Elite', monospace; color: #b9c7a6; letter-spacing: .04em; }
  `;
  document.head.appendChild(css);
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Special+Elite&display=swap';
  document.head.appendChild(fonts);

  const layer = document.createElement('div');
  layer.id = 'pp';
  const make = (cls, html) => { const n = document.createElement('div'); n.className = cls; if (html) n.innerHTML = html; layer.appendChild(n); return n; };
  const slow = make('pp-slow');
  const ripple = make('pp-ripple');
  // a plain pointing hand, drawn here so no emoji font is needed
  const finger = make('pp-finger', '<svg viewBox="0 0 64 84" aria-hidden="true"><path d="M24 6c4 0 7 3 7 7v24l3-1c3-1 6 1 7 3l2-1c3-1 6 1 7 4l2-1c3 0 6 2 6 6v14c0 12-9 20-21 20h-4c-8 0-14-4-18-11L6 52c-2-3-1-7 2-9s7-1 9 2l1 2V13c0-4 3-7 6-7z" fill="#fff" stroke="#2b2b2b" stroke-width="3" stroke-linejoin="round"/></svg>');
  const eat = make('pp-eat'); eat.textContent = 'EAT!';
  const slowtag = make('pp-slowtag'); slowtag.textContent = 'SLOW-MO';
  const ff = make('pp-ff');
  const ghost = make('pp-ghost', '<img src="concepts/promo-video-v1/hires/elephant-calm.png" alt=""><b>?</b>');
  const end = make('pp-end', '<img src="concepts/promo-video-v1/hires/elephant-calm.png" alt=""><h1>Bioconnect</h1><p>Two of a kind. One food chain.<br>Can you grow the Elephant?</p><div class="pp-cta">Play free in your browser</div><div class="pp-url">8w4jgy4rp5-commits.github.io/Bioconnect</div>');
  const white = make('pp-white');
  const endImg = end.querySelector('img');
  const endQ = document.createElement('div'); endQ.className = 'pp-q'; endQ.textContent = '?'; end.appendChild(endQ);
  document.body.appendChild(layer);

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  function put(n, x, y, scale = 1, opacity = 1, rot = 0) {
    n.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`;
    n.style.opacity = opacity;
  }
  function cellCenter(i) {
    const node = document.querySelector('#board [data-i="' + i + '"]');
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  }
  const main = document.querySelector('main.wrap');

  // Draws the overlay for this frame. `o` comes from the renderer:
  //   white   0..1 white cover (the cut from the intro)
  //   finger  true while placements should show a finger
  //   ff      fast-forward label or ''
  //   slow    0..1 slow-motion look; meal = the meal to point at
  //   zoom    {scale, at} to push in on a square
  //   ghost   'shadow' | 'real' | 'hide', with ghostPop 0..1
  //   end     0..1 end card
  function frame(o) {
    seekAnimations();
    const t = now();
    white.style.opacity = o.white || 0;

    // push in on a square: the page, not the overlay, is scaled
    if (o.zoom && o.zoom.scale > 1.001) {
      const c = cellCenter(o.zoom.at);
      main.style.transformOrigin = c ? `${c.x}px ${c.y}px` : '50% 50%';
      main.style.transform = `scale(${o.zoom.scale})`;
    } else main.style.transform = '';

    // finger: the latest placement within reach of now
    let shown = false;
    if (o.finger) {
      for (let k = log.length - 1; k >= 0; k--) {
        const e = log[k];
        if (e.type !== 'place') continue;
        const d = (t - e.t) / 1000;            // seconds since the tap, page time
        if (d < -.18 || d > .3) { if (d > .3) break; continue; }
        const c = cellCenter(e.at);
        if (!c) break;
        const press = d < 0 ? 1 + (-d / .18) * .25 : 1 - Math.sin(clamp(d / .12) * Math.PI) * .12;
        const fade = d < 0 ? 1 - (-d / .18) : 1 - clamp((d - .15) / .15);
        put(finger, c.x + 16 + (d < 0 ? -d * 60 : 0), c.y + 34 + (d < 0 ? -d * 80 : 0), press, fade, -18);
        const r = clamp(d / .3);
        put(ripple, c.x, c.y, .5 + easeOut(r) * 1.4, d >= 0 ? (1 - r) : 0);
        shown = true;
        break;
      }
    }
    if (!shown) { finger.style.opacity = 0; ripple.style.opacity = 0; }

    // slow motion and EAT!
    slow.style.opacity = o.slow || 0;
    if (o.meal && o.slow > 0) {
      const c = cellCenter(o.meal.at);
      if (c) {
        const p = clamp(o.eatPop || 0);
        put(eat, c.x - c.w * .95, c.y - c.w * .55, .4 + .6 * (p < .6 ? easeOut(p / .6) * 1.15 : 1.15 - (p - .6) * .375), clamp(o.slow * 1.5) * clamp(p * 4), -8);
      }
      put(slowtag, innerWidth / 2, 92, 1, o.slow);
    } else { eat.style.opacity = 0; slowtag.style.opacity = 0; }

    // fast-forward badge, under the score bar
    if (o.ff) { ff.textContent = o.ff; put(ff, innerWidth / 2, 92, 1, 1); } else ff.style.opacity = 0;

    // the elephant's shadow in the corner, and the reveal
    if (o.ghost === 'hide') ghost.style.opacity = 0;
    else {
      ghost.classList.toggle('is-real', o.ghost === 'real');
      const pop = o.ghostPop || 0;
      put(ghost, o.ghostX || 46, o.ghostY || 560, 1 + Math.sin(clamp(pop) * Math.PI) * .6, 1, Math.sin(t / 400) * 3);
    }

    // end card
    // end card: the elephant waits as a shadow, then shows itself
    end.style.opacity = o.end || 0;
    end.style.transform = `scale(${1.04 - .04 * easeOut(o.end || 0)})`;
    const rv = clamp(o.reveal || 0);
    endImg.style.filter = `brightness(${rv}) drop-shadow(0 0 ${24 * (1 - rv)}px #b98cff) drop-shadow(0 12px 18px #000a)`;
    endImg.style.transform = `scale(${1 + Math.sin(rv * Math.PI) * .12})`;
    put(endQ, 0, -120, 1 + Math.sin(rv * Math.PI) * .4, 1 - rv);
  }

  window.PromoPlay = { log, frame, seekAnimations };
})();
