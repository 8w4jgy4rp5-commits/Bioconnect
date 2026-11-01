// Checks every recording preset in dev/stages/ against the real rules
// (script.js run through sim.js, no browser):
//
//   node dev/check-stages.cjs            every preset
//   node dev/check-stages.cjs fail-01    one preset
//
// For each preset it plays `script` (and `rescue`, if there is one) and
// prints the chain length of each move and what got eaten on each tick,
// marking the loss of a precious (*) tile. It fails if the first move of
// `script` is not a 5+ chain, or the script never loses a precious tile.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sim = require('../sim.js');
const core = require('./stage-core.js');

const DIR = path.join(__dirname, 'stages');
const only = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && (!only || f === only + '.json'));
if (!files.length) { console.error('no preset found'); process.exit(1); }

const name = n => n;
let failed = 0;

function play(preset, steps) {
  sim.use({});
  const G = sim.G();
  const { ctx, state } = G;
  const get = expr => vm.runInContext(expr, ctx);
  const api = {
    SIZE: G.SIZE, CELLS: G.CELLS, ANIMALS: G.ANIMALS, PLANTS: G.PLANTS, HAND_MAX: G.HAND_MAX,
    BLOCKERS: get('BLOCKERS'), makeTile: ctx.makeTile, bigSide: ctx.bigSide, blockAt: ctx.blockAt,
    rank: ctx.rank, rollHand: ctx.rollHand
  };
  const built = core.build(preset, api);
  ctx.newGame();
  const queue = core.apply(state, built, api);
  const rollHand = ctx.rollHand;
  ctx.rollHand = () => (queue.length ? queue.shift() : rollHand());
  ctx.recordRun = () => {};

  const filled = state.cells.filter(Boolean).length;
  const log = [], chains = [];
  let lostPrecious = false;
  for (const step of steps) {
    if (step === 'tick' || step.tick) {
      const preciousAt = new Set();
      state.cells.forEach((c, i) => { if (c && c.stagePrecious) preciousAt.add(i); });
      let meals = [];
      const feed = ctx.feedEveryone;
      ctx.feedEveryone = function () { meals = feed(); return meals; };
      ctx.worldTick();
      ctx.feedEveryone = feed;
      const eaten = meals.map(m => m.kind + ' ate ' + m.ateKind + (preciousAt.has(m.ate) ? ' (PRECIOUS!)' : ''));
      if (meals.some(m => preciousAt.has(m.ate))) lostPrecious = true;
      log.push('  tick: ' + (eaten.join(', ') || 'nothing eaten'));
    } else {
      const at = core.square(step.place, G.SIZE);
      const kind = state.stock[0];
      let grew = [];
      const grow = ctx.growFrom;
      ctx.growFrom = function (i, cells, preview) { const g = grow(i, cells, preview); if (!preview && cells === undefined) grew = g; return g; };
      ctx.placeTile(at);
      ctx.growFrom = grow;
      chains.push(grew.length);
      log.push('  place ' + kind + ' at ' + step.place + ': ' + grew.length + '-chain' +
        (grew.length ? ' (' + [grew[0].was].concat(grew.map(g => g.kind)).join(' > ') + ')' : ''));
    }
  }
  return { filled, log, chains, lostPrecious, over: state.over };
}

for (const f of files) {
  let preset;
  try { preset = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
  catch (e) { console.log('✗ ' + f + ': not valid JSON — ' + e.message); failed++; continue; }
  try {
    const run = play(preset, preset.script || []);
    console.log((preset.name || f) + ' — ' + run.filled + '/25 squares filled (' + Math.round(run.filled * 4) + '%)');
    console.log(' script:'); run.log.forEach(l => console.log(l));
    const problems = [];
    if ((run.chains[0] || 0) < 5) problems.push('first move is a ' + (run.chains[0] || 0) + '-chain, want 5+');
    if (preset.fatalSound && !run.lostPrecious) problems.push('script never loses a precious tile');
    if (preset.rescue) {
      const r = play(preset, preset.rescue);
      console.log(' rescue:'); r.log.forEach(l => console.log(l));
      if (r.lostPrecious) problems.push('rescue still loses the precious tile');
    }
    if (problems.length) { failed++; console.log(' ✗ ' + problems.join('; ')); } else console.log(' ✓ ok');
  } catch (e) { failed++; console.log('✗ ' + f + ': ' + e.message); }
}
process.exitCode = failed ? 1 : 0;
