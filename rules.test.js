// ============================================================
// Rule tests for the food web — run them with `node rules.test.js`.
//
// sim.js answers "is the game fair?" over thousands of random runs.
// This file answers "does the rule do what it says?" on boards built by
// hand, one rule per board, because an average cannot tell you whether a
// wolf beside a rabbit and a fox reached for the right one.
//
// It loads the real script.js in a sandbox the same way sim.js does, so
// there is no second copy of the rules to drift out of step.
// ============================================================

const fs = require('fs');
const vm = require('vm');
const path = require('path');

function load() {
  const code = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  const ctx = {
    console, Math: Object.create(Math), Number, Set, Array, JSON,
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: () => {},
    document: { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null },
    window: {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    code + '\n;globalThis.__x = { state, CELLS, SIZE, MERGE_AT, ANIMALS, MEAL_VALUE, GROWS_INTO, HAND_MAX,'
         + ' ELEPHANT_BASE_EAT_AT, ELEPHANT_BASE_STARVE_AT, ELEPHANT_HUNGER_PCT, ELEPHANT_MEAL_PCT, LADDER,'
         + ' SEASON_LENGTH, DIFFICULTY_STAGES, GRASS_IN_HAND, RULES_VERSION, ELEPHANT_BONUS, BIG_STAMINA_PCT, el };',
    ctx
  );
  ctx.render = function () {};
  ctx.setTicker = function () {};
  ctx.nudgeHand = function () {};  // it only flashes the DOM
  ctx.syncClock = function () {};   // no real timer in here
  ctx.endRun = function () { state.over = true; };
  const x = ctx.__x;
  x.ctx = ctx;
  return x;
}

const X = load();
const S = X.state;
const at = (x, y) => y * X.SIZE + x;
const cell = (x, y) => S.cells[at(x, y)];

// A fifth element marks a tile as raised — the thing a merge produces
// and the only thing an elephant will eat. Left off, a tile is wild,
// which is what every board written before the elephant meant anyway.
function board(spec) {
  for (let i = 0; i < X.CELLS; i++) S.cells[i] = null;
  for (const [x, y, kind, clock, born] of spec) S.cells[at(x, y)] = { kind, clock: clock || 0, born: born || 'wild' };
}
const RAISED = 'raised';
const starving = (kind) => X.ANIMALS[kind].eatAt;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass += 1; console.log('  ok   ' + name); }
  else { fail += 1; console.log('  FAIL ' + name + (extra ? '   -> ' + extra : '')); }
}
function show(m) { return JSON.stringify(m.map((x) => x.kind + '<-' + x.ateKind)); }

// ---------- who eats what ----------
console.log('\nwho eats what');

board([[1, 1, 'wolf', starving('wolf')], [0, 1, 'rabbit'], [2, 1, 'fox']]);
let m = X.ctx.feedEveryone();
ok('a wolf beside a rabbit and a fox takes the rabbit — cheapest first',
   m.length === 1 && m[0].ateKind === 'rabbit', show(m));

board([[1, 1, 'wolf', starving('wolf')], [2, 1, 'fox']]);
m = X.ctx.feedEveryone();
ok('a wolf with only a fox beside it takes the fox', m.length === 1 && m[0].ateKind === 'fox', show(m));
ok('and that meal is worth a fox', m.length === 1 && m[0].points === X.MEAL_VALUE.fox,
   m.length ? String(m[0].points) : 'no meal');

board([[1, 1, 'fox', starving('fox')], [0, 1, 'grass'], [2, 1, 'rabbit']]);
m = X.ctx.feedEveryone();
ok('a fox beside grass and a rabbit takes the rabbit', m.length === 1 && m[0].ateKind === 'rabbit', show(m));

board([[1, 1, 'fox', starving('fox')], [2, 1, 'grass']]);
m = X.ctx.feedEveryone();
ok('a fox with no rabbit falls back to grass', m.length === 1 && m[0].ateKind === 'grass', show(m));
ok('and a mouthful of grass is worth grass, not a fox',
   m.length === 1 && m[0].points === X.MEAL_VALUE.grass, m.length ? String(m[0].points) : 'no meal');

board([[1, 1, 'fox', starving('fox')], [2, 1, 'fox', starving('fox')]]);
m = X.ctx.feedEveryone();
ok('a hungry fox does not eat another fox — a rung never eats its own', m.length === 0, show(m));

// ---------- grass is safe ground ----------
console.log('\ngrass is safe ground');

board([[1, 1, 'wolf', starving('wolf')], [0, 1, 'grass'], [2, 1, 'grass'], [1, 0, 'grass'], [1, 2, 'grass']]);
m = X.ctx.feedEveryone();
ok('a starving wolf ringed by grass eats nothing', m.length === 0, show(m));
ok('and the grass is all still standing',
   [[0, 1], [2, 1], [1, 0], [1, 2]].every(([x, y]) => cell(x, y) && cell(x, y).kind === 'grass'));

// ---------- hunger is the trigger, not adjacency ----------
console.log('\nhunger is the trigger, not adjacency');

board([[1, 1, 'wolf', starving('wolf') - 1], [2, 1, 'fox']]);
m = X.ctx.feedEveryone();
ok('a wolf one turn short of hungry leaves the fox alone', m.length === 0, show(m));
ok('so a fox may be built beside a fed wolf in safety', cell(2, 1) && cell(2, 1).kind === 'fox');

// ---------- order of settling ----------
console.log('\norder of settling');

board([[1, 1, 'wolf', starving('wolf')], [2, 1, 'rabbit', starving('rabbit')], [3, 1, 'grass']]);
m = X.ctx.feedEveryone();
ok('the wolf takes the rabbit before that rabbit can strip the grass',
   m.length === 1 && m[0].kind === 'wolf' && cell(3, 1) && cell(3, 1).kind === 'grass', show(m));

