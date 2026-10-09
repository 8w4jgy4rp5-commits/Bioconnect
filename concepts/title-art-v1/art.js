// Title art concepts (2026-10-09). Loads the real title screen in a frame and
// changes only how the animals sit in the meadow. No new images; the game's
// files are not changed. Goal: the animals should not look cut out and pasted.
(function () {
  const variant = document.documentElement.dataset.variant;
  const frame = document.getElementById('game');
  const FAR = ['zebra', 'elephant'];            // stand on the mountain
  const HILL = { far: '#24301d', near: '#1a2414' }; // eldritch.css hill colors

  // a tuft of grass blades, drawn in the hill's own color so it reads as ground
  function tuft(color, seed) {
    let d = '', x = 0, r = seed;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    while (x < 100) {
      const w = 3 + rnd() * 4, h = 30 + rnd() * 70, lean = (rnd() - .5) * 10;
      d += `M${x} 100 Q${x + w / 2 + lean / 2} ${100 - h / 2} ${x + w / 2 + lean} ${100 - h} Q${x + w / 2} ${100 - h / 2} ${x + w} 100Z`;
      x += w * .7;
    }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="${color}"/><rect y="88" width="100" height="12" fill="${color}"/></svg>`;
  }

  const CSS = {
    blend: `
      /* moonlight grade: cooler, darker, a lit edge toward the moon (upper right) */
      .skin-eldritch .start-critter { filter: saturate(.5) brightness(.6) sepia(.12)
        drop-shadow(1.2px -1px 0 rgba(241,234,208,.38)) drop-shadow(0 0 1px rgba(10,14,8,.6)); }
      .skin-eldritch .start-critter--zebra, .skin-eldritch .start-critter--elephant {
        filter: saturate(.4) brightness(.5) sepia(.1) blur(.25px) drop-shadow(1px -1px 0 rgba(241,234,208,.28)); }
      .art-shadow { position: absolute; left: var(--x); bottom: calc(var(--y) - 4px); width: var(--w); height: 12px; translate: -50% 0;
        border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.65), transparent); }
      .art-tuft { position: absolute; left: var(--x); bottom: calc(var(--y) - 6px); width: var(--w); height: var(--h); translate: -50% 0; z-index: 2; pointer-events: none; }
      .art-tuft svg { display: block; width: 100%; height: 100%; }
      .start-critter { z-index: 1; }
      .art-mist { position: absolute; left: 0; right: 0; bottom: 4%; height: 34%; z-index: 3; pointer-events: none;
        background: radial-gradient(60% 40% at 30% 70%, rgba(200,214,170,.10), transparent 70%), radial-gradient(50% 35% at 80% 60%, rgba(200,214,170,.08), transparent 70%),
          linear-gradient(transparent, rgba(160,180,140,.07) 50%, transparent); filter: blur(4px); }
      .art-mist--far { bottom: 42%; height: 14%; opacity: .45; }`,
    silhouette: `
      .skin-eldritch .start-sun { display: none; }
      .art-moon { position: absolute; left: 50%; bottom: 38%; width: 62cqh; height: 62cqh; max-width: 250px; max-height: 250px; translate: -50% 0; border-radius: 50%;
        background: radial-gradient(circle, #f4efd8 0 52%, #d9d2b0 63%, rgba(241,234,208,.18) 66%, transparent 74%); opacity: .9; }
      .art-moon::after { content: ""; position: absolute; inset: 18% 26% 50% 40%; border-radius: 50%; background: rgba(170,160,120,.18); box-shadow: -40px 50px 0 -6px rgba(170,160,120,.14); }
      .skin-eldritch .start-mountain { fill: #0f140c; }
      .skin-eldritch .start-knolls { fill: #0a0e08; stroke: rgba(241,234,208,.22); }
      .skin-eldritch .start-critter { filter: brightness(0) drop-shadow(1.5px -1px 0 rgba(241,234,208,.55)) drop-shadow(0 0 8px rgba(241,234,208,.12)); }
      .skin-eldritch .start-critter--zebra, .skin-eldritch .start-critter--elephant { filter: brightness(0) drop-shadow(0 0 1px rgba(241,234,208,.5)); }`,
    eyes: `
      .skin-eldritch .start-critter { display: none; }
      .skin-eldritch .start-critter--elephant { display: block; filter: brightness(.16) saturate(0) drop-shadow(1px -1px 0 rgba(241,234,208,.22)); }
      .art-tuft { position: absolute; left: var(--x); bottom: calc(var(--y) - 6px); width: var(--w); height: var(--h); translate: -50% 0; z-index: 2; }
      .art-tuft svg { display: block; width: 100%; height: 100%; }
      .art-eyes { position: absolute; left: var(--x); bottom: var(--y); translate: -50% 0; z-index: 3; display: flex; gap: var(--gap); rotate: var(--tilt, 0deg); }
      .art-eyes i { width: var(--s); height: calc(var(--s) * .62); border-radius: 50%; background: radial-gradient(circle at 50% 50%, #0b0e09 0 22%, var(--c) 26%);
        box-shadow: 0 0 8px var(--c), 0 0 18px color-mix(in srgb, var(--c) 45%, transparent); animation: art-blink var(--blink, 5s) infinite; animation-delay: var(--d, 0s); transform-origin: 50% 50%; }
      .art-eyes--slant i:first-child { rotate: 14deg; } .art-eyes--slant i:last-child { rotate: -14deg; }
      @keyframes art-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.08); } }
      @media (prefers-reduced-motion: reduce) { .art-eyes i { animation: none; } }`
  };

  frame.addEventListener('load', () => {
    const doc = frame.contentDocument, win = frame.contentWindow;
    const meadow = doc.querySelector('.start-meadow');
    const style = doc.createElement('style');
    style.textContent = CSS[variant];
    doc.head.append(style);
    const add = (html) => meadow.insertAdjacentHTML('beforeend', html);
    const critters = [...meadow.querySelectorAll('.start-critter')];

    if (variant === 'blend') {
      add('<div class="art-mist art-mist--far"></div>');
      critters.forEach((img, i) => {
        const kind = img.className.match(/--(\w+)/)[1], far = FAR.includes(kind);
        const w = img.getBoundingClientRect().width;
        const pos = `--x:${img.style.getPropertyValue('--x')};--y:${img.style.getPropertyValue('--y')};`;
        img.insertAdjacentHTML('beforebegin', `<div class="art-shadow" style="${pos}--w:${w * .9}px"></div>`);
        add(`<div class="art-tuft" style="${pos}--w:${w * 1.3}px;--h:${far ? 20 : 26}px">${tuft(far ? HILL.far : HILL.near, i * 37 + 11)}</div>`);
      });
      add('<div class="art-mist"></div>');
    } else if (variant === 'silhouette') {
      meadow.insertAdjacentHTML('afterbegin', '<div class="art-moon"></div>');
    } else {
      // grass to hide in, then eyes: small and close for rabbit and fox, gold for the lion
      [['21%', '23%', 110, 30], ['50%', '15%', 120, 24], ['86%', '19%', 120, 30]].forEach(([x, y, w, h], i) =>
        add(`<div class="art-tuft" style="--x:${x};--y:${y};--w:${w}px;--h:${h}px">${tuft(HILL.near, i * 53 + 7)}</div>`));
      const eyes = [
        { x: '20%', y: '27%', s: 11, gap: 10, c: '#f1c66a', d: '0s', blink: '6s' },            // lion
        { x: '78%', y: '25%', s: 8, gap: 6, c: '#e8a050', d: '1.4s', slant: true },            // fox
        { x: '91%', y: '24%', s: 6, gap: 5, c: '#ece4c8', d: '2.6s', blink: '3.4s' },          // rabbit
        { x: '37%', y: '68%', s: 7, gap: 7, c: '#c9e88a', d: '.8s', blink: '7s' },             // zebra, far on the ridge
        { x: '50%', y: '20%', s: 6, gap: 6, c: '#8d6896', d: '3.2s', blink: '4.4s' }           // something small in the grass
      ];
      for (const e of eyes) add(`<div class="art-eyes${e.slant ? ' art-eyes--slant' : ''}" style="--x:${e.x};--y:${e.y};--s:${e.s}px;--gap:${e.gap}px;--c:${e.c};--d:${e.d};--blink:${e.blink || '5s'}"><i></i><i></i></div>`);
    }
    win.__artReady = true;
  });
})();
