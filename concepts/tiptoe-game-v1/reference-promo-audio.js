// Bioconnect promo: "Tiptoe Hollow", an original spooky-silly score, and
// the intro's sound effects. Everything is synthesized here; no recording,
// sample, or melody from another game is used. The mood brief was "a
// haunted house you creep through, a little scared and a little giggly":
// a minor key, an oom-pah bass on tiptoe, a harpsichord, a whistled tune
// and a theremin's wobble. The notes themselves were written for this.
//
// Every function takes a BaseAudioContext, so the same score plays live
// in the preview page and renders offline for the video.
window.PromoSound = (() => {
  const BPM = 120, BEAT = 60 / BPM;          // a beat is half a second
  const LOOP_BEATS = 32;                      // eight bars of 4/4
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---- the score (MIDI notes, start beat in the bar, length in beats) ----
  // D minor. Chords per bar: Dm Dm Gm A7 | Dm Bb Gm-A7 Dm.
  const BARS = [
    { root: 38, fifth: 45, chord: [62, 65, 69] },
    { root: 38, fifth: 45, chord: [62, 65, 69] },
    { root: 43, fifth: 50, chord: [62, 67, 70] },
    { root: 45, fifth: 52, chord: [61, 64, 67] },
    { root: 38, fifth: 45, chord: [62, 65, 69] },
    { root: 46, fifth: 53, chord: [62, 65, 70] },
    { root: 43, fifth: 45, chord: [62, 67, 70], chord2: [61, 64, 67] },
    { root: 38, fifth: 45, chord: [62, 65, 69] }
  ];
  const MELODY = [
    [[69, 0, .4], [74, 1, .4], [76, 1.5, .4], [77, 2, 1.5]],
    [[76, 0, .4], [74, .5, .4], [73, 1, .4], [74, 1.5, 2]],
    [[70, 0, .4], [74, 1, .4], [76, 1.5, .4], [79, 2, 1.5]],
    [[77, 0, .4], [76, .5, .4], [74, 1, .4], [73, 1.5, 1.2], [69, 3, .9]],
    [[69, 0, .4], [74, 1, .4], [76, 1.5, .4], [77, 2, .9], [81, 3, .9]],
    [[82, 0, 1], [81, 1, .45], [79, 1.5, .45], [77, 2, 1.5]],
    [[79, 0, .45], [77, .5, .45], [76, 1, .45], [74, 1.5, .45], [73, 2, .45], [76, 2.5, .45], [79, 3, .9]],
    [[74, 0, 1.6]]
  ];
  // the theremin's swoops: [bar, beat, from, to, length in beats]
  const SWOOPS = [[3, 2, 69, 86, 2], [7, 2, 74, 62, 2]];

  function create(ctx, dest) {
    const out = dest || ctx.destination;
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -14; master.ratio.value = 3; master.attack.value = .005; master.release.value = .2;
    const masterGain = ctx.createGain(); masterGain.gain.value = .9;
    master.connect(masterGain); masterGain.connect(out);

    // a dusty hall: decaying noise as the impulse, same on every render
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = rnd() * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    const verbGain = ctx.createGain(); verbGain.gain.value = .35;
    verb.connect(verbGain); verbGain.connect(master);

    // music and effects are separate buses so the music can be cut dead
    const music = ctx.createGain(); music.gain.value = .8;
    // slow motion muffles the music, as if heard under water
    const musicLP = ctx.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 18000; musicLP.Q.value = .7;
    music.connect(musicLP); musicLP.connect(master); musicLP.connect(verb);
    const sfx = ctx.createGain(); sfx.gain.value = 1;
    sfx.connect(master);
    const sfxVerb = ctx.createGain(); sfxVerb.gain.value = .5;
    sfxVerb.connect(verb);

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    { const d = noiseBuf.getChannelData(0); let s = 11; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; } }

    function env(g, t, a, peak, d, sustain = 0.0001) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(sustain, t + a + d);
    }
    function osc(type, f, t, stop, to) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
      o.connect(to); o.start(t); o.stop(stop); return o;
    }
    function noise(t, dur, to) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.connect(to);
      s.start(t, (t * 0.37) % 0.5); s.stop(t + dur); return s;
    }

    // ---- instruments ----
    function tuba(t, m, dur) {               // the oom of oom-pah
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur);
      lp.connect(g); g.connect(music);
      env(g, t, .015, .36, dur);
      osc('sawtooth', hz(m) * .985, t, t + dur + .05, lp).frequency.exponentialRampToValueAtTime(hz(m), t + .04);
      osc('square', hz(m) / 2, t, t + dur + .05, lp);
    }
    function harpsichord(t, m, gain = .07) { // the pah
      const g = ctx.createGain(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 350; lp.type = 'lowpass'; lp.frequency.value = 4200;
      hp.connect(lp); lp.connect(g); g.connect(music);
      env(g, t, .003, gain, .45);
      osc('sawtooth', hz(m), t, t + .5, hp);
      osc('sawtooth', hz(m) * 1.004, t, t + .5, hp);
    }
    function pizz(t, m, gain = .16) {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(500, t + .2);
      lp.connect(g); g.connect(music);
      env(g, t, .004, gain, .28);
      osc('triangle', hz(m), t, t + .32, lp);
      osc('square', hz(m), t, t + .06, lp);
    }
    function whistle(t, m, dur) {            // the tune, whistled on tiptoe
      const g = ctx.createGain(), o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain();
      o.type = 'sine';
      // every note sneaks in from a little below
      o.frequency.setValueAtTime(hz(m - .7), t); o.frequency.exponentialRampToValueAtTime(hz(m), t + .05);
      vib.frequency.value = 5.4; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(hz(m) * .012, t + Math.min(dur, .4));
      vib.connect(vg); vg.connect(o.frequency);
      o.connect(g); g.connect(music);
      const len = dur * BEAT;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(.16, t + .03);
      g.gain.setValueAtTime(.16, t + Math.max(.04, len - .06));
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + .04);
      o.start(t); vib.start(t); o.stop(t + len + .08); vib.stop(t + len + .08);
      // a breath of air on the attack
      const bg = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = hz(m) * 2; bp.Q.value = 4;
      bp.connect(bg); bg.connect(music); env(bg, t, .01, .05, .12);
      noise(t, .15, bp);
    }
    function theremin(t, from, to, beats) {   // ghostly "hyuuun"
      const len = beats * BEAT, g = ctx.createGain(), o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(hz(from), t);
      o.frequency.exponentialRampToValueAtTime(hz(to), t + len * .55);
      o.frequency.exponentialRampToValueAtTime(hz(to - 2), t + len);
      vib.frequency.value = 6.2; vg.gain.value = hz(to) * .025;
      vib.connect(vg); vg.connect(o.frequency); o.connect(g); g.connect(music);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(.12, t + len * .3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.start(t); vib.start(t); o.stop(t + len); vib.stop(t + len);
    }
    function tick(t, gain = .05) {
      const g = ctx.createGain(), hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 7000; hp.connect(g); g.connect(music);
      env(g, t, .002, gain, .04); noise(t, .06, hp);
    }
    function thump(t, gain = .45, to = music, from = 110, down = 42) {
      const g = ctx.createGain(); g.connect(to); env(g, t, .004, gain, .2);
      osc('sine', from, t, t + .25, g).frequency.exponentialRampToValueAtTime(down, t + .16);
    }

    // one beat of the score; `beat` counts from the start of the loop
    function musicBeat(beat, t) {
      const b = ((beat % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS, bar = BARS[b >> 2 & 7], inBar = b % 4;
      const chord = (bar.chord2 && inBar >= 2) ? bar.chord2 : bar.chord;
      const root = (bar.chord2 && inBar >= 2) ? 45 : bar.root;
      if (inBar === 0 || inBar === 2) tuba(t, inBar === 0 ? root : (bar.chord2 ? root : bar.fifth), BEAT * .7);
      if (inBar === 1 || inBar === 3) chord.forEach((m, i) => harpsichord(t + i * .008, m));
      if (inBar === 3 && (b >> 2) % 2 === 1) tuba(t + BEAT / 2, root + 2, BEAT * .4);   // a little walk up
      if (inBar === 0 || inBar === 2) thump(t, .3);
      tick(t + BEAT / 2);
      // second half of the loop: pizzicato on the off-eighths for more bustle
      if ((b >> 4) === 1) pizz(t + BEAT / 2, chord[(inBar + 1) % 3] + 12, .09);
      for (const [m, at, dur] of MELODY[b >> 2 & 7]) if (at >= inBar && at < inBar + 1) whistle(t + (at - inBar) * BEAT, m, dur);
      for (const [sb, sbeat, f, to, len] of SWOOPS) if (sb === (b >> 2) && sbeat === inBar) theremin(t, f, to, len);
    }
    function playMusic(t0, fromBeat, toBeat) {
      for (let b = fromBeat; b < toBeat; b++) musicBeat(b, t0 + b * BEAT);
    }
    // "pon": a cork-pop with a little bubble on top; pitch climbs per merge
    function pop(t, m, gain = .5) {
      const g = ctx.createGain(); g.connect(sfx); g.connect(sfxVerb);
      env(g, t, .003, gain, .16);
      const o = osc('sine', hz(m) * 1.9, t, t + .2, g);
      o.frequency.exponentialRampToValueAtTime(hz(m), t + .045);
      const g2 = ctx.createGain(); g2.connect(sfx); env(g2, t, .002, gain * .35, .09);
      osc('triangle', hz(m + 12) * 1.5, t, t + .12, g2).frequency.exponentialRampToValueAtTime(hz(m + 12), t + .03);
      const cg = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 1.2; bp.connect(cg); cg.connect(sfx);
      env(cg, t, .001, gain * .4, .025); noise(t, .04, bp);
    }
    function heartbeat(t, gain = 1) {       // "dokun"
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.connect(sfx); lp.connect(sfxVerb);
      thump(t, .9 * gain, lp, 75, 32);
      thump(t + .2, .6 * gain, lp, 70, 30);
    }
    function shine(t) {                     // the white flash: a swell, then "shaan"
      const sg = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(800, t - .6); bp.frequency.exponentialRampToValueAtTime(9000, t);
      bp.connect(sg); sg.connect(sfx); sg.connect(sfxVerb);
      sg.gain.setValueAtTime(0.0001, t - .6); sg.gain.exponentialRampToValueAtTime(.35, t - .02); sg.gain.exponentialRampToValueAtTime(0.0001, t + .05);
      noise(t - .6, .7, bp);
      [86, 90, 93, 98, 102].forEach((m, i) => {      // D major, bright after all that minor
        const g = ctx.createGain(); g.connect(sfx); g.connect(sfxVerb);
        env(g, t + i * .012, .004, .1, 1.8);
        osc('sine', hz(m), t + i * .012, t + 2, g);
        osc('triangle', hz(m) * 2.01, t + i * .012, t + .6, g);
      });
      const cg = ctx.createGain(), hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 5000; hp.connect(cg); cg.connect(sfx); cg.connect(sfxVerb);
      env(cg, t, .002, .3, 1.2); noise(t, 1.3, hp);
    }
    function cutMusic(t) {                  // the music stops dead; the hall rings on
      music.gain.setValueAtTime(music.gain.value, t - .005);
      music.gain.linearRampToValueAtTime(0, t + .03);
    }
    function startMusic(t) { music.gain.setValueAtTime(0, t - .01); music.gain.linearRampToValueAtTime(.8, t + .02); }
    function muffle(t0, t1) {             // slow-motion window
      musicLP.frequency.setValueAtTime(18000, t0 - .15);
      musicLP.frequency.exponentialRampToValueAtTime(500, t0 + .1);
      musicLP.frequency.setValueAtTime(500, t1 - .1);
      musicLP.frequency.exponentialRampToValueAtTime(18000, t1 + .15);
    }
    function tap(t) {                      // "kotsu": a fingertip on wood
      const g = ctx.createGain(); g.connect(sfx); env(g, t, .001, .14, .03);
      osc('sine', 1900, t, t + .05, g).frequency.exponentialRampToValueAtTime(900, t + .03);
    }
    function chomp(t) {                    // "paku!": a low, quick bite
      const g = ctx.createGain(); g.connect(sfx); g.connect(sfxVerb); env(g, t, .003, .7, .14);
      osc('sine', 320, t, t + .18, g).frequency.exponentialRampToValueAtTime(90, t + .11);
      const cg = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.5; bp.connect(cg); cg.connect(sfx);
      env(cg, t, .002, .45, .06); noise(t, .08, bp);
      const g2 = ctx.createGain(); g2.connect(sfx); env(g2, t + .09, .002, .35, .07);
      osc('triangle', 260, t + .09, t + .18, g2).frequency.exponentialRampToValueAtTime(110, t + .15);
    }
    function whoosh(t, len = .45) {        // fast-forward: a tape winding up
      const g = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6000, t + len);
      bp.connect(g); g.connect(sfx); g.connect(sfxVerb);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.4, t + len * .8); g.gain.exponentialRampToValueAtTime(0.0001, t + len + .08);
      noise(t, len + .1, bp);
      const o = ctx.createGain(); o.connect(sfx); o.gain.setValueAtTime(0.0001, t); o.gain.exponentialRampToValueAtTime(.08, t + len * .8); o.gain.exponentialRampToValueAtTime(0.0001, t + len + .05);
      osc('sawtooth', 120, t, t + len + .1, o).frequency.exponentialRampToValueAtTime(900, t + len);
    }
    function fanfare(t) {                  // the elephant: a timpani roll, then the organ
      for (let i = 0; i < 14; i++) {       // the roll swells into the hit
        const at = t - .7 + i * .05, g = ctx.createGain(); g.connect(sfx); env(g, at, .003, .05 + i * .02, .12);
        osc('sine', 82, at, at + .16, g).frequency.exponentialRampToValueAtTime(68, at + .12);
      }
      thump(t, 1, sfx, 95, 40); thump(t, .6, sfxVerb, 95, 40);
      [50, 57, 62, 66, 69, 74, 78, 81].forEach((m, i) => {   // D major, organ-ish
        const g = ctx.createGain(), lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(g); g.connect(sfx); g.connect(sfxVerb);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.032, t + .04);
        g.gain.setValueAtTime(.032, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        osc('square', hz(m), t, t + 3.3, lp); osc('sine', hz(m) * 2, t, t + 3.3, lp);
      });
      for (let i = 0; i < 12; i++) {       // sparkles
        const at = t + .15 + i * .11, m = [86, 90, 93, 98, 93, 102][i % 6] + (i > 5 ? 12 : 0);
        const g = ctx.createGain(); g.connect(sfx); g.connect(sfxVerb); env(g, at, .002, .06, .35);
        osc('sine', hz(m), at, at + .4, g);
      }
    }
    function sparkle(t) {
      [93, 98, 102, 105].forEach((m, i) => {
        const at = t + i * .06, g = ctx.createGain(); g.connect(sfx); g.connect(sfxVerb); env(g, at, .002, .08, .5);
        osc('sine', hz(m), at, at + .6, g);
      });
    }
    function bell(t) {                     // "goon": one church-ish bell
      [[1, .3, 4], [2.0, .16, 2.6], [2.76, .12, 2], [5.4, .06, 1.2], [.5, .2, 4.5]].forEach(([k, a, d]) => {
        const g = ctx.createGain(); g.connect(sfx); g.connect(sfxVerb); env(g, t, .004, a, d);
        osc('sine', hz(50) * k, t, t + d + .1, g);
      });
    }
    function stopAll(t) { masterGain.gain.setValueAtTime(masterGain.gain.value, t); masterGain.gain.linearRampToValueAtTime(0, t + .05); }
    return { playMusic, pop, heartbeat, shine, cutMusic, startMusic, muffle, tap, chomp, whoosh, fanfare, sparkle, bell, stopAll, musicBeat };
  }

  // ---- the intro's sound, on the same beat grid as promo-intro.js ----
  function scheduleIntro(ctx, t0, cue) {
    const s = create(ctx);
    s.playMusic(t0, 0, cue.freezeBeat);
    cue.merges.forEach((beat, i) => s.pop(t0 + beat * BEAT, cue.popNotes[i]));
    s.cutMusic(t0 + cue.freezeBeat * BEAT);
    s.heartbeat(t0 + cue.freezeBeat * BEAT);
    s.heartbeat(t0 + (cue.freezeBeat + 1.5) * BEAT, .8);
    s.shine(t0 + cue.flashBeat * BEAT);
    return s;
  }
  // The whole video: the intro, then the play section from `play` (times
  // in seconds from the start of the video, worked out by play-render.cjs).
  function scheduleFull(ctx, t0, cue, play) {
    const s = scheduleIntro(ctx, t0, cue);
    const at = x => t0 + x;
    s.startMusic(at(play.musicStart));
    s.playMusic(at(play.musicStart), 0, Math.ceil((play.musicStop - play.musicStart) / BEAT));
    s.cutMusic(at(play.musicStop));
    for (const x of play.taps) s.tap(at(x));
    for (const [x, n] of play.pops) s.pop(at(x), n, .4);
    for (const x of play.whooshes) s.whoosh(at(x));
    for (const [a, b] of play.slow) s.muffle(at(a), at(b));
    for (const x of play.chomps) s.chomp(at(x));
    if (play.fanfare != null) s.fanfare(at(play.fanfare));
    if (play.reveal != null) s.sparkle(at(play.reveal));
    if (play.bell != null) s.bell(at(play.bell));
    return s;
  }
  function scheduleLoop(ctx, t0, loops = 1) {
    const s = create(ctx);
    s.playMusic(t0, 0, LOOP_BEATS * loops);
    return s;
  }
  return { BPM, BEAT, LOOP_BEATS, create, scheduleIntro, scheduleFull, scheduleLoop };
})();