// ---------- the ladder ----------
console.log('\nthe ladder');
ok('a fox grows into a deer', X.GROWS_INTO.fox === 'deer');
ok('two foxes make a deer', X.MERGE_AT.fox === 2);
ok('two wolves grow into a bear', X.GROWS_INTO.wolf === 'bear' && X.MERGE_AT.wolf === 2);
ok('elephant is the final rung', !X.GROWS_INTO.elephant);

const rank = (k) => { let n = 0, c = 'sprout'; while (c && c !== k) { c = X.GROWS_INTO[c]; n += 1; } return c === k ? n : -1; };
let bad = '';
for (const k in X.ANIMALS) {
  for (const d of X.ANIMALS[k].diet) {
    if (rank(d) < 0) bad = k + ' eats "' + d + '", which is not on the ladder';
    else if (rank(d) >= rank(k)) bad = k + ' eats ' + d + ', which is not below it';
  }
}
ok('every diet entry is a real rung below its eater', !bad, bad);

// Counted in PREY RUNGS, not diet entries.
//
// This used to count the whole diet and it broke the day plants became
// an emergency ration, which is the test doing its job: the two halves
// of a diet are not the same thing and were being added together. The
// animals a rung can take is the food chain widening as it climbs — a
// wolf takes hares and foxes and whatever else is slow that day. The
// plants underneath are the fire escape, and the apex deliberately does
// not get one, so counting those in made a shorter wolf menu look like
// a narrowing chain when it is the opposite.
const climb = ['rabbit', 'fox', 'wolf'].sort((a, b) => rank(a) - rank(b));
const preyRungs = (k) => X.ANIMALS[k].diet.filter((d) => X.ANIMALS[d]).length;
let widen = true;
for (let i = 1; i < climb.length; i++) {
  if (preyRungs(climb[i]) < preyRungs(climb[i - 1])) widen = false;
}
ok('the animals a rung can take widen as the ladder climbs, never narrow', widen,
   climb.map((a) => a + ':' + preyRungs(a)).join(' '));

// and the plant half, which runs the other way on purpose
const plantFallbacks = (k) => X.ANIMALS[k].diet.filter((d) => !X.ANIMALS[d]).length;
ok('the higher the rung, the less it can scrape by on plants',
   plantFallbacks('wolf') <= plantFallbacks('fox') && plantFallbacks('fox') <= plantFallbacks('rabbit'),
   climb.map((a) => a + ':' + plantFallbacks(a)).join(' '));

const priced = Object.keys(X.ANIMALS).every((k) => X.ANIMALS[k].diet.every((d) => X.MEAL_VALUE[d] > 0));
ok('every meal on every diet has a price', priced);

// ---------- a life is always one tap away ----------
//
// The clock is counted in taps and the player only gets one tap, so a
// meal that costs three taps to build costs a third of the whole budget
// per animal — three animals and there is nothing left to play with.
// The bottom rung of the plant ladder being edible is what breaks that,
// and it is load-bearing enough to check rather than assume.
console.log('\na life is always one tap away');

const HAND = ['sprout', 'grass'];          // everything the hand can deal
for (const kind of ['rabbit', 'fox']) {
  const saveable = HAND.filter((h) => X.ANIMALS[kind].diet.indexOf(h) >= 0);
  ok('a starving ' + kind + ' can be saved with a tile the hand actually deals',
     saveable.length > 0, 'diet ' + JSON.stringify(X.ANIMALS[kind].diet));
  ok('...including the one it always has — a sprout',
     X.ANIMALS[kind].diet.indexOf('sprout') >= 0);
}

board([[1, 1, 'rabbit', starving('rabbit')], [2, 1, 'sprout']]);
m = X.ctx.feedEveryone();
ok('a starving rabbit will take a bare sprout', m.length === 1 && m[0].ateKind === 'sprout', show(m));
ok('and the rabbit is fed, not merely fewer sprouts',
   cell(1, 1) && cell(1, 1).clock === 0 && !cell(2, 1));

board([[1, 1, 'rabbit', starving('rabbit')], [0, 1, 'sprout'], [2, 1, 'grass']]);
m = X.ctx.feedEveryone();
ok('given both, it takes the grass and leaves the sprout standing',
   m.length === 1 && m[0].ateKind === 'grass' && cell(0, 1) && cell(0, 1).kind === 'sprout', show(m));

board([[1, 1, 'rabbit', starving('rabbit') - 1], [2, 1, 'sprout']]);
m = X.ctx.feedEveryone();
ok('sprouts are still safe to build beside a rabbit that is not red yet', m.length === 0, show(m));

// the rescue must never be the efficient play: grass is MERGE_SPROUT taps
// for MEAL_VALUE.grass, a sprout is one tap for MEAL_VALUE.sprout
const perTapGrass = X.MEAL_VALUE.grass / X.MERGE_AT.sprout;
ok('panicking costs score — a sprout pays less per tap than grass does',
   X.MEAL_VALUE.sprout < perTapGrass,
   X.MEAL_VALUE.sprout + ' vs ' + perTapGrass.toFixed(1) + ' a tap');

ok('the wolf keeps its short menu — an apex saved by a sprout is not one',
   X.ANIMALS.wolf.diet.indexOf('sprout') < 0);

// ---------- the red bar means what it says ----------
//
// The one rule the player reads off the board is "an animal reaches out
// when its bar is red". That is not written down anywhere in the code —
// it falls out of EAT_AT, STARVE_AT and the 34% the meter paints red
// agreeing with each other. Nudge any of the three and the promise
// quietly breaks, so check the arithmetic rather than trusting it.
console.log('\nthe red bar means what it says');

