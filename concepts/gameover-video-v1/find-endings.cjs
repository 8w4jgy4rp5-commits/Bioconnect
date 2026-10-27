// Plays seeded runs with the bots and keeps the board at the moment each run
// ends (just before endRun), so capture.cjs can replay real game overs.
//   node find-endings.cjs [count]
const fs = require('fs'), path = require('path');
const sim = require('../../sim.js');
const OUT = path.join(__dirname, '../../output/playwright/gameover-video');
const COUNT = Number(process.argv[2]) || 16;

sim.use({});
const { ctx, state } = sim.G();
const end = ctx.endRun;
let snap = null;
ctx.endRun = function () { snap = JSON.parse(JSON.stringify(state)); return end(); };
const endings = [];
for (let seed = 1; endings.length < COUNT && seed < 500; seed++) {
  let a = seed * 7919;
  ctx.gameRandom = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // a mix of careful and casual play gives short and long runs alike
  const bot = seed % 3 ? sim.carefulBot : sim.casualBot;
  snap = null;
  ctx.newGame();
  sim.spendAll(bot, 'opening');
  while (!state.over && state.ticks < 900) { ctx.worldTick(); if (!state.over) sim.spendAll(bot, 'tick'); }
  // the elephant ending opens its own popup; keep the plain ones
  if (snap && !snap.elephants) endings.push({ seed, score: snap.score, top: snap.topKind, ticks: snap.ticks, state: snap });
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + '/endings.json', JSON.stringify(endings));
console.log(endings.map(({ seed, score, top, ticks }) => ({ seed, score: Math.round(score), top, ticks })));
