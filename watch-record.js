// Records a bot run that raises an elephant, for `index.html?watch`.
// Not part of the game; the page only reads the JSON this writes.
//
//   node watch-record.js            search seeds until a run raises an elephant
//   node watch-record.js 5000       ...trying at most 5000 seeds
//
// A run is fixed by its seed plus the moves: every roll the rules make
// goes through gameRandom() (script.js), so the file holds the seed and
// the move list, and the page replays both on the real board. Ticks are
// -1, placements are the square index.

const fs = require('fs');
const path = require('path');
const sim = require('./sim.js');

const OUT = path.join(__dirname, 'watch', 'elephant-run.json');
const TRIES = Number(process.argv[2]) || 3000;

// mulberry32 — watch.js has the same twelve lines; keep them identical.
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

sim.use({});
const G = sim.G();
const { ctx, state } = G;
let moves = [];
const place = ctx.placeTile;
ctx.placeTile = function (i) { moves.push(i); return place(i); };

// The careful bot that spends everything was the one that raised an
// elephant in sim.js; the banker is tried too so either can win.
const POLICIES = [
  { name: 'careful', spend: (tag) => sim.spendAll(sim.carefulBot, tag) },
  { name: 'banker', spend: (tag) => sim.bankerBot(tag) }
];

for (let seed = 1; seed <= TRIES; seed++) {
  for (const policy of POLICIES) {
    ctx.gameRandom = seeded(seed);
    ctx.newGame();
    moves = [];
    let elephantAt = 0;
    policy.spend('opening');
    while (!state.over && state.ticks < 4000) {
      ctx.worldTick();
      moves.push(-1);
      if (state.over) break;
      policy.spend('tick ' + state.ticks);
      if (!elephantAt && sim.count('elephant')) elephantAt = state.ticks;
    }
    if (!elephantAt) continue;
    const run = {
      seed, bot: policy.name,
      elephantAt, ticks: state.ticks, score: ctx.displayScore(state.score), moves
    };
    // Replay the moves alone, the way the page will, before trusting them.
    ctx.gameRandom = seeded(seed);
    ctx.newGame();
    for (const m of moves) { if (m < 0) ctx.worldTick(); else place(m); }
    if (ctx.displayScore(state.score) !== run.score) throw new Error('replay drifted: ' + ctx.displayScore(state.score) + ' vs ' + run.score);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(run));
    console.log('seed ' + seed + ' (' + policy.name + '): elephant at tick ' + elephantAt +
      ', ended at ' + state.ticks + ', score ' + run.score + ' -> ' + path.relative(__dirname, OUT));
    process.exit(0);
  }
}
console.log('no elephant in ' + TRIES + ' seeds');
process.exit(1);