const RED_AT = 0.34;                       // matches the meter's is-low cut
const red = (kind, clock) => X.ctx.vitality({ kind, clock }) <= RED_AT;

for (const kind in X.ANIMALS) {
  const cfg = X.ANIMALS[kind];
  // The promise is one-directional: nothing is taken off the board
  // without the player having been shown a red bar first. The bar going
  // red a turn early is a warning, not a lie — the bar going red LATE
  // would be, so that is the edge worth pinning.
  ok('a ' + kind + ' is already red the turn it reaches out', red(kind, cfg.eatAt),
     'eatAt ' + cfg.eatAt + ' of ' + cfg.starveAt);
  ok('a just-fed ' + kind + ' is not red', !red(kind, 0));
  ok('a ' + kind + ' that reaches out has at least one turn left to be answered in',
     cfg.starveAt > cfg.eatAt, 'window ' + (cfg.starveAt - cfg.eatAt));
}

// ---------- your move costs the world nothing ----------
//
// This is the whole point of the rewrite, so it is checked directly
// rather than inferred. If any of these start failing, the game has
// quietly gone back to being a treadmill.
console.log('\nyour move costs the world nothing');

// newGame() is not called here — it reaches for the DOM. Every board in
// this file is built by hand anyway, which is the point of the file.
const beforeClocks = () => S.cells.filter((c) => c).map((c) => c.kind + ':' + c.clock).join(' ');

board([[0, 0, 'rabbit', 4], [4, 4, 'grass', 3]]);
S.ticks = 7;
S.stock = ['sprout', 'sprout', 'sprout'];
const clocksWere = beforeClocks();
X.ctx.placeTile(at(2, 2));
ok('placing does not advance the world clock', S.ticks === 7, 'ticks ' + S.ticks);
ok('placing does not age anything already on the board',
   beforeClocks().replace(' sprout:0', '').replace('sprout:0 ', '') === clocksWere,
   beforeClocks());
ok('placing immediately replaces the tile', S.stock.length === 3, 'stock ' + S.stock.length);
ok('the first queued tile is planted', cell(2, 2).kind === 'sprout');

// three placements between two ticks is the move the old game could not
// express: a whole hand emptied into one crisis, at no cost in time
S.stock = ['sprout', 'sprout', 'sprout'];
S.ticks = 7;
X.ctx.placeTile(at(0, 2));
X.ctx.placeTile(at(0, 3));
X.ctx.placeTile(at(1, 3));
ok('a whole hand can be spent between two ticks', S.ticks === 7 && S.stock.length === 3,
   'ticks ' + S.ticks + ' stock ' + S.stock.length);

// and the reverse: an empty hand means the board cannot be touched
S.stock = [];
const wasEmpty = !cell(3, 3);
X.ctx.placeTile(at(3, 3));
ok('an empty hand places nothing', wasEmpty && !cell(3, 3));

// the world moves on its own, with nobody playing at all
board([[2, 2, 'rabbit', X.ANIMALS.rabbit.starveAt - 1]]);
S.stock = []; S.ticks = 0; S.over = false;
X.ctx.worldTick();
ok('the world ages the board with no placement at all',
   cell(2, 2) && cell(2, 2).kind === 'bones', cell(2, 2) && cell(2, 2).kind);
ok('and the world clock did advance', S.ticks === 1, 'ticks ' + S.ticks);

// a tile arrives on the world's clock, not on yours
S.stock = []; S.refill = 0;
X.ctx.worldTick();
ok('a tick deals a tile into an empty hand', S.stock.length === 1, 'stock ' + S.stock.length);
for (let n = 0; n < 10; n++) X.ctx.worldTick();
ok('and the hand never exceeds HAND_MAX', S.stock.length <= X.HAND_MAX, 'stock ' + S.stock.length);


// A deliberate two-step chain clears multiple adjacent obstacles.
board([[1, 2, 'sprout'], [1, 1, 'grass'], [0, 2, 'stone'], [1, 0, 'bones'], [0, 1, 'scrub']]);
S.stock = ['sprout', 'grass', 'sprout']; S.next = 'grass'; S.over = false;
X.ctx.placeTile(at(2, 2));
ok('a two-step chain creates a rabbit', cell(1, 1).kind === 'rabbit');
ok('the chain clears all three neighboring blockers', !cell(0, 2) && !cell(1, 0) && !cell(0, 1));
ok('the hand advances in order and appends the preview', S.stock.join(',') === 'grass,sprout,grass');

// Regression: rabbit | grass | sprout | new sprout chains back to fox.
board([[0, 2, 'rabbit'], [1, 2, 'grass'], [2, 2, 'sprout']]);
S.stock = ['sprout', 'grass', 'sprout']; S.over = false;
const beforePreview = JSON.stringify(S);
const forecast = X.ctx.previewGrowth(at(3, 2));
ok('preview leaves all live state unchanged', JSON.stringify(S) === beforePreview);
ok('preview predicts three growths ending at the original rabbit', forecast.length === 3 && forecast[2].at === at(0, 2));
X.ctx.placeTile(at(3, 2));
ok('the chain reaches a fox without leaving gaps between rungs', cell(0, 2).kind === 'fox' && !cell(1, 2) && !cell(2, 2) && !cell(3, 2));
// Regression: grass | new grass | rabbit. Landing on the existing grass
// put the new rabbit one square away from the old one and broke the chain.
board([[0, 2, 'grass'], [2, 2, 'rabbit']]);
S.stock = ['grass']; S.over = false;
X.ctx.placeTile(at(1, 2));
ok('a growth lands next to the rung it can join', cell(2, 2) && cell(2, 2).kind === 'fox' && !cell(0, 2) && !cell(1, 2),
  [0, 1, 2].map(x => cell(x, 2) ? cell(x, 2).kind : '.').join(','));
