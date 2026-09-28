// Bioconnect: "Meadow Steps", an original score and procedural instruments.
// No recordings, samples, or melodies from another game are used.
// Kept separate from playback so previews render the very same instruments.
window.BioSound = (() => {
  const BPM = 96, BEAT = 60 / BPM, BARS = 16, BEATS = BARS * 4;
  const chords = [
    [50,57,61,66], [47,54,57,62], [52,55,59,66], [45,55,59,64],
    [50,57,61,66], [43,54,57,62], [52,55,59,62], [45,55,61,64],
    [47,54,57,62], [43,54,57,62], [50,57,61,66], [45,55,59,64],
    [52,55,59,66], [43,54,57,62], [45,55,61,64], [50,57,61,66]
  ];
  // Beat positions include space for the player's actions; the second half
  // answers the first rather than repeating a short arpeggio indefinitely.
  const phrases = [
    [[0,69],[.75,74],[1.5,73],[2.5,66]],
    [[.5,69],[1.5,66],[3,62]],
    [[0,67],[1.5,71],[2.25,69],[3.5,66]],
    [[.5,64],[2,69]],
    [[0,66],[.75,69],[2,76],[3,73]],
    [[.5,74],[1.5,71],[3,69]],
    [[0,67],[1.25,66],[2.5,64]],
    [[.5,61],[2,64],[3.5,69]],
    [[0,74],[1,78],[2.5,76],[3.25,73]],
    [[.5,71],[1.5,69],[3,66]],
    [[0,69],[1.25,73],[2.5,74]],
    [[.5,76],[2,71],[3.25,69]],
    [[0,67],[.75,71],[2,74],[3.25,71]],
    [[.5,69],[1.5,66],[3,62]],
    [[0,64],[1.5,69],[2.5,73]],
    [[0,74],[1.5,69],[2.5,66]]
  ];
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);

  function create(ctx, destination = ctx.destination) {
    const master = ctx.createGain(), compressor = ctx.createDynamicsCompressor();
    const music = ctx.createGain(), effects = ctx.createGain();
    music.gain.value = .7; effects.gain.value = .8; master.gain.value = .86;
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

    function envelope(param, time, attack, duration, volume) {
      param.setValueAtTime(0, time);
      param.linearRampToValueAtTime(volume, time + attack);
      param.exponentialRampToValueAtTime(.00001, time + duration);
      param.linearRampToValueAtTime(0, time + duration + .02);
    }

    function voice(source, bus, time, duration, volume, attack = .008, filter = null) {
      const gain = ctx.createGain(), nodes = [source, gain];
      envelope(gain.gain, time, attack, duration, volume);
      if (filter) { source.connect(filter); filter.connect(gain); nodes.push(filter); }
      else source.connect(gain);
      gain.connect(bus);
      const entry = { source, gain, bus, time };
      voices.add(entry);
      source.onended = () => { nodes.forEach(node => node.disconnect()); voices.delete(entry); };
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

    function chord(notes, time) {
      notes.slice(1).forEach((midi, i) => {
        const t = time + i * .019;
        tone(hz(midi), t, .75, .017, music, 'triangle', .018);
        tone(hz(midi) * 1.002, t, .52, .006, music, 'sine', .023);
      });
    }

    function musicBeat(index, time) {
      const beat = ((index % BEATS) + BEATS) % BEATS;
      const bar = Math.floor(beat / 4), within = beat % 4, notes = chords[bar];
      const sway = .018 * Math.sin(bar * 1.7 + within);
      for (const [position, midi] of phrases[bar]) {
        if (Math.floor(position) === within) {
          const offset = position - within;
          const t = time + offset * BEAT + (offset > 0 ? .018 : 0);
          wood(midi, t, .087 + sway);
          // A quiet resonant answer softens the dry synthesized attack.
          wood(midi - 12, t + .115, .012);
        }
      }
      if (within === 0 || within === 2) {
        const bass = within === 0 ? notes[0] : notes[0] + 7;
        tone(hz(bass), time, .53, .092, music, 'sine', .014);
        tone(hz(bass) * 2, time, .24, .013, music, 'sine', .01);
      }
      if (within === 1 || within === 3) chord(notes, time + .036);
      // Brushed seeds instead of a sharp hi-hat or a heavy drum loop.
      rustle(time + BEAT * .56, .09, .013, 3300, music);
      if (within === 1 || within === 3) tone(190, time, .09, .017, music, 'sine', .004, 130);
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

    function effect(kind, count = 1, time = ctx.currentTime + .012) {
      if (kind === 'place') plant(time);
      else if (kind === 'merge' || kind === 'finish') {
        const steps = Math.min(11, Math.max(1, Math.floor(Number(count) || 1)));
        for (let i = 0; i < steps; i++) pop(time + .105 + i * .145, i, .18 / (1 + i * .055));
        if (kind === 'finish') [74,78,81].forEach((n, i) => wood(n, time + .16 + steps * .145 + i * .10, .07, effects));
      } else if (kind === 'ready') {
        wood(69, time, .075, effects); wood(69, time + .22, .055, effects);
      } else if (kind === 'go') {
        [66,69,74].forEach((n, i) => wood(n, time + i * .09, .085, effects));
      } else if (kind === 'eat') {
        pop(time, 0, .052);
      } else if (kind === 'preview') {
        pop(time, 0, .14);
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

    return { musicBeat, effect, cancel };
  }
  return { create, BPM, BEAT, BEATS, title: 'Meadow Steps' };
})();
