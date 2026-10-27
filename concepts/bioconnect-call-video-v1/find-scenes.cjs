// Finds boards where the next tile sets off a 7+ chain (the BIOCONNECT! call)
// under the current rules, by letting the careful bot play seeded runs.
//   node find-scenes.cjs [seeds]
const fs = require('fs'), path = require('path');
const sim = require('../../sim.js');
const OUT = path.join(__dirname, '../../output/playwright/bioconnect-call-video/scenes.json');
const SEEDS = Number(process.argv[2]) || 300;
const BLOCKERS = ['stone', 'bones', 'thicket', 'bush', 'rock', 'bone'];

sim.use({});
const { ctx, state } = sim.G();
const place = ctx.placeTile;
let seed = 0;
const scenes = [];
ctx.placeTile = function (i) {
  const g = ctx.previewGrowth(i);
  if (g.length >= 7) {
    scenes.push({ seed, i, n: g.length, kind: g[g.length - 1].kind,
      cleared: g[g.length - 1].bones.length, ticks: state.ticks,
      state: JSON.parse(JSON.stringify(state)) });
  }
  return place(i);
};
for (seed = 1; seed <= SEEDS; seed++) {
  let a = seed;
  ctx.gameRandom = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  ctx.newGame();
  sim.spendAll(sim.carefulBot, 'opening');
  while (!state.over && state.ticks < 600) { ctx.worldTick(); if (!state.over) sim.spendAll(sim.carefulBot, 'tick'); }
}
scenes.sort((x, y) => y.n - x.n || y.cleared - x.cleared);
fs.writeFileSync(OUT, JSON.stringify(scenes));
console.log(scenes.length, 'scenes');
console.log(scenes.slice(0, 15).map(({ seed, i, n, kind, cleared, ticks }) => ({ seed, i, n, kind, cleared, ticks })));