board([[1, 2, 'sprout'], [3, 2, 'sprout']]);
S.stock = ['sprout'];
const tie = X.ctx.previewGrowth(at(2, 2));
ok('ambiguous merges use the left existing tile consistently', tie[0].at === at(1, 2));

// Bear milestone, dietary preference, continued play, and starvation.
board([[1, 1, 'wolf'], [2, 1, 'wolf']]);
const bearGrowth = X.ctx.growFrom(at(2, 1));
ok('wolves merge into a bear on the existing square', cell(1, 1).kind === 'bear' && !cell(2, 1));
ok('bear growth awards 1500 base points', X.ctx.growValue('bear') === 1500);
ok('creating a bear does not end the run', !S.over);
board([[1, 1, 'bear', starving('bear')], [2, 1, 'grass'], [0, 1, 'rabbit']]);
m = X.ctx.feedEveryone();
ok('bear prefers grass over rabbits', m.length === 1 && m[0].ateKind === 'grass' && cell(0, 1).kind === 'rabbit');
board([[1, 1, 'bear', starving('bear')], [2, 1, 'rabbit']]);
m = X.ctx.feedEveryone();
ok('bear can eat rabbits when grass is absent', m.length === 1 && m[0].points === 500);
board([[1, 1, 'bear', starving('bear')], [2, 1, 'wolf'], [0, 1, 'fox'], [1, 0, 'sprout']]);
ok('bear leaves wolves, foxes and sprouts alone', X.ctx.feedEveryone().length === 0);
board([[1, 1, 'bear', X.ANIMALS.bear.starveAt]]);
X.ctx.collectDeaths();
ok('unfed bear leaves bones', cell(1, 1).kind === 'bones');

// Every milestone is reachable by its actual merge rule and remains playable.
for (const [lower, upper] of Object.entries(X.GROWS_INTO)) {
  board([[1, 1, lower], [2, 1, lower]]); S.over = false;
  const events = X.ctx.growFrom(at(2,1));
  ok(lower + ' pair reaches ' + upper, cell(1,1).kind === upper && events.length === 1);
  ok(upper + ' produces finite positive growth points', Number.isFinite(X.ctx.growValue(upper)) && X.ctx.growValue(upper) > 0);
}
for (const k of Object.keys(X.ANIMALS)) {
  for (const food of X.ANIMALS[k].diet) {
    // A mouth with `needs` is fussier than its diet alone: the elephant
    // wants the same kinds, but only ones the player raised.
    board([[1,1,k,X.ANIMALS[k].eatAt],[2,1,food,0,X.ANIMALS[k].needs]]);
    const meals = X.ctx.feedEveryone();
    ok(k + ' eats ' + food, meals.length === 1 && Number.isFinite(meals[0].points));
  }
}
// A hungry hunter takes a dealt animal before one the player grew
// (rules 19), even when the grown one is cheaper or nearer to starving.
board([[1, 1, 'wolf', starving('wolf')], [0, 1, 'rabbit', 9, RAISED], [2, 1, 'deer', 0, RAISED], [1, 0, 'fox']]);
let wm = X.ctx.feedEveryone();
ok('a wolf takes the dealt fox over a raised rabbit', wm.length === 1 && wm[0].ateKind === 'fox' && cell(0, 1) && cell(2, 1));
board([[1, 1, 'wolf', starving('wolf')], [2, 1, 'deer', 0, RAISED]]);
wm = X.ctx.feedEveryone();
ok('...and still eats a raised deer when nothing dealt is beside it', wm.length === 1 && wm[0].ateKind === 'deer');
board([[1, 1, 'lion', starving('lion')], [2, 1, 'deer', 0, RAISED], [0, 1, 'fox']]);
wm = X.ctx.feedEveryone();
ok('a lion can be fed a dealt fox', wm.length === 1 && wm[0].ateKind === 'fox' && cell(2, 1).kind === 'deer');
board([[1, 1, 'tiger', starving('tiger')], [0, 1, 'fox']]);
ok('so can a tiger', X.ctx.feedEveryone().length === 1);
// The deal follows the clock, and raising a zebra jumps it to the winter
// row (rules 19). Nothing else a player discovers changes it. Exhaust the
// random input deterministically for every stage and every top rung.
const originalRandom = X.ctx.Math.random;
function dealAt(ticks, top) {
  S.topKind = top; S.ticks = ticks;
  const n = {};
  for (let i = 0; i < 1000; i++) {
    X.ctx.Math.random = () => (i + 0.5) / 1000;
    const k = X.ctx.rollHand();
    n[k] = (n[k] || 0) + 1;
  }
  return n;
}
let sameAcrossDiscoveries = true, neverAboveFox = true, zebraWidens = true;
const ZEBRA = X.LADDER.indexOf('zebra');
for (const ticks of [0, 24, 25, 50, 75, 175, 10000]) {
  const ref = JSON.stringify(dealAt(ticks, 'sprout'));
  const wide = JSON.stringify(dealAt(10000, 'sprout'));
  for (const top of X.LADDER) {
    const d = dealAt(ticks, top);
    if (X.LADDER.indexOf(top) < ZEBRA && JSON.stringify(d) !== ref) sameAcrossDiscoveries = false;
    if (X.LADDER.indexOf(top) >= ZEBRA && JSON.stringify(d) !== wide) zebraWidens = false;
    for (const k in d) if (['sprout', 'grass', 'rabbit', 'fox'].indexOf(k) < 0) neverAboveFox = false;
  }
}
ok('below the zebra, discoveries never change the deal — only the clock does', sameAcrossDiscoveries);
ok('from the zebra up, the hand deals the winter row in any season', zebraWidens);
ok('the hand never holds anything above the fox', neverAboveFox);
const spring = dealAt(0, 'sprout'), summer = dealAt(25, 'sprout'), autumn = dealAt(50, 'sprout'), winter = dealAt(10000, 'elephant');
ok('spring deals plants only, half and half',
   spring.grass === X.GRASS_IN_HAND * 10 && spring.sprout === 1000 - X.GRASS_IN_HAND * 10, JSON.stringify(spring));
