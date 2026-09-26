// Original synthesized music and effects, no external audio assets.
window.BioAudio = (() => {
  let ctx, sfx = false, music = false, paused = false, timer = 0, beat = 0;
  const melody = [60,64,67,72,67,64,62,67,59,62,67,71,67,62,60,64];
  function context() {
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = ctx || new AC(); ctx.resume().catch(() => {}); return ctx; } catch (_) { return null; }
  }
  function note(midi, delay = 0, length = .22, volume = .045) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + delay, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, t + length);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t + length + .02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  function sync() {
    clearInterval(timer); timer = 0;
    if (!music || paused || document.hidden) return;
    timer = setInterval(() => { if (paused || document.hidden) return; note(melody[beat % melody.length], 0, .48, .025); if (beat % 4 === 0) note(48, 0, .9, .018); beat++; }, 420);
  }
  document.addEventListener('visibilitychange', () => { sync(); if (ctx && document.hidden) ctx.suspend().catch(() => {}); else if (ctx && (sfx || music)) ctx.resume().catch(() => {}); });
  document.addEventListener('DOMContentLoaded', () => {
    for (const type of ['sound','music']) {
      const button = document.getElementById(type + 'Toggle');
      button.addEventListener('click', () => {
        if (!context()) { button.textContent = 'Audio unavailable'; return; }
        if (type === 'sound') sfx = !sfx; else music = !music;
        const on = type === 'sound' ? sfx : music;
        button.textContent = (type === 'sound' ? 'Sound' : 'Music') + ': ' + (on ? 'On' : 'Off');
        button.setAttribute('aria-pressed', String(on)); sync();
        if (type === 'sound' && on) note(72);
      });
    }
  });
  return {
    pause(on) { paused = on; sync(); },
    effect(kind, count = 1) {
      if (!sfx || document.hidden) return;
      if (kind === 'place') note(60, 0, .08, .025);
      else if (kind === 'eat') { note(55,0,.12); note(62,.08,.16); }
      else { const notes = kind === 'finish' ? [60,64,67,72,76,79,84] : [64,67,72].slice(0,Math.min(3,Math.max(1,count))); notes.forEach((n,i) => note(n,i*.09,.3)); }
    }
  };
})();
