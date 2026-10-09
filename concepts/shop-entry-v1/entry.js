// Shop entrance concepts (2026-10-09). Loads the real title screen in a frame
// and adds one entrance on top of it; the game's own files are not changed.
// Tapping an entrance clicks the game's hidden store button.
(function () {
  const variant = document.documentElement.dataset.variant;
  const frame = document.getElementById('game');
  const GEM = '<svg viewBox="0 0 20 24" aria-hidden="true"><path d="M10 1 19 9 10 23 1 9Z" fill="#c9e88a"/><path d="M10 1 19 9H1Z" fill="#eef8d6"/><path d="M10 23 19 9H10Z" fill="#7fa548"/><path d="M10 1 19 9 10 23 1 9Z" fill="none" stroke="#0b0e09" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  const CSS = {
    icon: `
      .entry-gem svg { width: 22px; height: 26px; filter: drop-shadow(0 0 5px rgba(201,232,138,.55)); }
      .entry-gem { position: relative; }
      .entry-dot { position: absolute; top: -3px; right: -3px; width: 12px; height: 12px; border-radius: 50%; background: #c9e88a; box-shadow: 0 0 0 2px #10150e, 0 0 8px #c9e88a; }`,
    wallet: `
      .start-topline { align-items: center; }
      .entry-wallet { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 6px 0 12px; border: 0; border-radius: 999px; cursor: pointer;
        background: rgba(0,0,0,.35); box-shadow: inset 0 0 0 1px rgba(201,232,138,.45); color: #c9e88a; font: 1rem "IM Fell English SC", Georgia, serif; }
      .entry-wallet svg { width: 15px; height: 18px; }
      .entry-wallet .entry-n { font: 15px "Special Elite", "Courier New", monospace; }
      .entry-plus { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #a8c66c; color: #10150e; font: 700 20px/1 Georgia, serif; box-shadow: 0 2px 0 #6f8a3e; }`,
    scene: `
      .entry-crystal { position: absolute; z-index: 4; left: 52%; bottom: 11%; transform: translateX(-50%); display: grid; justify-items: center; gap: 2px;
        min-width: 64px; padding: 6px 8px; border: 0; background: none; cursor: pointer; color: #c9e88a; font: italic 13px "IM Fell English", Georgia, serif; }
      .entry-crystal svg { width: 34px; height: 41px; filter: drop-shadow(0 0 10px rgba(201,232,138,.8)); animation: entry-glow 2.6s ease-in-out infinite; }
      .entry-crystal::before { content: ""; position: absolute; left: 50%; top: 18px; width: 70px; height: 70px; transform: translate(-50%, -50%); border-radius: 50%;
        background: radial-gradient(circle, rgba(201,232,138,.28), transparent 65%); pointer-events: none; }
      @keyframes entry-glow { 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(201,232,138,1)); } }
      @media (prefers-reduced-motion: reduce) { .entry-crystal svg { animation: none; } }`
  };
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument, win = frame.contentWindow;
    const style = doc.createElement('style');
    style.textContent = '#startShopBtn { display: none !important; }' + CSS[variant];
    doc.head.append(style);
    const open = () => doc.getElementById('startShopBtn')?.click();
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.addEventListener('click', open);
    if (variant === 'icon') {
      btn.className = 'start-icon entry-gem';
      btn.setAttribute('aria-label', 'Crystals and No Ads (3 free Crystals waiting)');
      btn.innerHTML = GEM + '<span class="entry-dot"></span>';
      doc.querySelector('.start-minor').append(btn);
    } else if (variant === 'wallet') {
      btn.className = 'entry-wallet';
      btn.setAttribute('aria-label', 'You hold 0 Crystals. Open the store');
      btn.innerHTML = GEM + '<span class="entry-n">0</span><span class="entry-plus" aria-hidden="true">+</span>';
      doc.querySelector('.start-best').after(btn);
    } else {
      btn.className = 'entry-crystal';
      btn.setAttribute('aria-label', 'Crystals and No Ads');
      btn.innerHTML = GEM + '<span>crystals</span>';
      doc.querySelector('.start-meadow').append(btn);
      // the meadow row ignores taps; let this one button through
      doc.querySelector('.start-meadow').removeAttribute('aria-hidden');
      style.textContent += '.start-meadow > :not(.entry-crystal) { pointer-events: none; } .entry-crystal { pointer-events: auto; }';
    }
    win.__entryReady = true;
  });
})();