ok('summer adds rabbits but no foxes', summer.rabbit === 100 && !summer.fox, JSON.stringify(summer));
ok('autumn adds the first foxes', autumn.rabbit === 150 && autumn.fox === 50, JSON.stringify(autumn));
ok('winter deals a fifth rabbits and a tenth foxes, to the end', winter.rabbit === 200 && winter.fox === 100, JSON.stringify(winter));
board([]); S.topKind = 'elephant'; S.ticks = 10000; S.over = false;
S.stock = ['sprout', 'grass', 'sprout']; S.next = 'grass';
X.ctx.Math.random = () => 0.99;
X.ctx.placeTile(at(2, 2));
ok('late placement refills from the winter deal and keeps the queue order',
   S.stock.join(',') === 'grass,sprout,grass' && S.next === 'fox', S.stock.join(',') + ' / ' + S.next);
S.stock = []; S.refill = 0; S.next = 'sprout'; S.ticks = 0; S.topKind = 'sprout';
X.ctx.Math.random = () => 0.99;
X.ctx.refillHand();
ok('spring fallback refill deals only plants', S.stock[0] === 'sprout' && S.next === 'grass');
board([]); S.topKind = 'grass'; S.stock = ['fox', 'grass', 'grass']; S.over = false;
X.ctx.placeTile(at(0, 0));
ok('a fox from the hand counts as reaching the fox', S.topKind === 'fox', S.topKind);
X.el.gameover = {};
X.ctx.newGame();
ok('restart resets difficulty and deals plants', S.ticks === 0 && X.ctx.scoreMultiplier() === 1
   && S.stock.length === X.HAND_MAX && S.stock.every(k => k === 'grass' || k === 'sprout'));
X.ctx.Math.random = originalRandom;

console.log('time pressure and rewards');
let monotonic = true, gradual = true;
let prevStone = Infinity, prevLife = Infinity, prevMultiplier = 0;
for (let ticks = 0; ticks <= 1000; ticks++) {
  S.ticks = ticks;
  const stone = X.ctx.stoneEvery(), life = X.ctx.plantLimit('sprout'), mult = X.ctx.scoreMultiplier();
  if (stone > prevStone || life > prevLife || mult < prevMultiplier) monotonic = false;
  if (ticks && prevLife - life > 1) gradual = false;
  prevStone = stone; prevLife = life; prevMultiplier = mult;
}
ok('pressure and rewards never fall with elapsed world time', monotonic);
ok('plant lifetime never drops by more than one tick at a time', gradual);
const intervals = [12, 10, 8, 6, 5, 4, 3, 2];
for (let stage = 0; stage < X.DIFFICULTY_STAGES; stage++) {
  S.ticks = stage * X.SEASON_LENGTH; S.score = 0;
  ok('stage ' + stage + ' has its intended stone pressure', X.ctx.stoneEvery() === intervals[stage]);
  ok('stage ' + stage + ' multiplies both growth and meals',
    X.ctx.scoreGrowth([{ kind: 'rabbit' }]) === 50 * (stage + 1)
    && X.ctx.scoreMeals([{ points: 100 }]) === 100 * (stage + 1));
  if (stage) {
    S.ticks--;
    ok('reward changes at the boundary, not one tick early (' + stage + ')', X.ctx.scoreMultiplier() === stage);
  }
}
S.ticks = 10000;
ok('endless play has bounded positive pressure and rewards', X.ctx.stoneEvery() === 2
   && X.ctx.plantLimit('sprout') === 14 && X.ctx.scoreMultiplier() === 8);
S.ticks = 25; S.relaxed = false;
ok('normal challenge countdown uses world time', X.ctx.nextDifficultySeconds() === 45);
S.relaxed = true;
ok('relaxed countdown gives twice the thinking time', X.ctx.nextDifficultySeconds() === 90);
S.relaxed = false; S.ticks = 24; S.paused = true; S.score = 0; board([]);
X.ctx.worldTick();
ok('pause freezes the stage and earns no passive score', S.ticks === 24 && S.score === 0);
S.paused = false;
X.ctx.worldTick();
ok('world time advances difficulty without granting passive score', S.ticks === 25
   && X.ctx.scoreMultiplier() === 2 && S.score === 0);
ok('scores from earlier rules use a different rules version', X.RULES_VERSION === 19);
vm.runInContext('scoreStore = { get: () => ({ rules: 15, best: 999999 }) };', X.ctx);
ok('old high-supply records cannot become the new best', X.ctx.readBest() === 0);
vm.runInContext('scoreStore = { get: () => ({ rules: 19, best: 15000 }) };', X.ctx);
ok('current-rule records still load normally', X.ctx.readBest() === 15000);
vm.runInContext('scoreStore = null;', X.ctx);
S.topKind = 'sprout'; S.ticks = 0;

// ---------- the ground keeps clear of animals ----------
//
// A stone taking the last bare square beside a hungry animal is a death
// the player had no move against, which is the one thing the ground is
// not allowed to do.
console.log('\nthe ground keeps clear of animals');

// rabbit at the middle, so 4 of the 25 squares touch it
function stoneLands() {
  S.ticks = 0;                             // ticks % stoneEvery() === 0
  const put = X.ctx.surfaceStone();
  return put ? put.at : -1;
}

