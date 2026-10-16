// Bioconnect: "Tiptoe Hollow — Meadow Band", adapted from our promo score.
// Original score; applause/cheer recordings and licenses are documented in audio/SOURCES.md.
// Kept separate from playback so previews render the very same instruments.
window.BioSound = (() => {
  const BPM = 120, BEAT = 60 / BPM, BARS = 16, BEATS = BARS * 4;
  // The title screen plays the same tune, slower, as a music box.
  const TITLE_BEAT = 60 / 84;
  // Each newly encountered species joins the band once during this run.
  const INSTRUMENTS = Object.freeze([
    { kind: 'rabbit', name: 'Piano' },
    { kind: 'fox', name: 'Pizzicato strings' },
    { kind: 'deer', name: 'Flute' },
    { kind: 'zebra', name: 'Clarinet' },
    { kind: 'buffalo', name: 'Double bass' },
    { kind: 'wolf', name: 'Trumpet' },
    { kind: 'bear', name: 'Cello' },
    { kind: 'lion', name: 'French horn' },
    { kind: 'tiger', name: 'Glockenspiel' },
    { kind: 'elephant', name: 'Timpani' }
  ]);

  // Source: promo-video-v1/promo-audio.js, "Tiptoe Hollow" (our original).
  // Keep its D-minor oom-pah and whistled motif; the second eight bars
  // answer the first so a long game has room to breathe.
  const HOLLOW_BARS = [
    { root:38, fifth:45, chord:[62,65,69] },
    { root:38, fifth:45, chord:[62,65,69] },
    { root:43, fifth:50, chord:[62,67,70] },
    { root:45, fifth:52, chord:[61,64,67] },
    { root:38, fifth:45, chord:[62,65,69] },
    { root:46, fifth:53, chord:[62,65,70] },
    { root:43, fifth:45, chord:[62,67,70], chord2:[61,64,67] },
    { root:38, fifth:45, chord:[62,65,69] }
  ];
  // [position in bar, MIDI note, length in beats]
  const phrases = [
    [[0,69,.4],[1,74,.4],[1.5,76,.4],[2,77,1.5]],
    [[0,76,.4],[.5,74,.4],[1,73,.4],[1.5,74,2]],
    [[0,70,.4],[1,74,.4],[1.5,76,.4],[2,79,1.5]],
    [[0,77,.4],[.5,76,.4],[1,74,.4],[1.5,73,1.2],[3,69,.9]],
    [[0,69,.4],[1,74,.4],[1.5,76,.4],[2,77,.9],[3,81,.9]],
    [[0,82,1],[1,81,.45],[1.5,79,.45],[2,77,1.5]],
    [[0,79,.45],[.5,77,.45],[1,76,.45],[1.5,74,.45],[2,73,.45],[2.5,76,.45],[3,79,.9]],
    [[0,74,1.6]],
    [[0,69,.4],[1,74,.4],[1.5,76,.4],[2,77,.9],[3,74,.6]],
    [[0,76,.4],[.5,74,.4],[1,73,.4],[1.5,74,1.5],[3.5,69,.35]],
    [[0,70,.4],[1,74,.4],[1.5,76,.4],[2,79,.9],[3,77,.6]],
    [[0,77,.4],[.5,76,.4],[1,74,.4],[1.5,73,1.2],[3,69,.9]],
    [[0,74,.4],[.5,76,.4],[1,77,.8],[2,81,.9],[3,77,.6]],
    [[0,82,.9],[1,81,.4],[1.5,79,.4],[2,77,.9],[3,74,.7]],
    [[0,79,.45],[.5,77,.45],[1,76,.45],[1.5,74,.45],[2,73,.45],[2.5,76,.45],[3,73,.8]],
    [[0,74,1.6]]
  ];
  const chords = Array.from({length:BARS}, (_, i) => {
    const bar = HOLLOW_BARS[i % 8];
    return [bar.root + 12, ...bar.chord];
  });
  function harmony(bar, within) {
    const score = HOLLOW_BARS[bar % 8];
    return score.chord2 && within >= 2
      ? [57, ...score.chord2] : chords[bar];
  }
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);

  function create(ctx, destination = ctx.destination) {
    const master = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
    const music = ctx.createGain(), effects = ctx.createGain();
    music.gain.value = 1.6; effects.gain.value = .8; master.gain.value = .86;
    compressor.threshold.value = -14; compressor.knee.value = 12;
    compressor.ratio.value = 3; compressor.attack.value = .006; compressor.release.value = .15;
    music.connect(master); effects.connect(master); master.connect(compressor); compressor.connect(destination);
    const voices = new Set();
    // Seeded noise keeps preview exports reproducible without an audio asset.
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 194628;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }

    function envelope(param, time, attack, duration, volume, hold = 0) {
      param.setValueAtTime(0, time);
      param.linearRampToValueAtTime(volume, time + attack);
      if (hold > attack) param.setValueAtTime(volume * .9, time + hold);
      param.exponentialRampToValueAtTime(.00001, time + duration);
      param.linearRampToValueAtTime(0, time + duration + .02);
    }

    function voice(source, bus, time, duration, volume, attack = .008, filter = null, hold = 0, companions = []) {
      const gain = ctx.createGain(), nodes = [source, gain, ...companions];
      envelope(gain.gain, time, attack, duration, volume, hold);
      if (filter) { source.connect(filter); filter.connect(gain); nodes.push(filter); }
      else source.connect(gain);
      gain.connect(bus);
      const entry = { source, gain, bus: bus === effects ? effects : music, time };
      voices.add(entry);
      source.onended = () => {
        for (const node of companions) if (typeof node.stop === 'function') { try { node.stop(); } catch (_) {} }
        nodes.forEach(node => node.disconnect()); voices.delete(entry);
      };
      source.start(time); source.stop(time + duration + .03);
    }

    function tone(freq, time, duration, volume, bus, type = 'sine', attack = .008, endHz = null) {
      const source = ctx.createOscillator();
      source.type = type;
      source.frequency.setValueAtTime(freq, time);
      if (endHz) source.frequency.exponentialRampToValueAtTime(endHz, time + Math.min(duration, .13));
      voice(source, bus, time, duration, volume, attack);
    }

    function rustle(time, duration, volume, frequency, bus) {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      source.buffer = noise;
      filter.type = 'bandpass'; filter.Q.value = .65;
      filter.frequency.setValueAtTime(frequency, time);
      filter.frequency.exponentialRampToValueAtTime(frequency * .55, time + duration);
      voice(source, bus, time, duration, volume, .022, filter);
    }

    function wood(midi, time, volume = .09, bus = music) {
      const f = hz(midi);
      tone(f, time, .72, volume, bus);
      tone(f * 2, time, .23, volume * .18, bus);
      tone(f * 3.98, time, .105, volume * .07, bus, 'sine', .004);
    }

    // A music box: bright, short-ringing, with a faint bell overtone.
    function box(midi, time, volume) {
      const f = hz(midi);
      tone(f, time, 1.25, volume, music, 'sine', .003);
      tone(f * 2, time, .42, volume * .22, music, 'sine', .003);
      tone(f * 3.01, time, .16, volume * .07, music, 'sine', .002);
    }

    // The same minor-key motif, quietly explored on a music box.
    function titleBeat(beat, time) {
      const bar = Math.floor(beat / 4), within = beat % 4, notes = harmony(bar, within);
      for (const [position, midi] of phrases[bar]) {
        if (Math.floor(position) === within) {
          const t = time + (position - within) * TITLE_BEAT;
          box(midi, t, .043);
          box(midi, t + TITLE_BEAT * .75, .008);
        }
      }
      if (within === 0) {
        notes.slice(1).forEach((midi, i) => tone(hz(midi - 12), time + i * .05, TITLE_BEAT * 3.8, .006, music, 'triangle', .3));
        tone(hz(notes[0] - 12), time, TITLE_BEAT * 2.8, .027, music, 'sine', .12);
      }
    }

    // Whistled notes enter from below. A little vibrato gives the tune
    // the promo's hesitant, comic personality rather than a pure beep.
    function whistle(midi, time, duration, volume = .078, toMidi = null) {
      const source = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain();
      source.type = 'sine';
      source.frequency.setValueAtTime(hz(midi - .65), time);
      source.frequency.exponentialRampToValueAtTime(hz(midi), time + .045);
      if (toMidi !== null) source.frequency.exponentialRampToValueAtTime(hz(toMidi), time + duration * .82);
      lfo.frequency.value = toMidi === null ? 5.4 : 6.2;
      depth.gain.setValueAtTime(0, time);
      depth.gain.linearRampToValueAtTime(hz(midi) * (toMidi === null ? .009 : .02), time + Math.min(duration, .28));
      lfo.connect(depth); depth.connect(source.frequency);
      lfo.start(time); lfo.stop(time + duration + .03);
      voice(source, music, time, duration, volume, .025, null, Math.max(.03, duration - .06), [lfo, depth]);
      if (toMidi === null) rustle(time, .08, .004, hz(midi) * 2, music);
    }

    function tuba(midi, time, duration, volume = .075) {
      const source = ctx.createOscillator(), filter = ctx.createBiquadFilter();
      source.type = 'sawtooth';
      source.frequency.setValueAtTime(hz(midi) * .985, time);
      source.frequency.exponentialRampToValueAtTime(hz(midi), time + .035);
      filter.type = 'lowpass'; filter.Q.value = .65;
      filter.frequency.setValueAtTime(850, time);
      filter.frequency.exponentialRampToValueAtTime(260, time + duration);
      voice(source, music, time, duration, volume, .012, filter);
      tone(hz(midi) / 2, time, duration, volume * .25, music, 'sine', .012);
    }

    function harpsichord(midi, time, volume = .018) {
      const source = ctx.createOscillator(), filter = ctx.createBiquadFilter();
      source.type = 'sawtooth'; source.frequency.value = hz(midi);
      filter.type = 'bandpass'; filter.frequency.value = 1900; filter.Q.value = .55;
      voice(source, music, time, .32, volume, .003, filter);
      tone(hz(midi) * 1.004, time, .22, volume * .25, music, 'triangle', .003);
    }

    const layers = new Map();
    for (const { kind } of INSTRUMENTS) {
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(music);
      layers.set(kind, bus);
    }
    let ensembleKey = '';
    const waves = new Map();

    function setEnsemble(kinds, time = ctx.currentTime) {
      const chosen = new Set(kinds);
      const active = INSTRUMENTS.filter(i => chosen.has(i.kind));
      const key = active.map(i => i.kind).join(',');
      if (key === ensembleKey) return;
      ensembleKey = key;
      // Let the ensemble get richer without making ten parts ten times louder.
      const level = 1 / Math.sqrt(1 + Math.max(0, active.length - 2) * .15);
      for (const { kind } of INSTRUMENTS) {
        const gain = layers.get(kind).gain;
        if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(time);
        else { const value = gain.value; gain.cancelScheduledValues(time); gain.setValueAtTime(value, time); }
        gain.linearRampToValueAtTime(chosen.has(kind) ? level : 0, time + .55);
      }
    }

    // Sustained instruments have shaped harmonics and a held breath; struck
    // instruments lose their upper partials early. These are synth timbres,
    // not recordings of acoustic instruments.
    function held(midi, time, duration, volume, bus, profile, attack, cutoff) {
      if (!waves.has(profile)) {
        const partials = {
          flute: [0,1,.12,.04,.015], clarinet: [0,1,.05,.55,.02,.25,.01,.1],
          trumpet: [0,1,.85,.65,.42,.28,.18,.1,.05],
          cello: [0,1,.5,.3,.2,.13,.08], horn: [0,1,.4,.2,.09,.03]
        }[profile];
        waves.set(profile, ctx.createPeriodicWave(new Float32Array(partials.length), new Float32Array(partials)));
      }
      const source = ctx.createOscillator(), filter = ctx.createBiquadFilter();
      source.setPeriodicWave(waves.get(profile));
      source.frequency.setValueAtTime(hz(midi), time);
      filter.type = 'lowpass'; filter.Q.value = .55;
      filter.frequency.setValueAtTime(cutoff * .65, time);
      filter.frequency.linearRampToValueAtTime(cutoff, time + attack * 2);
      filter.frequency.linearRampToValueAtTime(cutoff * .78, time + duration);
      voice(source, bus, time, duration, volume, attack, filter, duration * .55);
    }

    function instrument(kind, midi, time, duration, volume) {
      const bus = layers.get(kind);
      if (!bus) return;
      const f = hz(midi);
      switch (kind) {
        case 'rabbit': // Hammer attack, then the upper strings decay first.
          tone(f, time, duration, volume, bus, 'sine', .003);
          tone(f * 2.002, time, duration * .42, volume * .4, bus, 'sine', .002);
          tone(f * 3.995, time, duration * .18, volume * .16, bus, 'sine', .002);
          tone(f * 7, time, .035, volume * .045, bus, 'sine', .001);
          break;
        case 'fox':
          tone(f, time, .28, volume, bus, 'triangle', .003);
          tone(f * 2.01, time, .09, volume * .18, bus, 'sine', .002);
          break;
        case 'deer': held(midi,time,duration,volume,bus,'flute',.065,4200); break;
        case 'zebra': held(midi,time,duration,volume,bus,'clarinet',.035,2600); break;
        case 'buffalo':
          tone(f,time,.8,volume,bus,'triangle',.012);
          tone(f * 2,time,.2,volume * .13,bus,'sine',.006);
          break;
        case 'wolf': held(midi,time,duration,volume,bus,'trumpet',.04,3400); break;
        case 'bear': held(midi,time,duration,volume,bus,'cello',.16,1500); break;
        case 'lion': held(midi,time,duration,volume,bus,'horn',.09,1700); break;
        case 'tiger':
          tone(f,time,1.4,volume,bus,'sine',.002);
          tone(f * 2.76,time,.38,volume * .22,bus,'sine',.001);
          tone(f * 5.4,time,.09,volume * .07,bus,'sine',.001);
          break;
        case 'elephant':
          tone(f * 1.12,time,.85,volume,bus,'sine',.004,f);
          tone(f * 1.53,time,.25,volume * .25,bus,'sine',.003,f * 1.5);
          rustle(time,.035,volume * .06,500,bus);
          break;
      }
    }

    function ensembleBeat(beat, time, kinds) {
      const bar = Math.floor(beat / 4), within = beat % 4, notes = harmony(bar, within);
      const active = new Set(kinds);
      const play = (kind, midi, offset, duration, volume) => {
        if (active.has(kind)) instrument(kind,midi,time + offset * BEAT,duration,volume);
      };
      // Different registers and spaces: a conversation, not ten copies of
      // the melody. Every unlocked part has an audible role in every bar.
      if (within === 1 || within === 3) {
        [notes[1],notes[2],notes[3]].forEach((midi,i) => play('rabbit',midi,.04 + i * .025,1.1,.029));
      }
      if (within === 0 || within === 2) play('fox',notes[within === 0 ? 2 : 3] + 12,.5,.28,.045);
      if (within === 2) {
        play('deer',notes[3] + 12,.12,.52,.042);
        play('deer',notes[2] + 12,1.02,.5,.034);
      }
      if (within === 1) play('zebra',notes[2],.5,.7,.04);
      if (within === 3) play('zebra',notes[1],.5,.38,.032);
      if (within === 0 || within === 2) play('buffalo',notes[0] - 12 + (within === 2 ? 7 : 0),0,.5,.042);
      if (within === 0 && bar % 2) play('wolf',notes[3],.14,.34,.028);
      if (within === 3 && bar % 2) play('wolf',notes[2],.2,.3,.021);
      if (within === 0) play('bear',notes[1] - 12,.05,1.6,.032);
      if (within === 2) play('lion',notes[2] - 12,.03,1.0,.042);
      if (within === 0) play('tiger',notes[3] + 12,.75,.9,.02);
      if (within === 3) play('tiger',notes[2] + 12,.7,.9,.016);
      if (within === 0) play('elephant',notes[0] - 12,0,.85,.07);
      if (within === 2) play('elephant',notes[0] - 5,.5,.85,.045);
    }

    function instrumentPreview(kind, time = ctx.currentTime + .02) {
      if (!layers.has(kind)) return;
      setEnsemble([kind], time);
      const low = ['buffalo','bear','lion','elephant'].includes(kind);
      const high = kind === 'tiger';
      [62,65,69,65].forEach((midi,i) => instrument(kind,midi + (low ? -12 : high ? 12 : 0),time + i * .65,.6,.11));
    }

    function musicBeat(index, time, theme = 'game', kinds = []) {
      const beat = ((index % BEATS) + BEATS) % BEATS;
      if (theme === 'rest') return;
      if (theme === 'title') return titleBeat(beat, time);
      setEnsemble(kinds, time);
      const bar = Math.floor(beat / 4), within = beat % 4;
      const score = HOLLOW_BARS[bar % 8], notes = harmony(bar, within);
      const root = score.chord2 && within >= 2 ? 45 : score.root;
      if (within === 0 || within === 2) {
        tuba(within === 0 ? root : score.chord2 ? root : score.fifth, time, BEAT * .7);
        tone(105, time, .16, .035, music, 'sine', .004, 43);
      }
      if (within === 1 || within === 3) notes.slice(1).forEach((midi, i) => harpsichord(midi, time + i * .008));
      if (within === 3 && bar % 2) tuba(root + 2, time + BEAT * .5, BEAT * .35, .04);
      rustle(time + BEAT * .5, .045, .007, 6500, music);
      // The whistled motif is present from the first plant, as in the video.
      for (const [position, midi, length] of phrases[bar]) {
        if (Math.floor(position) === within) whistle(midi, time + (position - within) * BEAT, length * BEAT);
      }
      if ((bar % 8 === 3 || bar % 8 === 7) && within === 2) {
        whistle(bar % 8 === 3 ? 69 : 74, time, BEAT * 1.8, .022, bar % 8 === 3 ? 86 : 62);
      }
      if (bar % 8 >= 4) tone(hz(notes[1 + (within + 1) % 3] + 12), time + BEAT * .5, .17, .014, music, 'triangle', .003);
      ensembleBeat(beat, time, kinds);
    }

    function plant(time) {
      // Three overlapping swishes: leaves brushing past, then settling.
      rustle(time, .22, .29, 2300, effects);
      rustle(time + .038, .17, .15, 3900, effects);
      rustle(time + .086, .12, .12, 1350, effects);
      tone(155, time + .018, .10, .028, effects, 'sine', .012, 100);
    }

    function pop(time, step = 0, volume = .2) {
      const pitch = [0,2,4,7,9,12,14,16,19,21,24][Math.min(10, Math.max(0, step))];
      const f = hz(62 + pitch);
      tone(f * 1.65, time, .23, volume, effects, 'sine', .004, f * .78);
      tone(f * 2.03, time, .067, volume * .11, effects, 'sine', .003, f * 1.3);
      rustle(time, .045, .023, 1150, effects);
    }

    // A muted horn that sags: the pitch slides down through the note and
    // a slow wobble rides on it, like a deflating "wah".
    function sag(midi, time, duration, volume, drop, wobble = 0) {
      const source = ctx.createOscillator(), filter = ctx.createBiquadFilter();
      source.type = 'sawtooth';
      source.frequency.setValueAtTime(hz(midi), time);
      source.frequency.exponentialRampToValueAtTime(hz(midi - drop), time + duration);
      filter.type = 'lowpass'; filter.Q.value = 4;
      filter.frequency.setValueAtTime(1500, time);
      filter.frequency.exponentialRampToValueAtTime(420, time + duration);
      if (wobble) {
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = 5.5; depth.gain.value = wobble;
        lfo.connect(depth); depth.connect(source.frequency);
        lfo.start(time); lfo.stop(time + duration + .03);
        lfo.onended = () => { lfo.disconnect(); depth.disconnect(); };
      }
      voice(source, effects, time, duration, volume, .03, filter);
    }

    // Recording: DJ YA-MAN, second applause pattern (see audio/SOURCES.md).
    // Use the effects bus so the existing pause/new-move cancellation applies.
    let applauseBuffer = null;
    function setApplause(buffer) { applauseBuffer = buffer; }
    function applause(time, steps) {
      if (!applauseBuffer) return;
      const tier = steps >= 7 ? 2 : steps >= 5 ? 1 : 0;
      const duration = [1.6, 2.1, 2.5][tier];
      const source = ctx.createBufferSource();
      source.buffer = applauseBuffer;
      voice(source, effects, time, duration, [.42, .48, .54][tier], .018,
        null, duration - .3);
      cheer(time, tier);
    }

    // Recording: DJ YA-MAN Cheer-Crowd01 High-Short (see audio/SOURCES.md).
    // Kept under the applause: quieter, shorter, and with the top cut so the claps stay crisp.
    let cheerBuffer = null;
    function setCheer(buffer) { cheerBuffer = buffer; }
    function cheer(time, tier) {
      if (!cheerBuffer) return;
      const duration = [1.3, 1.7, 2.1][tier];
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      source.buffer = cheerBuffer;
      filter.type = 'lowpass'; filter.frequency.value = 3200;
      voice(source, effects, time, duration, [.16, .2, .24][tier], .05,
        filter, duration - .35);
    }

    function effect(kind, count = 1, time = ctx.currentTime + .012) {
      if (kind === 'place') plant(time);
      else if (kind === 'merge' || kind === 'finish') {
        const steps = Math.min(11, Math.max(1, Math.floor(Number(count) || 1)));
        for (let i = 0; i < steps; i++) pop(time + .105 + i * .145, i, .18 / (1 + i * .055));
        if (kind === 'finish') [74,78,81].forEach((n, i) => wood(n, time + .16 + steps * .145 + i * .10, .07, effects));
        else if (steps >= 3) {
          const notes = steps >= 7 ? [74,78,81,86] : steps >= 5 ? [74,78,81] : [74,78];
          const end = time + .105 + (steps - 1) * .145;
          notes.forEach((note, i) => wood(note, end + .055 + i * .075, .045, effects));
          applause(end + .055 + notes.length * .075 + .06, steps);
        }
      } else if (kind === 'ready') {
        wood(69, time, .075, effects); wood(69, time + .22, .055, effects);
      } else if (kind === 'go') {
        [66,69,74].forEach((n, i) => wood(n, time + i * .09, .085, effects));
      } else if (kind === 'gameover') {
        // wah, wah, wah, waaaah: three falling steps, then a long droop
        [55, 54, 53].forEach((n, i) => sag(n, time + i * .42, .36, .05, .6));
        sag(52, time + 1.26, 1.15, .055, 2.5, 4);
      } else if (kind === 'eat') {
        pop(time, 0, .052);
      } else if (kind === 'preview') {
        pop(time, 0, .14);
      } else if (kind === 'fanfare') {
        // The elephant: a rising run, then a held chord with a low answer.
        [62,66,69,74,78,81].forEach((n, i) => wood(n, time + i * .085, .085, effects));
        const hold = time + 6 * .085 + .06;
        [74,78,81,86].forEach((n, i) => wood(n, hold + i * .012, .09, effects));
        tone(hz(50), hold, 1.1, .11, effects, 'sine', .02);
        [0,1,2].forEach(i => pop(hold + .45 + i * .16, 6 + i * 2, .12));
      }
    }

    function cancel(busName) {
      const bus = busName === 'music' ? music : busName === 'effects' ? effects : null;
      const now = ctx.currentTime;
      for (const entry of voices) {
        if (bus && entry.bus !== bus) continue;
        const param = entry.gain.gain;
        if (entry.time > now) {
          param.cancelScheduledValues(now); param.setValueAtTime(0, now);
        } else if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
        else { const value = param.value; param.cancelScheduledValues(now); param.setValueAtTime(value, now); }
        param.linearRampToValueAtTime(0, now + .02);
        entry.source.stop(now + .025);
      }
    }

    return { musicBeat, effect, cancel, setEnsemble, instrumentPreview, setApplause, setCheer };
  }
  const beatLength = theme => theme === 'title' ? TITLE_BEAT : BEAT;
  return { create, BPM, BEAT, BEATS, beatLength, instruments: INSTRUMENTS, title: 'Tiptoe Hollow — Meadow Band' };
})();
