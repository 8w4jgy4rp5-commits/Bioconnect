// Music and effects are always on; the device's silent mode is the switch.
// Browsers hold audio until the first touch or key, so that unlocks it.
window.BioAudio = (() => {
  let ctx, synth, paused = true, theme = 'title';
  let timer = 0, beat = 0, nextTime = 0, lastEffect = -1;
  const discovered = new Set();
  let playingKinds = [];

  // Safari: "ambient" obeys the ring/silent switch and mixes with other audio.
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (_) {}

  function context() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !window.BioSound) return null;
      if (!ctx) { ctx = new AC(); synth = window.BioSound.create(ctx); ctx.onstatechange = sync; }
      if (ctx.state !== 'running' && !document.hidden) ctx.resume().then(sync).catch(() => {});
      return ctx;
    } catch (_) { return null; }
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    // A stalled tab skips silence rather than bursting through missed notes.
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + .035;
    while (nextTime < ctx.currentTime + .16) {
      // Join on the next bar without restarting the tune or its tempo.
      if (theme === 'game' && beat % 4 === 0) playingKinds = [...discovered];
      synth.musicBeat(beat, nextTime, theme, playingKinds);
      beat = (beat + 1) % window.BioSound.BEATS;
      nextTime += window.BioSound.beatLength(theme);
    }
  }

  // The title plays a music-box arrangement of the meadow tune, the
  // countdown is quiet ('rest'), and the game plays the full band.
  // Otherwise only a hidden tab silences it.
  function sync() {
    const active = !document.hidden && ctx && ctx.state === 'running' && theme !== 'rest';
    if (active && !timer) {
      nextTime = ctx.currentTime + .04;
      schedule(); timer = setInterval(schedule, 50);
    } else if (!active && timer) {
      clearInterval(timer); timer = 0;
      synth.cancel('music');
    }
  }

  const unlockEvents = ['pointerdown', 'touchend', 'keydown', 'click'];
  function unlock() {
    if (context() && ctx.state === 'running') {
      unlockEvents.forEach(type => document.removeEventListener(type, unlock, true));
    }
  }
  unlockEvents.forEach(type => document.addEventListener(type, unlock, true));
  // Some browsers allow sound on open without a touch; try right away.
  document.addEventListener('DOMContentLoaded', () => { if (context()) sync(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (synth) synth.cancel();
      sync();
      if (ctx) ctx.suspend().catch(() => {});
    } else if (ctx) {
      ctx.resume().then(sync).catch(() => {});
    }
  });

  return {
    discover(kinds) {
      const known = new Set((window.BioSound && window.BioSound.instruments || []).map(i => i.kind));
      for (const kind of Array.isArray(kinds) ? kinds : [kinds]) {
        if (known.has(kind)) discovered.add(kind);
      }
    },
    band() { return { discovered: [...discovered], playing: playingKinds.slice(), theme }; },
    theme(name) {
      if (theme === name) return;
      theme = name;
      if (synth) synth.cancel('music');
      clearInterval(timer); timer = 0; beat = 0;
      sync();
    },
    pause(on) {
      if (paused === on) return;
      paused = on;
      if (on && synth) synth.cancel('effects');
    },
    reset() {
      discovered.clear(); playingKinds = [];
      if (synth) { synth.cancel(); synth.setEnsemble([], ctx.currentTime); }
      clearInterval(timer); timer = 0; beat = 0; lastEffect = -1;
      sync();
    },
    effect(kind, count = 1) {
      if (document.hidden || !ctx || ctx.state !== 'running') return;
      if (paused && kind !== 'ready' && kind !== 'go' && kind !== 'gameover') return;
      // Replace the preceding move's queued pops on a rapid new placement.
      if (kind === 'place') { synth.cancel('effects'); lastEffect = ctx.currentTime; }
      if (kind === 'eat' && ctx.currentTime - lastEffect < .45) return;
      if (kind === 'merge' || kind === 'finish') lastEffect = ctx.currentTime + Math.min(11, count) * .145;
      synth.effect(kind, count);
    }
  };
})();
