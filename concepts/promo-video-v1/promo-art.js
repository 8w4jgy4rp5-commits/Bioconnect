// The game's own animals, moving the way they move on the board, drawn
// big enough for a 1080px video.
//
// Nothing about the animals is copied here. The game runs in a hidden
// iframe and this borrows from it:
//   - paintAnimal() and its rig, including each animal's gesture (the
//     rabbit's ear twitch, the wolf's howl, the tiger's stretch...);
//   - the CSS idles and breathing from style.css (rabbit bob, bear sway,
//     deer shiver...), copied rule by rule at load so they never drift;
//   - the plant symbols from index.html.
// Two things change, both only inside this page:
//   - the art is swapped for hires/ (see make-hires.py), because the game
//     keeps its animals at ~110px and a video tile is 720px;
//   - a tile is laid out at the game's own size (TILE) so the CSS idles
//     move exactly as far as they do on a phone, then scaled up, with the
//     canvas painted at the scaled-up resolution.
window.PromoArt = (() => {
  const TILE = 48;                       // a phone-sized board square, CSS px
  const PAD = .3;                        // extra canvas around it, in tiles
  const HIRES = {
    wolfCalm: 'wolf-calm', wolfHowl: 'wolf-howl', bearCalm: 'bear-calm', buffaloCalm: 'buffalo-calm',
    deerCalm: 'deer-calm', zebraCalm: 'zebra-calm', lionCalm: 'lion-calm', tigerCalm: 'tiger-calm',
    elephantCalm: 'elephant-calm'
  };
  const PLANTS = ['sprout', 'grass'];
  let game = null, gestures = {}, sprites = null;

  const load = src => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });

  async function ready(base = '../../') {
    // 1. the game, hidden
    const frame = document.createElement('iframe');
    frame.src = base + 'index.html';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px;height:844px;border:0;visibility:hidden';
    document.body.appendChild(frame);
    await new Promise(ok => frame.addEventListener('load', ok, { once: true }));
    game = frame.contentWindow;
    // const/let at the top of a classic script are not window properties,
    // but an eval in that window's global scope can still see them
    const peek = name => game.eval(name);
    for (let i = 0; i < 200 && !peek('spritesReady'); i++) await new Promise(ok => setTimeout(ok, 50));
    if (!peek('spritesReady')) throw new Error('game art did not load');
    sprites = peek('sprites');
    gestures = peek('ANIMAL_GESTURES');

    // 2. the sharp art, in the same frame as the game's
    await Promise.all(Object.entries(HIRES).map(async ([key, file]) => {
      const old = sprites[key];
      if (!old) return;
      sprites[key] = { img: await load('hires/' + file + '.png'), w: old.w, h: old.h };
    }));

    // 3. the plant symbols
    const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    for (const k of PLANTS) {
      const sym = game.document.getElementById('art' + k[0].toUpperCase() + k.slice(1));
      if (sym) holder.appendChild(document.importNode(sym, true));
    }
    document.body.appendChild(holder);

    // 4. the idles: every `.cell--<kind> .tile-art` / `.cell--<kind>` rule
    // and the keyframes they name, nothing else from the game's CSS
    const css = await (await fetch(base + 'style.css')).text();
    const sheet = new CSSStyleSheet();
    await sheet.replace(css.replace(/@import[^;]+;/g, ''));
    const keep = [], frames = new Set();
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule && /^\.cell--[a-z]+( \.tile-art)?$/.test(rule.selectorText)) {
        keep.push(rule.cssText);
        const anim = rule.style.getPropertyValue('animation') || rule.style.getPropertyValue('animation-name');
        for (const m of anim.matchAll(/(?:^|,)\s*([a-z][a-z-]+)/g)) frames.add(m[1]);
      }
    }
    for (const rule of sheet.cssRules) if (rule instanceof CSSKeyframesRule && frames.has(rule.name)) keep.push(rule.cssText);
    const style = document.createElement('style');
    style.textContent = '.pa-cell{--idle:2.5;--breath-rate:3s;--breath-depth:.03}\n' + keep.join('\n');
    document.head.appendChild(style);
  }

  // The game's gesture curve (animalMotion in script.js): ease into the
  // pose, hold it, settle back. `p` is 0..1 through the gesture.
  function gesture(kind, p) {
    if (!gestures[kind] || p <= 0 || p >= 1) return null;
    const smooth = x => x * x * (3 - 2 * x);
    const amount = p < .22 ? smooth(p / .22) : p > .72 ? smooth((1 - p) / .28) : 1;
    return { amount, progress: p };
  }
  const gestureLength = kind => gestures[kind] ? gestures[kind].duration : 0;

  // One tile: `size` is its width on the 1080px stage.
  function tile(size) {
    const root = document.createElement('div');
    root.className = 'pa-tile';
    root.style.cssText = `width:${size}px;height:${size}px`;
    const scale = size / TILE;
    const scaler = document.createElement('div');
    scaler.style.cssText = `width:${TILE}px;height:${TILE}px;transform:scale(${scale});transform-origin:0 0`;
    const cell = document.createElement('div');
    cell.style.cssText = `width:${TILE}px;height:${TILE}px;position:relative`;
    // the canvas reaches past the square on every side: a twitching ear
    // or a raised head leaves the tile, which on a 48px board nobody
    // sees clipped and on a 720px video everybody would
    const pad = PAD * TILE;
    scaler.appendChild(cell); root.appendChild(scaler);
    let kind = '', art = null;

    function set(next) {
      if (next === kind) return;
      kind = next;
      cell.className = 'pa-cell cell--' + kind;
      cell.textContent = '';
      if (PLANTS.includes(kind)) {
        art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        art.setAttribute('viewBox', '0 0 40 40');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#art' + kind[0].toUpperCase() + kind.slice(1));
        art.appendChild(use);
      } else {
        art = document.createElement('canvas');
        art.width = art.height = Math.round(size * (1 + 2 * PAD) * Math.min(2, window.devicePixelRatio || 1));
      }
      art.setAttribute('class', 'tile-art');
      art.style.cssText = art.tagName === 'CANVAS'
        ? `display:block;position:absolute;left:${-pad}px;top:${-pad}px;width:${TILE + 2 * pad}px;height:${TILE + 2 * pad}px`
        : 'display:block;width:100%;height:100%';
      cell.appendChild(art);
      if (art.tagName === 'CANVAS') {
        // the game's idles pivot on the square (its feet, or the
        // buffalo's rump); keep that pivot now the canvas is bigger
        const box = TILE + 2 * pad, [ox, oy] = getComputedStyle(art).transformOrigin.split(' ').map(parseFloat);
        art.style.transformOrigin = `${pad + ox / box * TILE}px ${pad + oy / box * TILE}px`;
      }
    }

    // paintAnimal sizes its drawing from clientWidth and the device pixel
    // ratio. It is handed a stand-in canvas that reports the game's tile
    // size, and every transform it sets is scaled up to the real canvas.
    function paint(motion) {
      if (!art || art.tagName !== 'CANVAS') return;
      const real = art.getContext('2d');
      const dpr = Math.min(3, game.devicePixelRatio || 1);
      const up = art.width / ((TILE + 2 * pad) * dpr), shift = pad * dpr * up;
      real.setTransform(1, 0, 0, 1, 0, 0);
      real.clearRect(0, 0, art.width, art.height);
      const ctx = new Proxy(real, {
        get(t, p) {
          if (p === 'setTransform') return (a, b, c, d, e, f) => t.setTransform(a * up, b * up, c * up, d * up, e * up + shift, f * up + shift);
          const v = t[p];
          return typeof v === 'function' ? v.bind(t) : v;
        },
        set(t, p, v) { t[p] = v; return true; }
      });
      game.paintAnimal({ clientWidth: TILE, width: TILE * dpr, height: TILE * dpr, getContext: () => ctx }, kind, 1, motion);
    }
    return { root, set, paint, get kind() { return kind; } };
  }

  // For frame-by-frame rendering: hold every CSS idle at time t.
  function seek(t) {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
  }

  return { ready, tile, gesture, gestureLength, seek, TILE };
})();
