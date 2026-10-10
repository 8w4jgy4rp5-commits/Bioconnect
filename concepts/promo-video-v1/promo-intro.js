// Bioconnect promo intro: two of a kind merge into the next animal, faster
// and faster up the ladder, until two tigers freeze, the music stops, and
// "Next is…?" shows the elephant as a shadow. Then the screen goes white.
//
// render(t) draws the frame for t seconds in, with no hidden state, so the
// live preview and the frame-by-frame video render show the same thing.
window.PromoIntro = (() => {
  const BEAT = PromoSound.BEAT;
  const LADDER = ['sprout', 'grass', 'rabbit', 'fox', 'deer', 'zebra', 'buffalo', 'wolf', 'bear', 'lion', 'tiger', 'elephant'];
  const NAMES = { sprout: 'Sprout', grass: 'Grass', rabbit: 'Rabbit', fox: 'Fox', deer: 'Deer', zebra: 'Zebra', buffalo: 'Buffalo', wolf: 'Wolf', bear: 'Bear', lion: 'Lion', tiger: 'Tiger', elephant: 'Elephant' };
  // merge i turns LADDER[i] into LADDER[i + 1]; slow, then on every beat,
  // then on every half beat, so the pops become a drum roll
  const CUE = {
    merges: [2, 4, 6, 7, 8, 9, 10, 10.5, 11, 11.5],
    popNotes: [69, 70, 72, 74, 76, 77, 79, 81, 82, 86],
    freezeBeat: 13,
    flashBeat: 16,
    endBeat: 17
  };
  const DURATION = CUE.endBeat * BEAT;

  const W = 1080, H = 1920, CX = W / 2, CY = 1010;
  const TILE_PX = 720, APART = 270, MEET = 80;

  let root, els = {};
  function mount(stage) {
    root = stage;
    stage.innerHTML = '';
    const make = (cls, parent = stage, tag = 'div') => { const n = document.createElement(tag); n.className = cls; parent.appendChild(n); return n; };
    els.bg = make('pi-bg');
    els.fog1 = make('pi-fog pi-fog--a'); els.fog2 = make('pi-fog pi-fog--b');
    els.eyes = [0, 1, 2, 3].map(i => { const e = make('pi-eye pi-eye--' + i); make('pi-pupil', e); return e; });
    els.tagline = make('pi-tagline'); els.tagline.textContent = 'Two of a kind…';
    els.ladder = make('pi-ladder');
    els.slots = LADDER.map(k => {
      const s = make('pi-slot', els.ladder);
      const im = make('pi-slot-img', s, 'img'); im.src = 'sprites/' + k + '.png'; im.alt = '';
      if (k === 'elephant') { const q = make('pi-slot-q', s); q.textContent = '?'; }
      return s;
    });
    els.burst = make('pi-burst');
    els.ring = make('pi-ring');
    els.sparks = Array.from({ length: 14 }, () => make('pi-spark'));
    els.ghost = make('pi-ghost', stage, 'img'); els.ghost.src = 'hires/elephant-calm.png'; els.ghost.alt = '';
    // the game's own animals, idles and gestures included (promo-art.js)
    els.tiles = [0, 1, 2].map(i => {
      const t = PromoArt.tile(TILE_PX);
      t.root.classList.add('pi-tile');
      if (i === 1) t.root.style.setProperty('--twin', '1');   // the right twin breathes out of step
      stage.appendChild(t.root);
      return t;
    });
    [els.left, els.right, els.center] = els.tiles.map(t => t.root);
    els.name = make('pi-name');
    els.next = make('pi-next'); els.next.textContent = 'Next is…?';
    els.q = make('pi-q'); els.q.textContent = '?';
    els.dim = make('pi-dim');
    els.flash = make('pi-flash');
  }

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeIn = x => x * x * x;
  const backOut = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  function place(n, x, y, scale = 1, rot = 0, opacity = 1) {
    n.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`;
    n.style.opacity = opacity;
  }

  // which merge segment we are in: the animal on show and how far along
  function segment(beat) {
    const m = CUE.merges;
    if (beat < m[0]) return { kind: 0, start: -0.5, end: m[0], sinceMerge: 99 };
    for (let i = 0; i < m.length; i++) {
      const end = i + 1 < m.length ? m[i + 1] : CUE.freezeBeat;
      if (beat < end || i === m.length - 1) return { kind: i + 1, start: m[i], end, sinceMerge: beat - m[i] };
    }
  }

  function render(t) {
    const beat = t / BEAT;
    const frozen = beat >= CUE.freezeBeat;
    const b = Math.min(beat, CUE.freezeBeat);      // the world stops at the freeze
    const seg = segment(b);
    const kind = LADDER[seg.kind];
    const span = seg.end - seg.start;
    const p = clamp((b - seg.start) / span);

    // background drift and blinking eyes keep going a little even when frozen
    place(els.fog1, 300 + Math.sin(t * .5) * 80, 700 + Math.cos(t * .4) * 60, 1, 0, .55);
    place(els.fog2, 800 + Math.cos(t * .45) * 90, 1500 + Math.sin(t * .35) * 70, 1, 0, .45);
    els.eyes.forEach((e, i) => {
      const blink = ((t + i * .73) % 2.3) < .12 ? .1 : 1;
      const open = clamp((t - .3 - i * .25) * 3);
      e.style.transform = `translate(-50%,-50%) scaleY(${blink * open})`;
      e.firstChild.style.transform = `translate(${Math.sin(t * 1.3 + i) * 7 + (frozen ? 10 : 0)}px,${Math.cos(t + i) * 4}px)`;
    });

    // the two that are about to merge
    let gap;
    if (seg.kind === 0) gap = APART + (1 - easeOut(clamp((b + .5) / 1))) * 400 - easeIn(clamp((b - 1) / 1)) * (APART - MEET);
    else {
      // after a pop: the newborn bounces in the middle, splits in two, and
      // the pair rushes back together for the next pop
      const last = seg.kind === LADDER.length - 2;     // the tigers split and wait
      const split = clamp((p - .3) / .3), rush = last ? 0 : clamp((p - .62) / .38);
      gap = easeOut(split) * (last ? APART + 90 : APART) - easeIn(rush) * (APART - MEET);
    }
    const born = seg.kind > 0 ? clamp(seg.sinceMerge / Math.min(.6, span * .5)) : 1;
    const bounce = seg.kind > 0 ? backOut(born) : 1;
    const showPair = seg.kind === 0 || p > .3 || frozen;
    // at the freeze the tigers sink and shrink to make room for the shadow
    const sink = frozen ? easeOut(clamp((beat - CUE.freezeBeat) * BEAT / .35)) : 0;
    const ty = CY + sink * 420, ts = 1 - sink * .4;
    // each animal's own gesture, played once while it is on show: at its
    // real speed when there is time, hurried up to 4x when there is not,
    // and left to the idle alone when even that is too fast to read
    let motion = null;
    const g = PromoArt.gestureLength(kind);
    if (g) {
      if (frozen) motion = PromoArt.gesture(kind, (beat - CUE.freezeBeat) * BEAT * 2 / g);
      else if (seg.kind > 0) {
        const speed = Math.max(1, g / (span * BEAT * .9));
        if (speed <= 4) motion = PromoArt.gesture(kind, (b - seg.start) * BEAT * speed / g);
      }
    }
    for (const tl of els.tiles) { tl.set(kind); tl.paint(motion); }
    if (showPair) {
      const g2 = frozen ? 250 + (1 - sink) * (APART + 90 - 250) : gap;   // held apart while frozen
      place(els.left, CX - g2, ty, ts, 0, 1);
      place(els.right, CX + g2, ty, ts, 0, 1);
      els.right.style.transform += ' scaleX(-1)';
      place(els.center, CX, CY, 1, 0, 0);
    } else {
      place(els.left, CX, CY, 1, 0, 0); place(els.right, CX, CY, 1, 0, 0);
      place(els.center, CX, CY - (1 - born) * 40, .25 + .75 * bounce, 0, 1);
    }

    // pop burst
    const since = seg.sinceMerge * BEAT;           // seconds since the last pop
    const burst = seg.kind > 0 && since < .45 ? since / .45 : 1;
    place(els.ring, CX, CY, .3 + easeOut(burst) * 1.6, 0, (1 - burst) * .9);
    place(els.burst, CX, CY, .5 + easeOut(burst) * 1.1, 0, (1 - burst) * .8);
    els.sparks.forEach((s, i) => {
      const a = (i / els.sparks.length) * Math.PI * 2 + seg.kind * .9;
      const r = 120 + easeOut(burst) * (260 + (i * 37 % 90));
      place(s, CX + Math.cos(a) * r, CY + Math.sin(a) * r, 1 - burst * .6, a * 57.3, (1 - burst));
    });

    // the animal's name, popping with each merge
    els.name.textContent = seg.kind > 0 ? NAMES[kind] + '!' : NAMES.sprout;
    const nameIn = seg.kind > 0 ? backOut(clamp(since / .25)) : clamp(t / .4);
    place(els.name, CX, 1450, .6 + .4 * nameIn, 0, frozen ? 0 : 1);

    // the ladder across the top fills in as animals are reached
    els.slots.forEach((s, i) => {
      const reached = i <= seg.kind;
      s.classList.toggle('is-lit', reached);
      s.classList.toggle('is-now', i === seg.kind && !frozen);
      s.classList.toggle('is-next', frozen && i === LADDER.length - 1);
    });
    els.tagline.style.opacity = clamp(1 - (beat - 5) / 1) * clamp(t / .4);

    // the freeze: dark, a heartbeat, and the elephant as a shadow
    const f = frozen ? (beat - CUE.freezeBeat) * BEAT : -1;
    els.dim.style.opacity = frozen ? Math.min(.55, f * 4) : 0;
    root.classList.toggle('is-frozen', frozen);
    const beatPulse = x => x >= 0 && x < .35 ? Math.sin(x / .35 * Math.PI) : 0;
    const pulse = frozen ? Math.max(beatPulse(f), beatPulse(f - 1.5 * BEAT) * .8) : 0;
    root.style.setProperty('--pulse', 1 + pulse * .035);
    const gIn = frozen ? backOut(clamp(f / .5)) : 0;
    place(els.ghost, CX, 860 + Math.sin(t * 2.2) * 10, (.5 + .5 * gIn) * (1 + pulse * .08), Math.sin(t * 3) * 2, frozen ? clamp(f / .25) : 0);
    place(els.next, CX, 470, .7 + .3 * backOut(clamp(f / .35)), 0, frozen ? clamp(f / .2) : 0);
    place(els.q, CX + 10, 840, (1 + pulse * .3) * (frozen ? backOut(clamp((f - .25) / .4)) : 0), Math.sin(t * 4) * 6, frozen ? clamp((f - .2) / .2) : 0);

    // white flash
    const toFlash = (beat - (CUE.flashBeat - 1)) * BEAT;   // starts a beat before
    els.flash.style.opacity = clamp(easeIn(clamp(toFlash / (BEAT + .02))));
  }

  return { CUE, DURATION, mount, render, LADDER };
})();