let touched = 0;
for (let n = 0; n < 200; n++) {
  board([[2, 2, 'rabbit', starving('rabbit')]]);
  const put = stoneLands();
  if (put >= 0 && X.ctx.neighbours(put).indexOf(at(2, 2)) >= 0) touched += 1;
}
ok('200 stones, none of them beside the rabbit', touched === 0, touched + ' landed beside it');

// the fallback: box the rabbit's whole row in so the only bare squares
// left are ones that touch it. The ground still has to take its turn.
board([
  [2, 2, 'rabbit', starving('rabbit')],
  [1, 2, 'scrub'], [3, 2, 'scrub'], [2, 1, 'scrub'],
]);
for (let i = 0; i < X.CELLS; i++) if (!S.cells[i] && i !== at(2, 2) && i !== at(2, 3)) S.cells[i] = { kind: 'stone', clock: 0 };
ok('with nowhere else left, the stone still lands', stoneLands() === at(2, 3));

// ---------- the elephant ----------
//
// Three rules, each of which can be got wrong on its own: it eats only
// raised animals, it runs down two and a half times faster than anything
// else, and its meal pays a multiple. The boards below take them one at
// a time, because an elephant that starves in a full meadow and an
// elephant that eats grass look identical from a score column.
console.log('\nthe elephant');

const eleHungry = starving('elephant');

board([[2, 2, 'elephant', eleHungry], [1, 2, 'grass'], [3, 2, 'sprout']]);
m = X.ctx.feedEveryone();
ok('an elephant will not touch grass or sprouts', m.length === 0, show(m));
ok('...and the plants are still standing', cell(1, 2).kind === 'grass' && cell(3, 2).kind === 'sprout');

board([[2, 2, 'elephant', eleHungry], [1, 2, 'rabbit'], [3, 2, 'deer'], [2, 1, 'tiger']]);
m = X.ctx.feedEveryone();
ok('an elephant will not eat wild animals, however many are beside it', m.length === 0, show(m));

board([[2, 2, 'elephant', eleHungry], [1, 2, 'deer', 0, RAISED]]);
m = X.ctx.feedEveryone();
ok('an elephant eats a raised animal beside it',
   m.length === 1 && m[0].kind === 'elephant' && m[0].ateKind === 'deer', show(m));
ok('...and the meal pays ELEPHANT_MEAL_PCT of the prey',
   m.length === 1 && m[0].points === Math.round(X.MEAL_VALUE.deer * X.ELEPHANT_MEAL_PCT / 100),
   m.length ? String(m[0].points) : 'no meal');
ok('...which is the highest meal in the game',
   Math.round(X.MEAL_VALUE.tiger * X.ELEPHANT_MEAL_PCT / 100) > Math.max.apply(null, Object.values(X.MEAL_VALUE)));

board([[2, 2, 'elephant', eleHungry], [1, 2, 'rabbit', 0, RAISED], [3, 2, 'tiger', 0, RAISED]]);
m = X.ctx.feedEveryone();
ok('an elephant beside two raised animals takes the cheaper one — same rule as every predator',
   m.length === 1 && m[0].ateKind === 'rabbit', show(m));

board([[2, 2, 'elephant', eleHungry], [1, 2, 'rabbit'], [3, 2, 'tiger', 0, RAISED]]);
m = X.ctx.feedEveryone();
ok('a wild rabbit does not shield a raised tiger — the elephant skips past it',
   m.length === 1 && m[0].ateKind === 'tiger', show(m));

board([[2, 2, 'elephant', 0], [1, 2, 'deer', 0, RAISED]]);
m = X.ctx.feedEveryone();
ok('a fed elephant eats nothing — the red bar rule still holds', m.length === 0, show(m));

// hunger and death
ok('the elephant is hungry two to three times faster than its base pace',
   X.ANIMALS.elephant.eatAt === Math.round(X.ELEPHANT_BASE_EAT_AT * 100 / X.ELEPHANT_HUNGER_PCT)
   && X.ELEPHANT_HUNGER_PCT >= 200 && X.ELEPHANT_HUNGER_PCT <= 300,
   X.ANIMALS.elephant.eatAt + '/' + X.ANIMALS.elephant.starveAt);
ok('...which makes it the shortest-lived animal on the top half of the ladder',
   X.ANIMALS.elephant.starveAt < X.ANIMALS.tiger.starveAt && X.ANIMALS.elephant.starveAt < X.ANIMALS.bear.starveAt);
ok('and it still dies before it can eat again', X.ANIMALS.elephant.eatAt < X.ANIMALS.elephant.starveAt);

board([[2, 2, 'elephant', X.ANIMALS.elephant.starveAt]]);
let d = X.ctx.collectDeaths();
ok('an unfed elephant starves like anything else', d.length === 1 && d[0].kind === 'elephant', JSON.stringify(d));
ok('...and leaves bones on its square', cell(2, 2).kind === 'bones');

// where raised tiles come from
board([[1, 2, 'tiger'], [2, 2, 'tiger']]);
let grew = X.ctx.growFrom(at(2, 2));
ok('two tigers grow into an elephant', grew.length === 1 && grew[0].kind === 'elephant', JSON.stringify(grew));
ok('...and a merge marks what it leaves behind as raised',
   X.ctx.isRaised(S.cells[grew[0].at]), JSON.stringify(S.cells[grew[0].at]));

board([[2, 2, 'grass'], [3, 2, 'grass'], [1, 2, 'elephant', eleHungry]]);
grew = X.ctx.growFrom(at(3, 2));
m = X.ctx.feedEveryone();
ok('a rabbit the player just merged is food, one turn old',
   grew.length === 1 && grew[0].kind === 'rabbit' && m.length === 1 && m[0].ateKind === 'rabbit', show(m));

