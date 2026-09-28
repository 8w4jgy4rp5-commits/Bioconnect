// Audio is opt-in, with separate music/effect switches. No network assets.
window.BioAudio = (() => {
  let ctx, synth, sfx = false, music = false, paused = true;
  let timer = 0, beat = 0, nextTime = 0, lastEffect = -1;

  function context() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !window.BioSound) return null;
      if (!ctx) { ctx = new AC(); synth = window.BioSound.create(ctx); ctx.onstatechange = sync; }
      if (ctx.state !== 'running') ctx.resume().then(sync).catch(() => {});
      return ctx;
    } catch (_) { return null; }
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    // A stalled tab skips silence rather than bursting through missed notes.
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + .035;
    while (nextTime < ctx.currentTime + .16) {
      synth.musicBeat(beat, nextTime);
      beat = (beat + 1) % window.BioSound.BEATS;
      nextTime += window.BioSound.BEAT;
    }
  }

  function sync() {
    const active = music && !paused && !document.hidden && ctx && ctx.state === 'running';
    if (active && !timer) {
      nextTime = ctx.currentTime + .04;
      schedule(); timer = setInterval(schedule, 50);
    } else if (!active && timer) {
      clearInterval(timer); timer = 0;
      synth.cancel('music');
    }
  }

  function showButtons() {
    for (const type of ['sound', 'music']) {
      const button = document.getElementById(type + 'Toggle');
      if (!button) continue;
      const on = type === 'sound' ? sfx : music;
      button.textContent = (type === 'sound' ? 'Sound' : 'Music') + ': ' + (on ? 'On' : 'Off');
      button.setAttribute('aria-pressed', String(on));
    }
    const titleButton = document.getElementById('startSoundBtn');
    if (titleButton) {
      titleButton.setAttribute('aria-pressed', String(sfx));
      titleButton.setAttribute('aria-label', 'Sound: ' + (sfx ? 'on' : 'off'));
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (synth) synth.cancel();
      sync();
      if (ctx) ctx.suspend().catch(() => {});
    } else if (ctx && (sfx || music)) {
      ctx.resume().then(sync).catch(() => {});
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    for (const type of ['sound', 'music']) {
      const button = document.getElementById(type + 'Toggle');
      if (!button) continue;
      button.addEventListener('click', () => {
        if (!context()) { button.textContent = 'Audio unavailable'; return; }
        if (type === 'sound') {
          sfx = !sfx;
          if (!sfx) synth.cancel('effects');
          else ctx.resume().then(() => { if (sfx && !document.hidden) synth.effect('preview'); }).catch(() => {});
        } else {
          music = !music;
          if (!music) synth.cancel('music');
        }
        showButtons(); sync();
      });
    }
    showButtons();
  });

  return {
    pause(on) {
      if (paused === on) return;
      paused = on;
      if (on && synth) synth.cancel();
      sync();
    },
    reset() {
      if (synth) synth.cancel();
      clearInterval(timer); timer = 0; beat = 0; lastEffect = -1;
      sync();
    },
    effect(kind, count = 1) {
      if (!sfx || document.hidden || !ctx || ctx.state !== 'running') return;
      if (paused && kind !== 'ready' && kind !== 'go') return;
      // Replace the preceding move's queued pops on a rapid new placement.
      if (kind === 'place') { synth.cancel('effects'); lastEffect = ctx.currentTime; }
      if (kind === 'eat' && ctx.currentTime - lastEffect < .45) return;
      if (kind === 'merge' || kind === 'finish') lastEffect = ctx.currentTime + Math.min(11, count) * .145;
      synth.effect(kind, count);
    }
  };
})();