// what the board tells the player
board([[2, 2, 'elephant', eleHungry], [1, 2, 'deer']]);
m = X.ctx.feedEveryone();
ok('a hungry elephant that found nothing is reported as refused',
   (m.refused || []).some(function (r) { return r.kind === 'elephant'; }), JSON.stringify(m.refused));
ok('...and the board can tell "wrong food" from "no food"', X.ctx.nearElephant() === true);

board([[2, 2, 'elephant', eleHungry]]);
X.ctx.feedEveryone();
ok('an elephant alone is "no food" instead', X.ctx.nearElephant() === false);

board([[2, 2, 'elephant', 0], [1, 2, 'deer', 0, RAISED], [3, 2, 'deer']]);
ok('the larder counts raised animals only', X.ctx.elephantLarder() === 1, String(X.ctx.elephantLarder()));

// the warning ring reads the same rule the bite does
board([[2, 2, 'elephant', eleHungry - 1], [1, 2, 'deer'], [3, 2, 'deer', 0, RAISED]]);
const reach = X.ctx.inReach();
ok('the about-to-be-eaten ring marks the raised deer', reach.has(at(3, 2)));
ok('...and leaves the wild one alone', !reach.has(at(1, 2)));

// ---------- the elephant is 2x2 ----------
//
// It is the only tile that does not fit in a square, and every rule that
// walks the board once per animal has to be told so. The tests that
// matter are the ones where "four squares" could quietly become "four
// animals": one clock, one meal, one skeleton.
console.log('\nthe elephant takes four squares');

// Standing an elephant by hand, the way the game does: one tile written
// into all four squares, with `big` naming the top-left one.
function bigElephant(x, y, clock) {
  const home = at(x, y);
  const tile = { kind: 'elephant', clock: clock || 0, born: RAISED, big: home };
  for (const i of [home, home + 1, home + X.SIZE, home + X.SIZE + 1]) S.cells[i] = tile;
  return home;
}

board([[1, 2, 'tiger'], [2, 2, 'tiger']]);
grew = X.ctx.growFrom(at(2, 2));
let block4 = [grew[0].at, grew[0].at + 1, grew[0].at + X.SIZE, grew[0].at + X.SIZE + 1];
ok('a new elephant stands on four squares',
   block4.every(function (i) { return S.cells[i] && S.cells[i].kind === 'elephant'; }),
   JSON.stringify(block4.map(function (i) { return S.cells[i] && S.cells[i].kind; })));
ok('...all four of them naming one home square',
   block4.every(function (i) { return S.cells[i].big === grew[0].at; }));
ok('...and the block covers the square the merge landed on', block4.indexOf(at(1, 2)) >= 0);
ok('...so the board counts one elephant, not four', X.ctx.countKind('elephant') === 1,
   String(X.ctx.countKind('elephant')));

// One animal, one clock. Four squares sharing a tile used to mean four
// turns of hunger in one tick, which starved it in a quarter of the time.
bigElephant(1, 1, 0);
X.ctx.bumpClocks();
ok('it gets hungry once a turn, not four times', cell(1, 1).clock === 1, String(cell(1, 1).clock));

// ...and one meal. The same bug on the other side: eaten four times over,
// it cleared four raised animals a tick and paid four times the points.
board([[0, 0, 'deer', 0, RAISED], [3, 1, 'deer', 0, RAISED]]);
bigElephant(1, 1, eleHungry);
m = X.ctx.feedEveryone();
ok('it eats once a turn, however many squares it stands on',
   m.filter(function (x) { return x.kind === 'elephant'; }).length === 1, show(m));

// Eight squares touch a 2x2 block, and all eight are within reach. This
// deer touches only the bottom-right square of the block.
board([[3, 2, 'deer', 0, RAISED]]);
bigElephant(1, 1, eleHungry);
m = X.ctx.feedEveryone();
ok('anything touching any of its four squares is within reach',
   m.length === 1 && m[0].ateKind === 'deer', show(m));

// Nothing can refuse it a place: it comes down on whatever is there.
board([[1, 2, 'tiger'], [2, 2, 'tiger'], [1, 1, 'grass'], [2, 1, 'sprout'],
       [1, 3, 'stone'], [2, 3, 'stone'], [3, 2, 'stone'], [3, 3, 'stone']]);
grew = X.ctx.growFrom(at(2, 2));
ok('it arrives even with no room, flattening what it lands on',
   grew.length === 1 && grew[0].kind === 'elephant' && grew[0].trampled.length > 0,
   JSON.stringify(grew));
ok('...and takes the block that flattens the least', grew[0].trampled.length === 1,
   JSON.stringify(grew[0].trampled));
ok('...and breaks a tie by reading order, topmost then leftmost',
   grew[0].at === at(0, 1) && grew[0].trampled[0] === at(1, 1),
   grew[0].at + ' ' + JSON.stringify(grew[0].trampled));

// One skeleton, not four. Four dead squares out of twenty-five would end
// most runs on the spot.
board([]);
let home = bigElephant(1, 1, X.ANIMALS.elephant.starveAt);
d = X.ctx.collectDeaths();
ok('a starved elephant leaves one skeleton', d.length === 1 && cell(1, 1).kind === 'bones',
   JSON.stringify(d));
ok('...and gives the other three squares back', !S.cells[home + 1] && !S.cells[home + X.SIZE]
   && !S.cells[home + X.SIZE + 1]);


// ---------- what a chain leaves behind for the replay ----------
//
// The replay draws a chain one rung at a time, 145ms apart, over a board
// that growFrom has already finished. By then the squares a rung took are
// empty and whatever stood on them is gone, so the only record is what the
// event carries. These check that the record is true, because a wrong
// `from` is not a crash — it is a ghost flying out of the wrong square,
// which nobody would notice until they wondered why the game felt sloppy.
console.log('\nwhat a chain leaves behind for the replay');

board([[2, 1, 'sprout'], [1, 1, 'sprout'], [0, 1, 'grass']]);
const scoreBefore = S.score;
const chain = X.ctx.growFrom(at(2, 1));
ok('a sprout dropped beside a sprout beside a grass is a chain of two',
   chain.length === 2 && chain[0].kind === 'grass' && chain[1].kind === 'rabbit',
   JSON.stringify(chain.map(function (e) { return e.kind; })));
ok('every rung says what was standing on the squares it took',
   chain.every(function (e) { return X.GROWS_INTO[e.was] === e.kind; }),
   JSON.stringify(chain.map(function (e) { return e.was + '->' + e.kind; })));
ok('every rung names exactly the squares it took',
   chain.every(function (e) { return e.from.length === e.size; }),
   JSON.stringify(chain.map(function (e) { return e.from.length + '/' + e.size; })));
ok('...and keeps its result on one of them',
   chain.every(function (e) { return e.from.indexOf(e.at) >= 0; }),
   JSON.stringify(chain.map(function (e) { return e.at + ' in ' + JSON.stringify(e.from); })));
ok('the second rung takes the square the first one landed on',
   chain[1].from.indexOf(chain[0].at) >= 0,
   chain[0].at + ' in ' + JSON.stringify(chain[1].from));

// The ticker says one number and the replay pops one per rung. If the
// shares stopped adding up to the whole, the pops would quietly disagree
// with the score bar and there would be nothing on screen to blame.
const paid = X.ctx.scoreGrowth(chain);
const shares = chain.reduce(function (n, e) { return n + e.points; }, 0);
ok('each rung is paid its own share of the chain', shares === paid, shares + ' vs ' + paid);
ok('...and the shares are the whole of what the chain paid',
   S.score - scoreBefore === shares, (S.score - scoreBefore) + ' vs ' + shares);
ok('...with the bigger rung worth more than the smaller one',
   chain[1].points > chain[0].points, chain[1].points + ' vs ' + chain[0].points);

// ---------- the elephant jackpot and the big animals' patience (rules 17) ----------
//
// The elephant is the watermelon: rare, and worth it when it lands. The
// jackpot is flat and paid once per elephant, on its own rung, so the
// replay pops still add up to the score bar.
console.log('\nthe elephant jackpot');
board([[1, 2, 'tiger'], [2, 2, 'tiger']]);
S.score = 0; S.ticks = 0; S.over = false; S.celebrating = false; S.elephants = 0;
let jack = X.ctx.growFrom(at(2, 2));
let jackPaid = X.ctx.scoreGrowth(jack);
ok('an elephant pays the flat jackpot on top of its growth',
   jackPaid === X.ELEPHANT_BONUS + X.ctx.growValue('elephant'), String(jackPaid));
ok('...carried on its own rung so the replay adds up', jack[0].points === jackPaid && jack[0].bonus === X.ELEPHANT_BONUS,
   JSON.stringify(jack[0]));
S.ticks = X.SEASON_LENGTH * 5; S.score = 0;
board([[1, 2, 'tiger'], [2, 2, 'tiger']]);
jack = X.ctx.growFrom(at(2, 2));
ok('...and the season does not multiply the jackpot',
   X.ctx.scoreGrowth(jack) === X.ELEPHANT_BONUS + X.ctx.growValue('elephant') * X.ctx.scoreMultiplier());
S.ticks = 0;
ok('the jackpot alone lifts a typical run by over two thousand shown points',
   X.ctx.displayScore(300000 + X.ELEPHANT_BONUS) - X.ctx.displayScore(300000) > 2000);

// Placing the second tiger through the real move counts the elephant for
// the run. The celebration itself needs a document, so the harness only
// sees that it did not stop the rules.
board([[1, 2, 'tiger']]);
S.stock = ['tiger', 'grass', 'grass']; S.score = 0; S.over = false;
X.ctx.placeTile(at(2, 2));
ok('placing into an elephant counts it for this run', S.elephants === 1, String(S.elephants));
ok('...and the run goes on afterwards', !S.over && !S.celebrating);

// While the celebration is up the meadow waits: no tick, no placement.
S.celebrating = true; const tBefore = S.ticks;
X.ctx.worldTick();
ok('the meadow does not tick while the elephant is celebrated', S.ticks === tBefore);
board([]); S.stock = ['grass', 'grass', 'grass'];
X.ctx.placeTile(at(0, 0));
ok('...and nothing can be planted under the celebration', !S.cells[at(0, 0)]);
S.celebrating = false;

console.log('\nthe big animals wait for a partner');
for (const [k, e, d] of [['wolf', 17, 21], ['bear', 20, 27], ['lion', 27, 37], ['tiger', 30, 41]]) {
  ok('a ' + k + ' can wait ' + X.BIG_STAMINA_PCT + '% as long as before',
     X.ANIMALS[k].eatAt === Math.round(e * X.BIG_STAMINA_PCT / 100) && X.ANIMALS[k].starveAt === Math.round(d * X.BIG_STAMINA_PCT / 100),
     X.ANIMALS[k].eatAt + '/' + X.ANIMALS[k].starveAt);
}
ok('the small animals keep their old pace', X.ANIMALS.rabbit.starveAt === 11 && X.ANIMALS.fox.starveAt === 16 && X.ANIMALS.deer.starveAt === 25);
ok('the elephant is still the hungriest thing on the board',
   X.ANIMALS.elephant.starveAt < X.ANIMALS.tiger.starveAt && X.ANIMALS.elephant.starveAt < X.ANIMALS.wolf.starveAt);

console.log('\nthe page asks for the current files');
ok('index.html stamps match the files (run `node stamp.js`)', !require('./stamp.js').stale());

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
