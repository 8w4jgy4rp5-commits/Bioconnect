// ============================================================
// Ecosystem Puzzle — grow a food chain, then keep it fed.
//
// Endless, and THE WORLD KEEPS ITS OWN TIME. This is the one structural
// thing to understand before changing anything here.
//
// It used to be one tap, one turn. That reads as a clean rule and it
// made the game unplayable, for a reason no amount of tuning could
// reach: the player's only action was also the thing that advanced the
// clock. Every move made to save a starving animal aged it, and aged
// everything else on the board with it. There was no such thing as
// hurrying — tapping faster only made the meadow die faster — so a
// board in trouble could not be rescued, only watched. Widening the
// hunger clocks was tried and measured and did nothing, because five
// turns of grace cost five turns of hunger.
//
// So the two are split:
//
//   worldTick()  the meadow's own clock, on a real timer. Hunger,
//                feeding, deaths, withering, stones, the season — and
//                the tile that arrives in your hand.
//   placeTile()  yours. Instant, free, and it advances nothing. Put a
//                sprout beside a starving rabbit the moment its bar
//                turns red and it lives, however long the last move
//                took you.
//
// What stops you filling the board in one sweep is that tiles arrive on
// the world's clock too, and you can only bank HAND_MAX of them. The
// long-run rate is what it always was, one tile per tick; the new thing
// is that you choose WHEN to spend them. Banking three and emptying the
// hand into a crisis is the move the old game could not express.
//
// An earlier version was real-time as well and was rewritten to turns
// because its stages each needed numbers re-tuned in two files. That
// problem was the stages, not the clock: there is still exactly one rule
// set, in this file, and sim.js still plays it headless — it just steps
// ticks and placements separately now, the same way a player does.
//
// The shape of the game: merging costs no time, and it pays — for seven
// rule versions it did not, and building the fox, the thing the whole
// board is arranged around, scored exactly zero. It now pays about two
// fifths of a run. The rest comes from animals eating, and an animal
// that is not fed dies and leaves bones that take a square out of play
// for good — so reaching the fox is not the finish line, it is a
// standing bill.
// ============================================================

'use strict';

// ---------- Tuning ----------
// Everything that decides difficulty lives here.

// Every knob is a plain named number so the harness in sim.js can rewrite
// it and sweep. Anything folded into an object literal below is not a
// knob — it is wiring.

const SIZE = 5;                 // board is SIZE x SIZE
const CELLS = SIZE * SIZE;

// How many touching alike tiles it takes to grow up. Two, all the way
// up the ladder now.
//
// Sprouts were the last rung still charging three, and three was the
// complaint: with 78% of the hand dealt as sprouts, TWO OUT OF EVERY
// THREE TAPS PUT SOMETHING ON THE BOARD AND NOTHING HAPPENED. The run
// was reachable on paper — a bot that thinks every third tick still
// found a fox in 97% of runs — but reachable is not the same as worth
// playing, and a game whose usual tap produces no event has no loop in
// it to enjoy.
//
// The harness says two costs nothing it was protecting. Runs get LONGER
// rather than shorter (95 ticks to 113), because merging is a tile sink
// and a board that merges more is a board with more room left on it; the
// wolf stops being a rumour (25% of runs to 63%); and the median score
// roughly doubles. Measured with `node sim.js 200 MERGE_SPROUT=2,3`.
const MERGE_SPROUT = 2;
// Two, not three. With the fox as the top rung three was right; with the
// wolf above it, three grass per rabbit priced the wolf out of the game
// — the harness found it at 5% of runs, which is not a top rung, it is a
// rumour. Two brings the first fox in around turn 30 instead of 44, and
// that gap is the whole budget for building the second one.
const MERGE_GRASS = 2;
const MERGE_RABBIT = 2;
// Two, for the same reason rabbits take two: a fox is expensive to keep
// and three alive at once is a wall, not a difficulty setting.
const MERGE_FOX = 2;

// An animal eats at EAT_AT and dies at STARVE_AT, both counted in turns
// since its last meal. The gap between those two numbers is the whole
// balance of the game, and it took three tries to get right.
//
// Eating early (2 of 6) made a rabbit consume everything the player could
// produce — grass costs three turns to grow and the rabbit swallowed one
// every other turn — so a second rabbit was arithmetically impossible and
// the fox never happened.
//
// Eating in the middle (5 of 11) fixed the arithmetic but left a worse
// problem: a rabbit still took grass whenever grass happened to be next
// to it, so the best play was to keep food out of your own animal's
// reach. A game about growing a food chain should not reward hiding the
// food, and a player who works that out feels like they are fighting the
// rules rather than using them.
//
// So both animals now eat only once they are nearly dead, which makes one
// visible rule cover everything: an animal takes what is beside it only
// when its bar is red, and at that point you wanted it fed anyway. Grass
// sitting next to a rabbit is otherwise safe, and can be built into the
// next rabbit in peace.
//
// It costs score — the casual bot's median fell from 900 to 700, since
// meals are the only points — and buys back a game whose best strategy is
// not a trick. The fox turns up slightly more often, too.
//
// These are counted in TICKS now, not taps — see the clock section
// below — but the numbers did not have to move, because one tick is
// exactly what one turn used to be.
//
// Widening them was tried once and reverted, and the reason is worth
// keeping. Back when a tap WAS a turn, every move made to save an animal
// also aged it, so stretching STARVE_AT bought nothing: five turns of
// grace cost five turns of hunger on everything else. Measured — rabbit
// 11 -> 13, fox 16 -> 19, wolf 21 -> 25 — a bot playing to keep the
// chain alive starved at 3.7 per hundred turns before and 3.4 after.
//
// That was the treadmill, and splitting the clocks is what actually cut
// it: the same bot now starves at 0.8. So these stay where three rounds
// of tuning left them. What makes the game playable is the price of a
// meal (the diets below) and the fact that paying it costs no time at
// all (placeTile) — not the width of this gap.
const RABBIT_EAT_AT = 9;
const RABBIT_STARVE_AT = 11;

const FOX_EAT_AT = 13;
const FOX_STARVE_AT = 16;

// The wolf is the first rung that eats more than one thing, so its own
// numbers matter less than that rule does: a wide diet already keeps it
// alive on scraps. The long clock is there so a wolf is not a crisis the
// turn it lands, and the points are what make the fox worth spending.
const WOLF_EAT_AT = 17;
const WOLF_STARVE_AT = 21;

// A meal is worth WHAT WAS EATEN, not who ate it.
//
// While every animal had exactly one prey the two were the same number,
// so the score lived on the predator: a fox ate rabbits, therefore a
// fox's meal was worth a rabbit. Diets broke that. Paying a fox its own
// rate for a mouthful of grass made grazing foxes the highest-scoring
// thing in the game — the harness caught it instantly, medians jumped
// from 2000 to 6700 — and it deserved to be caught, because it is
// nonsense: a fox that finds berries has not achieved anything a rabbit
// has not.
//
// Scoring the prey instead keeps every old number exactly where it was
// (grass to a rabbit is still 100, a rabbit to a fox is still 500) and
// prices the new meals honestly. Eating well means eating something big.
//
// A sprout is priced so that panicking is never the efficient play. A
// grass costs three taps and pays 100, which is 33 a tap; a sprout costs
// one tap and pays 25. Feeding properly is always worth more per turn —
// the sprout is there to save a life, not to farm one.
const MEAL_VALUE = { sprout:25, grass:100, rabbit:500, fox:2000, deer:3000, zebra:4000, buffalo:6000, wolf:8000, bear:10000, lion:14000, tiger:18000, elephant:24000 };

// What to call each meal in the turn line, keyed eater<eaten.
const MEAL_LINE = {
  'rabbit<grass': 'A rabbit grazed',
  'rabbit<sprout': 'A rabbit stripped a sprout',
  'fox<rabbit': 'A fox took a rabbit',
  'fox<grass': 'A fox made do with grass',
  'fox<sprout': 'A fox scraped by on a sprout',
  'wolf<rabbit': 'The wolf took a rabbit',
  'wolf<fox': 'The wolf took your fox',
  'bear<grass': 'The bear grazed on grass',
  'bear<rabbit': 'The bear caught a rabbit'
};

// The elephant takes one thing only — an animal you raised — so its line
// is built rather than listed, and it always says which.
function mealLine(eater, eaten) {
  if (eater === 'elephant') return 'The elephant took your raised ' + eaten;
  return MEAL_LINE[eater + '<' + eaten] || (eater + ' ate ' + eaten);
}

// WHAT GROWING PAYS, and the fact that it pays anything at all.
//
// For seven rule versions the only way to score was to watch an animal
// eat. Building the fox — the thing the whole board is arranged around,
// twelve tiles and half a run of keeping rabbits alive — scored exactly
// zero, and the points arrived later, quietly, on the world's clock,
// crediting the meal rather than the work. The player's own move paid
// nothing, which is a strange thing for the only move the player has.
//
// So a growth pays now, at a quarter of what eating the same creature
// pays. A quarter is deliberate: eating well is still where a score is
// made, and grazing a fox still beats farming sprouts. What this buys is
// that the tap you just made has a number on it.
//
// A percentage rather than a table, for two reasons. It keeps every
// growth priced off the meal it corresponds to, so the two halves of the
// score can never drift apart by hand; and it is a plain `const NAME =
// <number>;`, which is what sim.js needs in order to sweep it — see the
// note at the top of that file.
//
// The number itself was found rather than chosen. A quarter looked
// modest and measured at 85% of all points, because growths are simply
// far more frequent than meals: a run places a hundred tiles and most of
// them merge, while a given animal eats a handful of times. That is the
// whole food chain reduced to a rounding error, and the predator game —
// the decoy rabbit, keeping the wolf off your fox — stops being worth
// playing when it is 15% of a score.
//
// So it is swept for an even split instead — `node sim.js 300
// GROW_PAYS_PCT=8,10 WOLF_GROW_VALUE=500,800`, reading the `grown`
// column. Ten lands at 58/42 and pays in round numbers (10, 50, 200);
// eight is nearer dead even and pays 8 for a patch of grass, which is a
// worse thing to read on the most common event in the game.
const GROW_PAYS_PCT = 10;

// Nothing eats a wolf, so it has no meal value to take a share of, and
// it is priced on its own. It wants to be a moment without being the
// score: at 2000 the apex alone was most of a run's points and the
// sweep could not move the split at all, because every other number was
// rounding error beside it.
const WOLF_GROW_VALUE = 500;

function growValue(kind) {
  return ({ grass:10, rabbit:50, fox:200, deer:350, zebra:500, buffalo:700, wolf:1000, bear:1500, lion:2200, tiger:3200, elephant:5000 })[kind] || 0;
}

// Plants run down on the same clock. Long enough to be built with, short
// enough that hoarding is not a strategy.
const SPROUT_WITHER_AT = 14;
const GRASS_WITHER_AT = 18;

// A fixed half-sprout, half-grass supply keeps every animal earned.
// More grass offsets the removed animal windfalls without skipping the
// bottom of the ladder. Neither time nor discoveries change these odds.
const GRASS_IN_HAND = 50;

const LADDER = ["sprout", "grass", "rabbit", "fox", "deer", "zebra", "buffalo", "wolf", "bear", "lion", "tiger", "elephant"];
const MERGE_AT = Object.fromEntries(LADDER.slice(0, -1).map(k => [k, 2]));

// The ladder. Order matters: each kind grows into the next one.
const GROWS_INTO = Object.fromEntries(LADDER.slice(0, -1).map((k, i) => [k, LADDER[i + 1]]));

// WHAT EATS WHAT, and why it is a list.
//
// A real food chain does not get narrower as it climbs, it gets wider: a
// wolf takes hares and foxes and whatever else is slow that day. The
// first version of this game had one `prey` string per animal, which
// made a tidy ladder and a dishonest ecosystem — every rung ate exactly
// the rung below and nothing else.
//
// Widening it changes the puzzle more than it changes the fiction. With
// one prey each, the board only ever asks you to put two things
// together. With a diet, the apex also eats the things you are building
// the next apex out of, so the same board now asks you to keep two
// things APART — and a merge game with a repulsion in it is a different
// game. Grass is the one thing no carnivore wants, which is what makes
// it safe packing material to park beside a hungry wolf.
//
// `diet` is listed cheapest first and read in that order: a wolf beside
// both a rabbit and a fox takes the rabbit. That is how predators
// actually choose — easiest meal wins — and it hands the player a move,
// which is to keep a cheap rabbit in reach as a decoy so the fox
// survives the wolf's next red bar.
// A SPROUT IS ALSO FOOD, and that one entry is what makes this a game
// rather than a treadmill.
//
// The clock is counted in taps, and the player only ever gets one tap.
// So the real question the board asks is: what fraction of your taps
// does one animal cost you? A rabbit wants feeding every 9 turns, and
// while grass was its only food a meal cost three taps to build — a
// third of your entire budget, per rabbit. Three animals was therefore
// 100% of every tap you had, with nothing left to build with, and a
// fourth was arithmetically impossible. Nothing about tapping faster
// helps, because tapping faster is what advances the clock.
//
// Letting the bottom rung of the plant ladder count as a meal drops the
// price of a rescue from three taps to one, and the same board that
// could hold three animals holds five. Measured over 400 runs with a bot
// that plays to keep the chain alive: starvations fell from 3.7 per
// hundred turns to 0.4, animals alive went 2.8 -> 3.4, and the wolf —
// the top rung, previously a rumour — turned up in half of all runs
// instead of a fifth.
//
// It is deliberately the WORST meal on the board (see MEAL_VALUE). The
// point is not that feeding is cheap, it is that a life is always
// saveable in one move if you have a bare square beside it. Doing it
// properly still scores better; the sprout is the fire escape.
//
// It costs nothing in safety, either, because the red-bar rule already
// covers it: nothing is eaten until the eater's bar is red, so sprouts
// parked beside a fed rabbit are as safe as they ever were — and a
// half-built patch of grass beside a hungry one is now its own emergency
// ration rather than a race you lose.
//
// `diet` is preference order, so grass stays first and a rabbit standing
// between both still takes the grass and leaves your sprouts alone.
// ---------- THE ELEPHANT'S THREE NUMBERS ----------
//
// The elephant used to be a trophy: top of the ladder, grazing on grass
// like a deer, and once it arrived the run had nowhere left to go. These
// three knobs turn it into the opposite — the most expensive thing on
// the board to keep, and the only thing worth a real score.
//
// Plain `const NAME = <number>;` so sim.js can sweep them; see the note
// at the top of that file.

// The pace an apex would keep if it ate like everything else. These are
// the numbers the elephant actually had, kept here so the speed-up below
// is a ratio against something real rather than a pair of fresh guesses.
const ELEPHANT_BASE_EAT_AT = 33;
const ELEPHANT_BASE_STARVE_AT = 45;

// ...and how much faster it really runs down, in percent. 250 is the
// middle of the 2-3x band: an elephant wants feeding every 13 turns and
// dies at 18, against a tiger's 30 and 41. That is roughly a rabbit's
// urgency on an animal that only eats the rarest thing on the board,
// which is the whole cost of keeping one.
const ELEPHANT_HUNGER_PCT = 250;

// What an elephant's meal pays, as a percent of the prey's own value.
//
// Everywhere else a meal is worth WHAT WAS EATEN and the eater is
// irrelevant (see MEAL_VALUE). The elephant is the one exception in the
// game, and it is priced this way rather than by inflating MEAL_VALUE
// because the things it eats are also eaten by lions and tigers — a
// raised deer must stay worth 3000 to them.
//
// 400 puts one elephant meal at the top of the table by a wide margin: a
// raised rabbit pays 2000 (a fox's worth, for a tile you built), a
// raised tiger pays 72000, four times the largest meal anything else can
// take. It is paid on the bite, never on being alive, so an elephant
// parked in a corner and quietly fed is worth nothing at all.
const ELEPHANT_MEAL_PCT = 400;

function elephantEatAt() { return Math.max(2, Math.round(ELEPHANT_BASE_EAT_AT * 100 / ELEPHANT_HUNGER_PCT)); }
function elephantStarveAt() { return Math.max(elephantEatAt() + 1, Math.round(ELEPHANT_BASE_STARVE_AT * 100 / ELEPHANT_HUNGER_PCT)); }

const ANIMALS = {
  rabbit: { diet: ['grass', 'sprout'], eatAt: 9, starveAt: 11 },
  fox: { diet: ['rabbit', 'grass', 'sprout'], eatAt: 13, starveAt: 16 },
  deer: { diet: ['grass', 'sprout'], eatAt: 18, starveAt: 25 },
  zebra: { diet: ['grass', 'sprout'], eatAt: 21, starveAt: 29 },
  buffalo: { diet: ['grass', 'sprout'], eatAt: 24, starveAt: 33 },
  wolf: { diet: ['rabbit', 'fox', 'deer', 'zebra'], eatAt: 17, starveAt: 21 },
  bear: { diet: ['grass', 'rabbit', 'deer'], eatAt: 20, starveAt: 27 },
  // THE BIG MEALS, AND WHY THEY SIT AT THE END OF THE LIST.
  //
  // MEAL_VALUE priced a wolf at 8000 and a tiger at 18000, but nothing ate
  // them: every diet stopped at buffalo, so the largest numbers in the table
  // could never be scored at all. Four of them are reachable without
  // touching the rule that a mouth only takes rungs below itself — the lion
  // takes the wolf and the bear, the tiger takes the lion too, and the
  // elephant, which is the top of the ladder and the one thing with nothing
  // above it, is what finally answers a tiger.
  //
  // They go LAST because diet is preference order. A lion with a deer beside
  // it eats the deer, every time. So an 18000 meal is not something that
  // happens to you; it is something you arrange, by clearing the small prey
  // away from the tiger's neighbour before the lion is what is left. That is
  // the one thing in this game a better player can do that a faster one
  // cannot — every other way of scoring is capped by the tile supply.
  //
  // MEAL_VALUE.elephant (24000) stays unreachable, and honestly so: the
  // apex of the ladder has nothing above it to be eaten by. It is dead
  // until the ladder grows a rung past the elephant.
  lion: { diet: ['deer', 'zebra', 'buffalo', 'wolf', 'bear'], eatAt: 27, starveAt: 37 },
  tiger: { diet: ['deer', 'zebra', 'buffalo', 'wolf', 'bear', 'lion'], eatAt: 30, starveAt: 41 },

  // THE ELEPHANT EATS ONLY WHAT YOU BUILT.
  //
  // `needs: 'raised'` is a second filter laid over the diet, and it is
  // the whole design of the animal. The elephant will not touch grass, a
  // sprout, or a rabbit that arrived in your hand. It takes animals the
  // player grew by merging — nothing else on the board is food to it.
  //
  // That turns the top of the ladder from an ending into a decision. Two
  // tigers become an elephant, and the same board that made the elephant
  // has just spent the raised animals the elephant is about to want. So
  // the question the last rung asks is not "can I get there" but "what
  // have I got left to feed it", and at 250% hunger the answer is due in
  // thirteen turns. Reach it with a cupboard full of raised deer and it
  // is the highest-scoring stretch in the game; reach it on an empty
  // board and it leaves bones.
  //
  // The diet itself is every rung below, cheapest first, like every
  // other predator: an elephant beside a raised rabbit and a raised
  // tiger takes the rabbit. Arranging the big meal — clearing the small
  // raised animals away first — is the same skill the lion and tiger
  // already ask for, and here it is worth four times as much.
  elephant: {
    diet: ['rabbit', 'fox', 'deer', 'zebra', 'buffalo', 'wolf', 'bear', 'lion', 'tiger'],
    needs: 'raised',
    mealPct: ELEPHANT_MEAL_PCT,
    eatAt: elephantEatAt(),
    starveAt: elephantStarveAt()
  }
};

// Predators settle in ladder order, top down, so a wolf takes its rabbit
// before that rabbit strips a patch of grass on the same turn. Derived
// rather than written out, so the next rung joins by being added above.
const PREDATOR_ORDER = Object.keys(ANIMALS).sort(function (a, b) {
  return rank(b) - rank(a);
});

// Plants run down too, and this is what makes the run end.
//
// Merging removes two tiles and adds one, and a grazing animal removes
// another, so a player who merges competently sheds tiles faster than
// the one-a-turn the hand supplies: without this the board never fills
// and there is no run to score. Giving plants the same clock the animals
// already have turns "keep the chain eating" from a scoring strategy
// into the survival condition — ungrazed growth goes to scrub, and
// scrub takes the square out of play.
const PLANTS = {
  sprout: { witherAt: SPROUT_WITHER_AT },
  grass: { witherAt: GRASS_WITHER_AT }
};

// Inert tiles. Nothing grows them, nothing eats them; only new growth
// beside them clears them away.
const BLOCKERS = ['scrub', 'bones', 'stone'];

// What actually fills the board.
//
// Withering alone cannot end a run: merging is a tile sink — three tiles
// in, one out — so a player who keeps merging sheds squares faster than
// the one-a-turn the hand deals, and the meadow just empties. A bot left
// to play five thousand turns finished with eighteen squares still bare.
// So the ground pushes back on a fixed cadence, and a merge only ever
// reclaims one square beside it.
//
// How fast the ground pushes back is the year's business — see the
// season block below.
const CLEAR_PER_MERGE = 1;  // one growth buys back one dead square

// ---------- The year ----------
// Supply stays small throughout a run. Pressure and rewards, rather than
// larger dealt animals, rise with the independent world clock.
const SEASON_LENGTH = 25;       // world ticks per difficulty stage
const SEASONS = 4;
const DIFFICULTY_STAGES = 8;    // spring, summer, autumn, then five winters
const STONE_EVERY_FIRST = 12;
const STONE_EVERY_LAST = 6;     // first winter; later winters approach the floor
const STONE_EVERY_MIN = 2;
const WITHER_BONUS_FIRST = 30;
const WITHER_BONUS_LAST = 0;
const SCORE_PER_SEASON = 1;     // growth AND meals: x1 through x8

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SEASON_NOTES = [
  'Room to grow. Start small.',
  'More stones. Keep space open.',
  'Plants fade sooner. Plan a chain.',
  'Winter deepens. Keep your meadow fed.'
];

function difficultyStage() {
  return Math.min(DIFFICULTY_STAGES - 1, Math.floor(state.ticks / SEASON_LENGTH));
}
function season() { return Math.min(SEASONS - 1, difficultyStage()); }
function seasonLabel() {
  const s = season();
  return SEASON_NAMES[s] + (s === SEASONS - 1 ? ' ' + (difficultyStage() - s + 1) : '');
}
function stoneEvery() {
  const s = season();
  const firstYear = SEASONS < 2 ? STONE_EVERY_LAST : Math.round(
    STONE_EVERY_FIRST + (STONE_EVERY_LAST - STONE_EVERY_FIRST) * s / (SEASONS - 1));
  return Math.max(STONE_EVERY_MIN, firstYear - Math.max(0, difficultyStage() - (SEASONS - 1)));
}
function witherBonus() {
  // Gradual shortening avoids the old ten-tick lifespan loss at a season
  // boundary. The plant meter and wither check share this same limit.
  const progress = Math.min(1, state.ticks / (SEASON_LENGTH * (DIFFICULTY_STAGES - 1)));
  return Math.round(WITHER_BONUS_FIRST + (WITHER_BONUS_LAST - WITHER_BONUS_FIRST) * progress);
}
function scoreMultiplier() { return 1 + difficultyStage() * SCORE_PER_SEASON; }
function plantLimit(kind) { return PLANTS[kind].witherAt + witherBonus(); }
function nextDifficultySeconds() {
  const left = SEASON_LENGTH - state.ticks % SEASON_LENGTH;
  return Math.ceil(left * TICK_MS * (state.relaxed ? RELAXED_SCALE : 1) / 1000);
}

const HAND_ODDS = [
  { kind: 'sprout', weight: 100 - GRASS_IN_HAND },
  { kind: 'grass', weight: GRASS_IN_HAND }
];

// ---------- The clock ----------
//
// One tick is what a turn used to be, so every number tuned above — how
// often a rabbit eats, how long grass keeps, how often a stone surfaces
// — means exactly what it did before and did not have to be re-derived.
//
// TICK_MS is the only genuinely new number, and it is a feel setting
// rather than a difficulty one: it decides how long you have in SECONDS
// to answer a red bar, and nothing about the arithmetic of the board.
// A tick is deliberately slow. The game is a puzzle that now allows
// hurrying, not a test of how fast you can tap.
const TICK_MS = 1800;
// Relaxed doubles every tick. Real time punishes anyone who reads the
// board slowly, uses a keyboard, or is on a phone on a train, and that
// is a worse failure than an easy setting is.
const RELAXED_SCALE = 2;

// Three queued tiles, replaced immediately on placement.
const HAND_MAX = 3;
// Fallback refill for an unexpectedly incomplete hand.
const TICKS_PER_TILE = 1;

const SLUG = 'ecosystem-puzzle';

// Bumped whenever the rules or the point values change. A best score set
// under different arithmetic is not a record, it is a leftover, so one
// from an older ruleset is ignored rather than left standing as a target
// that cannot be compared to anything the player can score now.
const RULES_VERSION = 16;

// ---------- WHAT A SCORE MEANS ----------
//
// Everything above this line is the game's own arithmetic and it counts
// in RAW points: a meal is worth what was eaten, a chain multiplies it,
// winter multiplies it again. Those numbers are tuned against each other
// and not one of them changes here. What changes is what the player sees.
//
// Raw points have no ceiling and no shape. The harness plays this same
// game to a median of 17,000 with slow hands and 234,000 with fast ones
// — more than an order of magnitude between "a quiet run" and "a good
// run", and half a million beyond that on the best days. A number like
// that cannot be read at a glance, cannot be compared to a friend's, and
// cannot be aimed at, because there is nothing to be close to.
//
// So the run is SHOWN on a fixed scale that raw points are mapped onto:
//
//     shown = CAP * x / (1 + x),   x = (raw / PACE) ^ CURVE
//
// Three things fall out of that one line, and all three are the point.
//
// It has a ceiling it never touches. x/(1+x) is below 1 for every finite
// raw score, so CAP is a horizon rather than a finish line: there is no
// last point to collect and no run that completes the game.
//
// It gets harder as it goes, with no rule anywhere saying so. The rungs
// below cost 13,000 raw, then 41,000, then 89,000, 168,000, 300,000 —
// each about two and a half times the last, and the meadow never changed.
// The scale is the difficulty curve. That is the whole reason this is a
// mapping and not a divisor.
//
// It puts a slow player and a fast one on the same ladder. PACE is the
// raw score that reads as exactly half the cap, set at a strong run
// rather than an average one, so 5,000 is what excellent looks like and
// everything above it belongs to nobody yet. CURVE below 1 lifts the
// bottom of the range, which is what keeps a careful first game from
// reading as zero.
//
// Measured, `node sim.js 300` at these values:
//     slow bot (4 ticks)  p50     16,840 raw ->  1,175 shown
//     careful bot         p50     81,210 raw ->  2,860 shown
//     casual bot          p50    234,120 raw ->  4,567 shown
//     casual bot          max    599,365 raw ->  6,188 shown
//     best run ever seen         741,890 raw ->  6,533 shown
// Nine thousand needs 6.9 million raw — ten times the best run the
// harness has ever played. Ten thousand needs all of them.
const SCORE_CAP = 10000;
const SCORE_PACE = 300000;   // raw points that read as exactly half the cap
const SCORE_CURVE_PCT = 70;  // the exponent in percent, so sim.js can sweep it

function displayScore(raw) {
  if (!(raw > 0)) return 0;
  const x = Math.pow(raw / SCORE_PACE, SCORE_CURVE_PCT / 100);
  return Math.floor(SCORE_CAP * x / (1 + x));
}

// The rungs the shown score is read on. A number on its own does not say
// whether it was any good; a name does. They are evenly spaced in shown
// points and therefore wildly uneven in effort, which is the honest way
// round — the last rung is open at the top and nobody finishes it.
const LEVELS = [
  { at: 0,    name: 'Bare ground' },
  { at: 1000, name: 'Sprouting' },
  { at: 2000, name: 'Meadow' },
  { at: 3000, name: 'Thicket' },
  { at: 4000, name: 'Woodland' },
  { at: 5000, name: 'Wilderness' }
];

// Which rung `shown` sits on, how far along it, and what ends it. The
// top rung runs to the cap, so its bar is the one that never fills.
function levelAt(shown) {
  let i = 0;
  while (i + 1 < LEVELS.length && shown >= LEVELS[i + 1].at) i += 1;
  const top = i + 1 >= LEVELS.length;
  const from = LEVELS[i].at;
  const to = top ? SCORE_CAP : LEVELS[i + 1].at;
  return {
    index: i, level: i + 1, name: LEVELS[i].name, top: top, from: from, to: to,
    next: top ? null : LEVELS[i + 1].name,
    pct: Math.max(0, Math.min(1, (shown - from) / (to - from)))
  };
}

// ---------- Data layer (AppSync) ----------

let scoreStore = null;

// Kinds the player has already been introduced to, on any run. The
// welcome card is there to teach; once it has taught, a second showing
// is only an interruption, so this outlives the board instead of being
// reset with it.
let metStore = null;
const met = new Set();

// Fallback for when app-sync.js fails to load. localStorage only, no sync.
async function openStore(slug, key, opts) {
  try { if (window.AppSync) return await window.AppSync.store(slug, key, opts); } catch (e) { console.error(e); }
  const o = opts || {}, k = 'appdata:' + slug + ':' + key;
  const read = function (s) { try { return JSON.parse(localStorage.getItem(s)); } catch (e) { return null; } };
  const cp = function (v) { return v == null ? v : JSON.parse(JSON.stringify(v)); };
  const env = read(k);
  let c = env && 'd' in env ? env.d : ((o.legacyKey && read(o.legacyKey)) ?? o.default ?? null);
  return {
    get: function () { return cp(c); },
    set: function (v) {
      c = cp(v);
      try { localStorage.setItem(k, JSON.stringify({ v: 1, av: o.version || 1, t: Date.now(), o: null, d: c })); } catch (e) {}
      return Promise.resolve();
    },
    subscribe: function () { return function () {}; },
    flush: function () { return Promise.resolve(); },
    status: function () { return { online: false, syncing: false, lastSyncedAt: null, error: null }; }
  };
}

function readBest() {
  const v = scoreStore ? scoreStore.get() : null;
  if (!v || typeof v !== 'object') return 0;
  if (Number(v.rules) !== RULES_VERSION) return 0;
  const n = Number(v.best);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function writeBest(n) {
  if (!scoreStore) return;
  scoreStore.set({ best: Math.floor(n), rules: RULES_VERSION })
    .catch(function (e) { console.error('Ecosystem Puzzle: save failed', e); });
}

function readMet() {
  const v = metStore ? metStore.get() : null;
  const list = v && Array.isArray(v.kinds) ? v.kinds : [];
  for (const k of list) if (typeof k === 'string') met.add(k);
}

function writeMet() {
  if (!metStore) return;
  metStore.set({ kinds: Array.from(met) })
    .catch(function (e) { console.error('Ecosystem Puzzle: save failed', e); });
}

// ---------- State ----------

const state = {
  cells: new Array(CELLS).fill(null), // null = empty ground
  stock: [],          // tiles in hand, oldest first. Never longer than HAND_MAX
  next: 'sprout',     // what the next tick will hand you
  refill: 0,          // ticks banked toward the next tile
  score: 0,
  best: 0,
  ticks: 0,           // the world's own clock. Seasons and stones read it
  over: false,
  paused: false,      // title screen, tab hidden, guide open, or the run is done
  relaxed: false,
  topKind: 'sprout',  // the highest thing this run has grown, for the end card
  seen: {}            // kinds this run has already made a fuss about
};

// A tile is `{ kind, clock, born }`. `clock` counts turns since the tile
// last had what it needs: a meal for an animal, and simply being planted
// for a plant. Blockers ignore it.
//
// `born` is WHERE THE TILE CAME FROM, and it exists for one mouth.
//
// Every tile used to be interchangeable: a rabbit dealt into your hand
// and a rabbit you built out of two patches of grass were the same tile,
// because nothing ever asked. The elephant asks. It will only take an
// animal the player MADE — see the note on its diet — so the board has
// to remember which ones those are.
//
// 'wild' is anything the world handed over: a tile out of the hand, a
// stone surfacing, bones and scrub left behind. 'raised' is the output
// of a merge, and nothing else in the game can produce one. A tile's
// origin never changes; a merge consumes its inputs and the tile it
// leaves behind is raised regardless of what went into it.
function makeTile(kind, born) {
  return { kind: kind, clock: 0, born: born || 'wild' };
}

// Did the player build this one? Hand-built boards in the tests and any
// save from an older ruleset have no `born` at all, and those count as
// wild — the stricter reading, so a missing field can never hand the
// elephant a meal it has not earned.
function isRaised(cell) { return !!cell && cell.born === 'raised'; }

function isAnimal(kind) { return !!ANIMALS[kind]; }
function isPlant(kind) { return !!PLANTS[kind]; }
function isBlocker(kind) { return BLOCKERS.indexOf(kind) >= 0; }

// 1 just after a meal (or a planting) and 0 at the moment it is lost.
function vitality(cell) {
  const limit = isAnimal(cell.kind) ? ANIMALS[cell.kind].starveAt
    : isPlant(cell.kind) ? plantLimit(cell.kind)
      : 0;
  if (!limit) return 1;
  return Math.max(0, 1 - cell.clock / limit);
}

// The same plant mix at every time and discovery. Every animal must be
// raised by merging; discovering one never changes the supply.
function rollHand() {
  let total = 0;
  for (const o of HAND_ODDS) total += o.weight;
  let r = Math.random() * total;
  for (const o of HAND_ODDS) {
    r -= o.weight;
    if (r < 0) return o.kind;
  }
  return HAND_ODDS[0].kind;
}

function neighbours(i) {
  const x = i % SIZE, y = (i / SIZE) | 0, out = [];
  if (x > 0) out.push(i - 1);
  if (x < SIZE - 1) out.push(i + 1);
  if (y > 0) out.push(i - SIZE);
  if (y < SIZE - 1) out.push(i + SIZE);
  return out;
}

// ---------- Big tiles ----------
//
// The elephant is the one rung that does not fit in a square. It stands
// on a 2x2 block — four squares out of twenty-five — and that weight is
// the point: the meadow has to make room for it.
//
// A big tile is written into all four of its squares. The top-left one
// is its HOME and holds the real tile: clock, born, everything. The
// other three are shadows, there so the board reads as full where the
// animal is standing. Every rule that acts once per animal skips them,
// or a 2x2 elephant ages four times a turn and eats four meals.
//
// "big" stores the home INDEX rather than relying on the four squares
// sharing one object, because both the merge preview and the sim
// harness copy the board, and a copy would quietly break identity.
const BIG = { elephant: 2 };    // kind -> side of its block, in squares

function bigSide(kind) { return BIG[kind] || 1; }

function blockAt(home, side) {
  const out = [];
  for (let dy = 0; dy < side; dy++) {
    for (let dx = 0; dx < side; dx++) out.push(home + dy * SIZE + dx);
  }
  return out;
}

// Every square a tile stands on, given any one of them.
function footprint(cells, i) {
  const c = cells[i];
  if (!c || c.big == null) return [i];
  return blockAt(c.big, bigSide(c.kind));
}

// Occupied, but not where the tile lives.
function isShadow(cells, i) {
  const c = cells[i];
  return !!c && c.big != null && c.big !== i;
}

// Everything touching a tile, however many squares it stands on. A 2x2
// block touches eight, which is why a hungry elephant reaches so much
// further than anything else on the board.
function tileNeighbours(cells, i) {
  const own = footprint(cells, i);
  if (own.length === 1) return neighbours(i);
  const mine = new Set(own), seen = new Set(), out = [];
  for (const o of own) {
    for (const n of neighbours(o)) {
      if (mine.has(n) || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// Clear these squares, and the whole of any big tile they belong to —
// half an elephant is not a thing the board can hold. Returns what it
// actually emptied.
function clearCells(cells, list) {
  const gone = [];
  for (const i of list) {
    if (!cells[i]) continue;
    for (const f of footprint(cells, i)) {
      if (!cells[f]) continue;
      cells[f] = null;
      gone.push(f);
    }
  }
  return gone;
}

// Where a big tile just born at `at` should stand. Its block has to
// cover `at` and fit on the board, which leaves up to four choices.
// Take the one that flattens the least, and on a tie the topmost then
// leftmost — the same reading order every other tie in this game uses.
// Standing on another elephant costs far more than standing on grass,
// so that block is only ever chosen when there is no other one.
function pickBlock(cells, at, side) {
  const x = at % SIZE, y = (at / SIZE) | 0;
  let best = null, bestCost = Infinity;
  for (let dy = 0; dy < side; dy++) {
    for (let dx = 0; dx < side; dx++) {
      const hx = x - dx, hy = y - dy;
      if (hx < 0 || hy < 0 || hx + side > SIZE || hy + side > SIZE) continue;
      const home = hy * SIZE + hx;
      let cost = 0;
      for (const b of blockAt(home, side)) {
        const c = cells[b];
        if (c) cost += c.big != null ? CELLS : 1;
      }
      // Reading order on a tie, like every other tie in this game.
      if (cost < bestCost || (cost === bestCost && home < best)) { bestCost = cost; best = home; }
    }
  }
  return best;
}

function newGame() {
  clearMovePreview();
  pointerGesture = null;
  cancelledPlacement = false;
  if (window.BioAudio) window.BioAudio.reset();
  state.cells = new Array(CELLS).fill(null);
  state.topKind = 'sprout';
  // Start with a full hand. The first thing a new player does is look at
  // the board, and arriving with one tile and a running clock teaches
  // panic rather than the game.
  state.stock = [];
  for (let n = 0; n < HAND_MAX; n++) state.stock.push(rollHand());
  state.next = rollHand();
  state.refill = 0;
  state.score = 0;
  state.ticks = 0;
  state.over = false;
  state.topKind = 'sprout';
  state.seen = {};
  clearFx();
  el.gameover.hidden = true;
  setTicker('Tap an empty square to plant. The meadow moves on its own.');
  render();
  syncClock();
}

// ---------- Your move ----------
//
// Instant, free, and it advances nothing. Place, grow as far as the
// board allows, done. The only thing it costs is a tile out of the hand,
// and the hand is refilled by the world, not by this.
//
// Because growth resolves here and eating resolves in the tick, growing
// ALWAYS beats a hungry mouth to a tile: dropping the third grass beside
// a starving rabbit turns the patch into a rabbit before anything can
// take it. That was true when a turn did both and it is easier to rely
// on now, because the two are no longer the same instant.

function placeTile(i) {
  if (state.over || state.cells[i]) return;

  // An empty hand was the one refusal that looked like a broken button:
  // the square was bare, the tap was legal, and the function just
  // returned. Say so, and point at the hand rather than the board — the
  // hand is where the thing you are waiting for actually is.
  if (!state.stock.length) { nudgeHand(); return; }

  state.cells[i] = makeTile(state.stock.shift());
  // Keep planting fluid; only the world clock ages the meadow.
  state.stock.push(state.next);
  state.next = rollHand();
  const grew = growFrom(i);
  const before = state.score;
  scoreGrowth(grew);
  // What the player is told is what the scale actually moved. Late in a
  // run the same chain is worth less, and this is where they see that.
  const gained = displayScore(state.score) - displayScore(before);
  if (window.BioAudio) {
    window.BioAudio.effect("place");
    if (grew.length) window.BioAudio.effect(grew.some(g => g.kind === "elephant") ? "finish" : "merge", grew.length);
  }
  bankScore();

  if (state.cells.every(function (c) { return c; })) endRun();

  render(grew, [], []);
  setTicker(placeMessage(grew, gained));

  // After render, because render rebuilds every cell and the effects
  // layer is measured against where those cells ended up.
  // One rung at a time, over a board that is already finished. See
  // replayChain for why nothing here waits for it.
  if (grew.length) replayChain(grew, before);
  announceFirsts(grew);
}

// Flashes the hand and says why nothing happened. The class has to come
// off and the element be reflowed in between, or a second tap on an
// already-nudging hand plays no animation at all and reads as the same
// dead button twice over.
let nudgeTimer = 0;
function nudgeHand() {
  setTicker('Nothing in hand — the next tile is growing. The meadow refills it for you, whether you play or not.');
  el.hand.classList.remove('hand-slot--nudge');
  void el.hand.offsetWidth;
  el.hand.classList.add('hand-slot--nudge');
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(function () {
    el.hand.classList.remove('hand-slot--nudge');
  }, 900);
}

// ---------- The world's move ----------
//
// Fixed order, every tick:
//   everyone gets hungrier -> feeding -> deaths -> withering -> a stone
//
// Feeding runs after hunger so an animal that just appeared waits its
// turn, and deaths run after feeding so a meal always saves a life.

function worldTick() {
  if (state.over || state.paused) return;

  state.ticks += 1;

  bumpClocks();
  const meals = feedEveryone();
  const deaths = collectDeaths();
  const withered = witherPlants();
  const stone = surfaceStone();
  const dealt = refillHand();

  const before = state.score;
  scoreMeals(meals);
  const gained = displayScore(state.score) - displayScore(before);
  if (meals.length && window.BioAudio) window.BioAudio.effect("eat", meals.length);
  bankScore();

  // A stone can take the last square, so the run can end on the world's
  // move and not only on yours.
  if (state.cells.every(function (c) { return c; })) endRun();

  const lost = deaths.concat(withered);
  if (stone) lost.push(stone);
  render([], meals, lost);
  setTicker(tickMessage(meals, deaths, withered, stone, gained, dealt));

  // One pop per mouth, each showing that meal's own share of the turn.
  // The shares add up to `gained` exactly, so a two-meal turn reads as
  // two numbers that make the total rather than as one number twice.
  if (gained) {
    let whole = 0;
    for (const m of meals) whole += m.points;
    let left = gained;
    for (let n = 0; n < meals.length; n++) {
      const part = n === meals.length - 1 ? left : Math.round(gained * meals[n].points / whole);
      left -= part;
      if (part) popScore(meals[n].at, part, meals[n].kind);
    }
  }
}

// Tiles arrive on the world's clock, which is what keeps placement free
// without letting the board be filled in one sweep. A full hand banks
// nothing — hoarding has a small price, and that is the only pressure
// there is to spend.
function refillHand() {
  if (state.stock.length >= HAND_MAX) { state.refill = 0; return false; }
  state.refill += 1;
  if (state.refill < TICKS_PER_TILE) return false;
  state.refill = 0;
  state.stock.push(state.next);
  state.next = rollHand();
  return true;
}

// 0 to 1 toward the next tile, for the meter under the hand. A full hand
// reads as full rather than as no progress.
function refillProgress() {
  if (state.stock.length >= HAND_MAX) return 1;
  return Math.min(1, state.refill / TICKS_PER_TILE);
}

// Grows the tile at `i` as far up the ladder as it can reach, then
// returns one entry per growth. A growth can complete a bigger group,
// which is why this loops instead of checking once.
function growFrom(i, cells = state.cells, preview = false) {
  const events = [];
  for (;;) {
    const cell = cells[i];
    if (!cell) break;
    const up = GROWS_INTO[cell.kind];
    if (!up) break;

    const group = sameGroup(i, cell.kind, cells);
    if (group.length < MERGE_AT[cell.kind]) break;

    // First growth clears one blocker. Further chain steps clear every
    // blocker touching their merging group, rewarding planned placement.
    const cleared = [];
    const clearLimit = events.length ? CELLS : CLEAR_PER_MERGE;
    for (const g of group) {
      if (cleared.length >= clearLimit) break;
      for (const n of neighbours(g)) {
        const c = cells[n];
        if (!c || !isBlocker(c.kind) || cleared.indexOf(n) >= 0) continue;
        cleared.push(n);
        if (cleared.length >= clearLimit) break;
      }
    }
    for (const n of cleared) cells[n] = null;

    // Land where the next rung is waiting, so the chain keeps going:
    // `grass | new grass | rabbit` must make its rabbit in the middle,
    // and `rabbit | grass | new grass` must make it next to the rabbit.
    // Neither "the square you placed" nor "the existing square" gets both.
    // With nothing to join, grow toward an existing tile. Ties always use
    // reading order, existing squares before the one just placed.
    const order = group.filter(function (at) { return at !== i; })
      .sort(function (a, b) { return a - b; }).concat([i]);
    const destination = order.find(function (at) {
      return neighbours(at).some(function (n) { return cells[n] && cells[n].kind === up; });
    }) ?? order[0];
    for (const g of group) cells[g] = null;
    i = destination;

    // The one place in the game that makes a raised tile.
    const tile = makeTile(up, 'raised');
    const side = bigSide(up);
    let trampled = [];
    if (side > 1) {
      // It arrives at full size, so it arrives on top of whatever was
      // standing there. Nothing can refuse it a place, and that is
      // deliberate: a merge that could fail for want of room would put
      // the last rung of the ladder behind a puzzle the player cannot
      // see coming.
      const home = pickBlock(cells, i, side);
      const block = blockAt(home, side);
      trampled = clearCells(cells, block);
      tile.big = home;
      for (const b of block) cells[b] = tile;
      i = home;
    } else {
      cells[i] = tile;
    }

    if (!preview && rank(up) > rank(state.topKind)) state.topKind = up;
    // `from` and `was` are for the replay only: the squares this rung
    // consumed, and what was standing on them. The rule does not read
    // them back, but they are the only record of a rung after the board
    // has settled — by render() time those squares are empty.
    events.push({ at: i, kind: up, size: group.length, bones: cleared, trampled: trampled,
                  from: group, was: cell.kind });
  }
  return events;
}

// Every tile of the same kind reachable from `i` through shared edges.
function sameGroup(i, kind, cells = state.cells) {
  const seen = new Set([i]), queue = [i], out = [];
  while (queue.length) {
    const at = queue.pop();
    out.push(at);
    for (const n of neighbours(at)) {
      if (seen.has(n)) continue;
      const c = cells[n];
      if (!c || c.kind !== kind) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return out;
}

// The preview runs the exact merge rule on copies, never the live board.
function previewGrowth(i) {
  if (state.over || state.cells[i] || !state.stock.length) return [];
  const cells = state.cells.map(function (c) { return c ? Object.assign({}, c) : null; });
  cells[i] = makeTile(state.stock[0]);
  return growFrom(i, cells, true);
}

function bumpClocks() {
  for (let i = 0; i < CELLS; i++) {
    if (isShadow(state.cells, i)) continue;
    const c = state.cells[i];
    if (c && (isAnimal(c.kind) || isPlant(c.kind))) c.clock += 1;
  }
}

// Predators eat top down. A rabbit the wolf takes is a rabbit that does
// not get to strip a patch of grass on the same turn, which is the whole
// reason an apex is worth keeping around at all.
// `meals.refused` rides along on the returned array: the squares where a
// mouth was hungry and found nothing. It is only read for the elephant,
// whose refusals are the one case a player cannot diagnose by looking —
// a board covered in animals that are all, silently, the wrong ones.
function feedEveryone() {
  const meals = [];
  const refused = [];
  for (const kind of PREDATOR_ORDER) {
    const cfg = ANIMALS[kind];
    for (let i = 0; i < CELLS; i++) {
      const me = state.cells[i];
      if (!me || me.kind !== kind || me.clock < cfg.eatAt) continue;
      if (isShadow(state.cells, i)) continue;

      const meal = pickMeal(i, cfg);
      if (!meal) { refused.push({ at: i, kind: kind }); continue; }

      clearCells(state.cells, [meal.at]);
      me.clock = 0;
      // A meal is worth what was eaten, except for the one mouth that
      // carries a `mealPct`. See ELEPHANT_MEAL_PCT.
      const points = Math.round(MEAL_VALUE[meal.kind] * (cfg.mealPct || 100) / 100);
      meals.push({ at: i, ate: meal.at, kind: kind, points: points, ateKind: meal.kind });
    }
  }
  meals.refused = refused;
  return meals;
}

// What a hungry animal at `i` reaches for. `diet` is in preference
// order — cheapest first — so the whole rule is: walk the diet, stop at
// the first kind that is actually beside you. Within one kind, take
// whichever is closest to running out, since grass about to wither or a
// rabbit about to starve was lost either way.
// Returns { at, kind } for the square it takes, or null if nothing it
// eats is beside it.
function pickMeal(i, cfg) {
  for (const want of cfg.diet) {
    let target = -1, worst = -1;
    for (const n of tileNeighbours(state.cells, i)) {
      const p = state.cells[n];
      if (!edible(cfg, p, want)) continue;
      if (p.clock > worst) { worst = p.clock; target = n; }
    }
    if (target >= 0) return { at: target, kind: want };
  }
  return null;
}

// Is `p` a meal of kind `want` for a mouth configured as `cfg`? The kind
// check is the old rule; `needs` is the elephant's extra one, and it
// lives here so the board, the warning ring and the actual bite all read
// the same sentence.
function edible(cfg, p, want) {
  if (!p || p.kind !== want) return false;
  if (cfg.needs === 'raised' && !isRaised(p)) return false;
  return true;
}

function collectDeaths() {
  const dead = [];
  for (let i = 0; i < CELLS; i++) {
    const c = state.cells[i];
    if (!c || !isAnimal(c.kind) || c.clock < ANIMALS[c.kind].starveAt) continue;
    if (isShadow(state.cells, i)) continue;
    dead.push({ at: i, kind: c.kind });
    // A big animal leaves one skeleton, not four. Four dead squares out
    // of twenty-five would end most runs where they stand, and losing
    // the elephant is punishment enough on its own.
    clearCells(state.cells, [i]);
    state.cells[i] = makeTile('bones');
  }
  return dead;
}

// The ground's own move. It lands on bare soil only, so it never takes
// a living tile — it takes the room the player was going to use.
//
// It keeps clear of animals, and that is a fairness rule rather than a
// difficulty one. Taking room is a cost the player can play around;
// taking the last bare square beside a hungry rabbit is an execution
// they cannot, because the only way to feed that rabbit was to build on
// the square the ground just took. Boards where an animal starved with
// nothing but dead ground around it were a third of all starvations, and
// none of them were a move the player got wrong.
//
// Staying away costs the ground almost nothing: it still lands, still
// every stoneEvery turns, just further out. Runs came back the same
// length and the same score — only the unanswerable deaths went.
function surfaceStone() {
  if (state.ticks % stoneEvery() !== 0) return null;
  const open = [];
  for (let i = 0; i < CELLS; i++) if (!state.cells[i]) open.push(i);
  if (!open.length) return null;
  // Late on, every bare square may be beside something alive; then the
  // stone lands anyway rather than the ground skipping a turn.
  const away = open.filter(function (i) {
    for (const n of neighbours(i)) {
      const c = state.cells[n];
      if (c && isAnimal(c.kind)) return false;
    }
    return true;
  });
  const from = away.length ? away : open;
  const at = from[(Math.random() * from.length) | 0];
  state.cells[at] = makeTile('stone');
  return { at: at, kind: 'stone' };
}

// Runs last, so anything grazed this turn is already gone and only
// growth nobody came for goes to scrub.
function witherPlants() {
  const gone = [];
  for (let i = 0; i < CELLS; i++) {
    const c = state.cells[i];
    if (!c || !isPlant(c.kind) || c.clock < plantLimit(c.kind)) continue;
    gone.push({ at: i, kind: c.kind });
    state.cells[i] = makeTile('scrub');
  }
  return gone;
}

// Several mouths fed on one turn multiply each other: the point of the
// game is a chain that runs, not a single animal kept alive in a corner.
// The season multiplies it again, so a chain still running in winter is
// worth several times the same chain in spring.
function scoreMeals(meals) {
  if (!meals.length) return 0;
  let base = 0;
  for (const m of meals) base += m.points;
  const gained = base * meals.length * scoreMultiplier();
  state.score += gained;
  return gained;
}

// One placement can set off a chain: the grass it completes finishes a
// pair of grass, which finishes a pair of rabbits. growFrom already
// returns one entry per step, so the chain length is sitting right
// there, and it multiplies exactly the way a multi-meal turn does.
//
// Paying the chain rather than the tiles is the point. A two-step growth
// is not twice the luck of a one-step growth, it is a square chosen so
// that the thing it makes lands where the next thing was waiting — and
// that is the move worth teaching.
function scoreGrowth(events) {
  if (!events.length) return 0;
  let base = 0;
  for (const e of events) base += growValue(e.kind);
  const gained = base * events.length * scoreMultiplier();
  // The chain is paid as one thing, but the replay shows it one rung at a
  // time, so each rung carries its own share. The shares are the same
  // multiplication as the total and add up to it exactly — nothing here
  // invents points that the score did not move by.
  for (const e of events) e.points = growValue(e.kind) * events.length * scoreMultiplier();
  state.score += gained;
  return gained;
}

// The best score used to be checked only on the world's move, because
// the world's move was the only thing that could raise the score. Now
// that placing a tile can, the check lives somewhere both callers reach.
function bankScore() {
  if (state.score <= state.best) return;
  state.best = state.score;
  writeBest(state.best);
}

function rank(kind) {
  let n = 0, k = 'sprout';
  while (k && k !== kind) { k = GROWS_INTO[k]; n += 1; }
  return k === kind ? n : -1;
}

// ---------- Driving the clock ----------
//
// One interval, restarted whenever the rate changes. sim.js never gets
// here — it calls worldTick() and placeTile() itself — so all of the
// real-time machinery stays in this one place and none of the rules
// depend on it.

let tickTimer = 0;

function tickMs() { return TICK_MS * (state.relaxed ? RELAXED_SCALE : 1); }

// The meadow must not age while nobody is watching it. A run left in a
// background tab for an hour should be exactly where it was left, so
// this stops the clock outright rather than catching up missed ticks —
// fast-forwarding would hand the player a board of bones for putting
// their phone in their pocket.
function syncClock() {
  if (window.BioAudio) window.BioAudio.pause(state.over || state.paused);
  const shouldRun = !state.over && !state.paused;
  if (shouldRun && !tickTimer) tickTimer = setInterval(worldTick, tickMs());
  else if (!shouldRun && tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
}

function setPaused(on) {
  if (state.paused === on) return;
  state.paused = on;
  syncClock();
  render();
}

// Changing speed mid-run is allowed and takes effect on the next tick.
function setRelaxed(on) {
  if (state.relaxed === on) return;
  state.relaxed = on;
  if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
  syncClock();
  render();
}

function endRun() {
  state.over = true;
  syncClock();
  el.goTitle.textContent = 'The meadow filled in ' + seasonLabel();
  const lv = levelAt(displayScore(state.score));
  el.goScore.textContent = displayScore(state.score).toLocaleString();
  el.goLevel.textContent = 'Level ' + lv.level + ' · ' + lv.name;
  el.goNote.textContent = endNote();
  el.gameover.hidden = false;
  el.goAgain.focus();
}

function endNote() {
  return state.topKind === 'elephant' ? 'Elephant reached! Your meadow is complete. Play again to beat your score.' : 'You reached ' + state.topKind + '. Next discovery: ' + GROWS_INTO[state.topKind] + '.';
}

// What your own move did: what grew, what the chain was worth, and the
// empty hand — the one thing that stops the next move and is worth
// saying out loud.
// 'elephant' is the only rung that starts with a vowel, and the game has
// been saying "A elephant" at the one moment it most wants to sound
// like an occasion.
function an(kind) { return ('aeiou'.indexOf(kind[0]) >= 0 ? 'An ' : 'A ') + kind; }

function placeMessage(grew, gained) {
  const bits = [];

  if (grew.length) {
    const last = grew[grew.length - 1];
    if (grew.length > 1) {
      bits.push('A chain of ' + grew.length + ' — one square did all of that.');
    }
    bits.push(an(last.kind) + ' joined the meadow.');
    if (gained) bits.push('+' + Math.round(gained).toLocaleString() + '.');
    const bones = grew.reduce(function (n, g) { return n + g.bones.length; }, 0);
    if (bones) bits.push(bones === 1 ? 'One dead square came back.' : bones + ' dead squares came back.');
    // Only the elephant can do this, and when it does it is the loudest
    // thing that happened, so it is said last and in its own sentence.
    const flat = grew.reduce(function (n, g) { return n + (g.trampled ? g.trampled.length : 0); }, 0);
    if (flat) bits.push(flat === 1 ? 'It flattened the square it came down on.' : 'It came down on ' + flat + ' squares and flattened them.');
  } else {
    bits.push('Planted.');
  }

  if (!state.stock.length) bits.push('Hand empty — the next tile is on its way.');

  return bits.join(' ');
}

function tickMessage(meals, deaths, withered, stone, gained, dealt) {
  const bits = [];

  if (meals.length) {
    // Name the biggest thing that happened. With diets, WHAT was eaten is
    // the news — a wolf taking a fox is a very different turn from a wolf
    // taking the rabbit you left out for it.
    const who = [];
    const top = meals.slice().sort(function (a, b) { return rank(b.kind) - rank(a.kind); })[0];
    const rest = meals.length - 1;
    who.push(mealLine(top.kind, top.ateKind));
    if (rest) who.push(rest === 1 ? 'one more fed' : rest + ' more fed');
    let line = who.join(', ') + ' +' + gained.toLocaleString();
    if (meals.length > 1) line += ' (×' + meals.length + ')';
    bits.push(line[0].toUpperCase() + line.slice(1));
  }

  if (deaths.length) {
    bits.push(deaths.length === 1
      ? an(deaths[0].kind) + ' starved.'
      : deaths.length + ' animals starved.');
  }

  // Why nothing happened is news too, for the one animal whose refusals
  // are invisible. A wolf that does not eat is a wolf with nothing
  // beside it and the board says so; an elephant that does not eat may
  // be surrounded, and the reason is a rule rather than a gap.
  const starved = deaths.some(function (d) { return d.kind === 'elephant'; });
  const balked = (meals.refused || []).some(function (r) { return r.kind === 'elephant'; });
  if (balked && !starved) {
    bits.push(nearElephant()
      ? 'The elephant refused its neighbours — it only takes animals you raised by merging.'
      : 'The elephant found nothing to eat. Merge it something.');
  }

  if (withered.length) {
    bits.push(withered.length === 1
      ? 'Ungrazed growth went to scrub.'
      : withered.length + ' patches went to scrub.');
  }

  if (stone) bits.push('A stone surfaced.');

  // Only worth saying when it is the news. A tile arriving into a hand
  // you already had tiles in is not news; one arriving into an empty
  // hand is the thing the player is waiting for.
  if (dealt && state.stock.length === 1) bits.push('A tile arrived.');

  // Nothing happened, so say what the board is doing rather than going
  // blank — a status line that empties reads as the game having stopped.
  // On an untouched board that means keeping the opening instruction,
  // which otherwise gets wiped by the first tick a second and a half in,
  // before anyone has finished reading it.
  if (!bits.length) {
    return state.cells.some(function (c) { return c; })
      ? 'The meadow is quiet.'
      : 'Tap an empty square to plant. The meadow moves on its own.';
  }
  return bits.join(' ');
}

// ============================================================
// Animal art — the hand-painted parts in img/, composed into a
// still portrait. If any file is missing the tiles fall back to the
// inline SVG silhouettes in index.html instead.
// ============================================================

const SPRITE_FILES = {
  // The fed face is the grin, not the neutral one: rabbit-head-calm.png
  // is kept as art but no longer played. The happy head is the existing
  // eating face with the calm face's open eye grafted over its shut one,
  // plus a blush -- a rabbit that is pleased with itself rather than one
  // that is merely not starving.
  rabbitHeadHappy: 'rabbit-head-happy.png',
  rabbitHeadCalm: 'rabbit-head-calm.png',
  rabbitHeadPanic: 'rabbit-head-panic.png',
  rabbitEar: 'rabbit-ear.png',
  rabbitBody: 'rabbit-body.png',
  rabbitLegHind: 'rabbit-leg-hind.png',
  rabbitLegFront: 'rabbit-leg-front.png',
  rabbitTail: 'rabbit-tail.png',
  foxHeadCalm: 'fox-head-calm.png',
  foxHeadHunt: 'fox-head-hunt.png',
  foxBody: 'fox-body.png',
  foxLegHind: 'fox-leg-hind.png',
  foxLegFront: 'fox-leg-front.png',
  foxTail: 'fox-tail.png',
  wolfCalm: 'wolf-calm.png',
  wolfHungry: 'wolf-hungry.png',
  // Hunger told by posture, like the wolf, because this animal is one
  // flat near-black and has no bright colour to drain. The head drops
  // below the shoulders, the hump takes over as the highest point, and
  // the cub turns its face into its mother's leg -- so the silhouette
  // and the brightest spot on the tile fall together.
  bearCalm: 'bear-calm.png',
  bearHungry: 'bear-hungry.png',
  buffaloCalm: 'buffalo-calm.png',
  buffaloHungry: 'buffalo-hungry.png',
  deerCalm: 'deer-calm.png',
  deerHungry: 'deer-hungry.png',
  // The second animal after the elephant to own a hungry painting, and
  // the first whose hunger is told by a prop rather than a face. Both
  // files are cut on one shared frame (make-face-pair.py), so the swap
  // moves the scarf and nothing else.
  zebraCalm: 'zebra-calm.png',
  zebraHungry: 'zebra-hungry.png',
  // The only animal whose mouth is already open when it is fed, so it
  // is the only one whose hunger is told by SUBTRACTION: the yawn
  // closes, the mane deflates inward, the crown slides off the top of
  // the head. Nothing is added, and lion-calm.png is byte-for-byte the
  // old single file -- the shared frame landed on the existing crop.
  lionCalm: 'lion-calm.png',
  lionHungry: 'lion-hungry.png',
  // The only hungry pair on the board made with no image model: the
  // aura was already painted, so flare-tiger-aura.py lifts the gold out
  // by hue and scales it outward under the animal. The tiger itself is
  // byte-for-byte the same in both files.
  tigerCalm: 'tiger-calm.png',
  tigerHungry: 'tiger-hungry.png',
  elephantCalm: 'elephant-calm.png',
  elephantHungry: 'elephant-hungry.png'
};

// Where each part sits and how wide it is drawn, in units measured from
// the animal's centre. `w` is the drawn width; height follows the
// image's own aspect ratio, so re-exporting the art at another
// resolution changes nothing on screen.
const RIG = {
  // THE RABBIT IS THE ONE THAT NEVER SETTLES.
  //
  // Same seven pieces of art as before; only the numbers moved. The
  // pose is "about to jump" rather than "sitting", because at 44px a
  // face is three pixels across and the silhouette is the whole budget:
  //
  //   tilt      leans into the jump, nose up
  //   ears      one up, one flicked back. Symmetry reads as STOPPED, so
  //             breaking it is most of the life in the tile
  //   forelegs  off the floor and swung forward
  //   hind legs tucked and angled, so the bottom of the silhouette is a
  //             coiled spring instead of a flat base
  rabbit: {
    fit: { span: 38, ox: 0, oy: 1.2, tilt: -7 },
    parts: [
      ['rabbitLegHind', { w: 10.8, x: -5.2, y: 5.1, px: 0.5, py: 0.12, r: 8 }, 0.72],
      ['rabbitLegFront', { w: 5.9, x: 5.6, y: 4.3, px: 0.5, py: 0.10, r: -12 }, 0.72],
      ['rabbitTail', { w: 10.0, x: -11.0, y: 1.0, px: 0.5, py: 0.5 }, 1],
      ['rabbitBody', { w: 21.5, x: -1.2, y: 3.2, px: 0.5, py: 0.5 }, 1],
      ['rabbitLegHind', { w: 10.8, x: -3.8, y: 5.4, px: 0.5, py: 0.12, r: 8 }, 1],
      ['rabbitLegFront', { w: 5.9, x: 6.8, y: 4.6, px: 0.5, py: 0.10, r: -12 }, 1],
      ['rabbitEar', { w: 7.5, x: 4.6, y: -7.2, px: 0.5, py: 0.95, r: -40 }, 0.85],
      ['rabbitEar', { w: 7.5, x: 6.8, y: -7.4, px: 0.5, py: 0.95, r: 10 }, 1],
      ['@head', { w: 18.7, x: 6.4, y: -2.0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'rabbitHeadHappy', hungry: 'rabbitHeadPanic' }
  },
  fox: {
    fit: { span: 36, ox: 3, oy: 2 },
    parts: [
      ['foxLegHind', { w: 6.1, x: -5.0, y: 5.1, px: 0.5, py: 0.10 }, 0.72],
      ['foxLegFront', { w: 3.6, x: 5.2, y: 5.1, px: 0.5, py: 0.10 }, 0.72],
      // the tail art lies horizontally with its thick base on the left
      // edge, so that edge is the pivot and the part gets mirrored
      ['foxTail', { w: 21.7, x: -8.6, y: 1.4, px: 0.06, py: 0.55, flip: true }, 1],
      ['foxBody', { w: 23.5, x: -1.2, y: 3.2, px: 0.5, py: 0.5 }, 1],
      ['foxLegHind', { w: 6.1, x: -3.8, y: 5.4, px: 0.5, py: 0.10 }, 1],
      ['foxLegFront', { w: 3.6, x: 6.4, y: 5.4, px: 0.5, py: 0.10 }, 1],
      ['@head', { w: 19.5, x: 6.8, y: -2.2, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'foxHeadCalm', hungry: 'foxHeadHunt' }
  },
  // THE WOLF IS ONE PIECE ON PURPOSE.
  //
  // The rabbit and the fox are cut into limbs because their art was
  // drawn that way, one closed shape per file. The wolf's art is a
  // finished whole-body painting, and cutting a painting leaves the cut
  // edge with no outline on it. That would be worth paying only if the
  // parts bought something, and here they do not: this rig is drawn
  // once and held (see paintAnimal), the walk lives on the tile in CSS,
  // and the far legs are already painted into the picture.
  //
  // The hungry wolf, when it came, did not need that cut after all. It
  // is a second whole painting, like the elephant and the zebra, and the
  // splitting note above stands only as the reason it WOULD have been
  // worth doing if the two faces had ever had to share a body.
  //
  // WHAT A STARVING WOLF CHANGES IS ITS OUTLINE, IN FOUR PLACES.
  //
  // The tail comes down off the horizontal and hangs by the hind legs;
  // the head drops until the skull is no longer the highest point of the
  // animal; the fur along the back stands up into a spiky ridge; the
  // ears go flat and back. The mouth stays shut on purpose -- a snarl is
  // an animal that intends to do something about it, and this one has
  // run out of the means. The legs, the paws and the belly do not move
  // at all, which is the whole reason the swap is invisible: 71% of the
  // two silhouettes is shared, and all of it is the half holding the
  // wolf up (concepts/animal-art-v1/hungry-faces/wolf-overlay.png).
  //
  // Nothing about the FACE carries this. At 44px the head is four pixels
  // across. What the player reads is a long grey animal going short and
  // spiky, and the tail -- the one silhouette landmark this painting
  // has -- dropping out of the left side of the tile.
  wolf: {
    // Measured against the fox rather than guessed: at w 37 the wolf
    // covers 72% of the tile's height to the fox's 73%, so the bigger
    // predator does not read as the smaller animal. It is the wider of
    // the two, which is what a wolf should be. `oy` sets the feet just
    // above the bottom edge with room left for `sag`, so a starving
    // wolf sinks without losing its paws off the canvas.
    //
    // `oy` moved 4.2 -> 3.71 when the pair shipped, and the wolf did
    // not. The old single file carried the loose crop from before the
    // invisible-dust fix (220x184 with the art inside 4,8-220,170); the
    // pair is cut tight and shared, so the same art now sits in a 220x162
    // frame and every rig number that was solved against the old padding
    // had to be re-solved against the new one. 3.71 is the value that
    // puts the paws back on 95.6% -- the baseline the buffalo, deer,
    // zebra, lion and tiger were all fitted to. Height 71.7%, top 23.9%,
    // starving feet 98.5%: the same four numbers as before, which is the
    // proof that this was a reframing and not a resize.
    fit: { span: 38, ox: 0, oy: 3.71 },
    parts: [
      ['@head', { w: 37, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'wolfCalm', hungry: 'wolfHungry' }
  },
  // THE BEAR IS A MOTHER AND HER CUB, AND THE CUB IS THE WHOLE PROBLEM.
  //
  // One painting, same reasoning as the wolf. What is different is the
  // framing. The pair is drawn wide, and a wide picture fitted to the
  // tile by its width comes out short: at 44px the two of them stood
  // 29px tall against the wolf's 35, and the cub -- 15px, overlapping
  // its mother's flank, the same near-black as she is -- stopped being
  // a cub and became a lump on her side.
  //
  // So this rig does not fit the painting to the tile. It draws it half
  // again as wide as the tile is and pushes it left (`ox`), so the
  // mother's rump falls off the edge and what is left inside the square
  // is her head, her shoulder, and the cub against the pale blaze on
  // her chest. Measured, not guessed: the cub's face and its white bib
  // both survive the trip down to 44px, and the pair now stands taller
  // than the wolf, which is what the ladder says it should be.
  //
  // Nothing is cut from the file. The crop is only where the canvas
  // ends, so the framing is two numbers here and can be moved again.
  bear: {
    //
    // The pair shipped and the numbers below all moved, because the old
    // single file was a loose crop from before the invisible-dust fix
    // (220x153 with the art inside 205x141) and the shared frame is cut
    // tight (220x149, art 217x149). Same painting, bigger fraction of
    // the file, so `w` comes down 47 -> 44.48 to keep the bear the size
    // it was, and `ox` 5.2 -> 4.79 and `oy` 0.8 -> -0.48 put it back in
    // the same place. Height 79.3%, feet 88.4%, top 9.1%: the same
    // numbers as before, which is the proof that this was a reframing
    // and not a resize. 88.4% is still the one baseline on the board
    // that is not 95.7% -- that was deliberate and it stays.
    fit: { span: 38, ox: 4.79, oy: -0.48 },
    parts: [
      ['@head', { w: 44.48, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'bearCalm', hungry: 'bearHungry' }
  },
  // THE BUFFALO IS LONG WHERE EVERYTHING ELSE IS TALL.
  //
  // A pair now, calm and hungry, cut with one frame. The shape of the
  // animal is still what governs the rig: the art is 220x115, an aspect
  // of 0.52 against the wolf's 0.84. Fitted inside the tile by its
  // width it would stand half the tile's height to the wolf's 72% -- a
  // rung BELOW the wolf, so smaller is right, but not by that much.
  //
  // So this rig follows the bear: wider than the tile (w 46.95 against
  // a span of 38) and pushed left (`ox` 1.88), so the rump and the
  // black tail tuft run off the left edge and what stays in the square
  // is the head, the horns, the hump and all four legs. 64.6% of the
  // tile's height, hooves on the 95.7% baseline the wolf and the deer
  // stand on, with room left under them for `sag`.
  //
  // THE HUNGER CUE IS THE HEAD, AND IT HAD TO BE. Every other trick on
  // this board is unavailable here: ribs are an inside line and vanish
  // at 44px, a dropped tail is already off the left edge, the pink
  // cheek is 0.69% of the body, and dust or a pawed hoof would move the
  // feet. What this painting does have is the horns -- the highest
  // point of the silhouette AND its brightest mass at once -- so
  // letting the head hang drops the top line onto the shoulder hump and
  // carries the one bright shape down with it. Two cues from one
  // change, the same deal the bear and the deer took.
  //
  // The hungry head swings the horns 36px further right than the calm
  // nose, which widens the shared frame from 1319 to 1355 source px.
  // That is only a cost if the tile has no room to give it back: here
  // `w` went 50 -> 46.95 and `oy` 6.7 -> 5.09 against the new crop and
  // every measured number came back to where it was, so it cost
  // nothing. See concepts/animal-art-v1/hungry-faces/buffalo-ox-check.png,
  // which is the two framings that were compared before this one stayed.
  buffalo: {
    fit: { span: 38, ox: 1.88, oy: 5.09 },
    parts: [
      ['@head', { w: 46.95, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'buffaloCalm', hungry: 'buffaloHungry' }
  },
  // THE DEER IS THE NARROW ONE, AND NARROW IS NOT SMALL.
  //
  // A pair now, calm and hungry, cut with one frame. What is new is the
  // shape of the picture: 220x321, the only portrait art on the board,
  // where every other animal is wider than it is tall. Fitted to the
  // tile by its width the way the wolf is, it would stand 45% of the
  // tile and sit in the middle of an empty square looking like
  // something that had wandered in by mistake.
  //
  // So it is sized to be read instead of to be contained. At `w` 22.96
  // the calm deer stands 88.2% of the tile and covers 52.7% of its
  // width -- the tallest animal after the rabbit and by far the
  // thinnest, against the wolf's 96.5% width and the bear's 115.5%. It
  // does not read as the biggest animal, because height is not what
  // mass looks like: it reads as the leggy one, which is what a
  // frightened deer is. The antlers and the stick legs both survive
  // 44px.
  //
  // `w` was 20 while this was one painting, 220x369. The hungry deer
  // drops its head, and the antlers swing forward past where the nose
  // used to be, so the shared frame grew 106 source px to the right and
  // the art inside it came out proportionally smaller. `w` 22.96 pays
  // that back: 88.2% / 52.7% / 95.7% are the numbers the single
  // painting had, to a tenth of a percent. Nothing on screen changed
  // size -- only the rectangle around it did. The deer had the side air
  // to spend on that; the tiger did not, which is why the tiger paid in
  // height instead.
  //
  // `oy` 0.62 is solved, not nudged (0.58 before the reframe). It puts
  // the hooves at 95.7% of the tile -- the wolf and the buffalo
  // baseline -- which is the number that leaves the 1.1 units of `sag`
  // somewhere to go, so a starving deer sinks without losing its hooves
  // off the bottom edge.
  //
  // `ox` is 0 because nothing needs to run off the side here. The bear
  // and the buffalo are pushed left to crop a wide painting down to its
  // head and shoulder; the deer fits whole, and the air either side of
  // it is what a narrow animal looks like in a square.
  //
  // The hungry painting is the biggest silhouette change on the board:
  // the neck sags, the head hangs below the line of the back and the
  // antlers come down with it, so the tall one stops being tall and
  // about half the painted pixels at 44px differ from the calm side.
  // Head, antlers, ears and tail move. The legs, the hooves, the belly
  // and the three sets of trembling marks do not -- the feet agree to
  // 0.0px, which is why the pair can be swapped mid-tile.
  deer: {
    fit: { span: 38, ox: 0, oy: 0.62 },
    parts: [
      ['@head', { w: 22.96, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'deerCalm', hungry: 'deerHungry' }
  },
  // THE ZEBRA IS THE DEER'S PROBLEM AGAIN, AND THE SCARF IS THE ANSWER.
  //
  // 220x407 -- narrower even than the deer's 220x321, because this one
  // stands square on all four legs instead of in profile, so the body
  // is drawn end-on and almost nothing of it is width. Two portrait
  // animals on neighbouring rungs was the risk worth checking before
  // anything else: at 44px a tall thin brown thing beside a tall thin
  // striped thing is two of the same tile.
  //
  // It is not, and the reason is not the stripes. The stripes do
  // survive -- four or five of them read across the flank -- but what
  // separates the two tiles at a glance is the yellow scarf, the one
  // saturated colour anywhere on this half of the ladder. The deer is
  // brown on cream; the zebra is brown on cream with a gold knot at the
  // throat. That is the tile's signature, and it is legible before the
  // animal under it is.
  //
  // `w` 19 puts it 92.5% of the tile tall and 50.0% wide, against the
  // deer's 88.3% and 52.6%: taller by four points, a shade narrower,
  // and the same bounding box within a rounding error. Equal boxes are
  // not equal animals -- the deer is four sticks and a neck with the
  // square's air showing through it, while the zebra fills its box with
  // a solid barrel of a body, so it reads as the heavier of the two
  // without being drawn bigger. `w` 20 was the other candidate and is
  // the reason 19 shipped: it stands 97.4%, which puts the tips of the
  // mane through the top edge of the tile.
  //
  // `oy` -0.218 is solved, not nudged: hooves at 95.7%, the wolf and
  // buffalo and deer baseline, with the 1.1 units of `sag` still
  // somewhere to go. It is the only negative `oy` on the board, which
  // is only to say this is the tallest painting here -- the art starts
  // higher in its own box than anything else does.
  //
  // THE HUNGRY ONE TAKES THE SIGNATURE APART.
  //
  // Everything above says the scarf is what this tile is read by, so the
  // hungry painting is the scarf coming undone: the knot lets go, the two
  // ends hang dead to the knee, and the gold goes to a dull ochre. At
  // 44px the tied bow is a bright blob at the throat and the loose one is
  // a long dark band down the body -- a change of shape AND of value, in
  // the one place the eye was already looking.
  //
  // The face is untouched, and could not have carried this: at 44px a
  // zebra's head is three pixels across. Only the elephant's steam and
  // the rabbit's ears have ever worked at this size, and both of them
  // work for the same reason this does -- they change the silhouette.
  //
  // The colour was not drawn, it was computed. The scarf is the only
  // saturated yellow on the painting, so a hue window selects it and
  // nothing else; four strengths were rendered on a tile before this one.
  // See concepts/animal-art-v1/hungry-faces/.
  //
  // Nothing in `fit` moved, and that is not luck: both paintings fill
  // their canvas edge to edge, so the shared frame came out identical to
  // the old single crop and `zebra-calm.png` is byte-for-byte the file
  // that used to be `zebra-whole.png`. The rig did not need re-measuring.
  zebra: {
    fit: { span: 38, ox: 0, oy: -0.218 },
    parts: [
      ['@head', { w: 19, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'zebraCalm', hungry: 'zebraHungry' }
  },
  // THE LION IS LYING DOWN, AND IT IS STILL THE SECOND BIGGEST THING HERE.
  //
  // The painting is a king mid-yawn with a tear in one eye: crowned,
  // jaws wide, front paws thrown out, flat on the ground. It came in as
  // a JPEG on cream paper with no alpha at all, so it went through
  // `cutout-bg.py` before `make-game-asset.py` could see it -- the one
  // animal here that needed lifting off its own background.
  //
  // Sizing it is the bear's problem in a third form. The mane and the
  // raised head make this a tall picture of a low animal: fitted so
  // that its height sat between the bear's 79.3% and the tiger's 82.4%,
  // the way the tiger was fitted between the wolf and the elephant, it
  // came out 92.1% wide and read as the SMALLEST of the three big
  // carnivores. Height is the wrong axis for an animal that is lying
  // down.
  //
  // So it is solved on area instead. `w` 39 gives 90.5% tall by 102.6%
  // wide -- a painted box of 9285 against the bear's 9143 and the
  // tiger's 11058, which is the order the ladder asks for and the order
  // the eye reports. It is taller than the tiger and it does not read
  // as bigger than the tiger, because the tiger is half again as wide;
  // width is what mass looks like on this board, and the crown is what
  // rank looks like.
  //
  // The overflow is 2.6%, 1.3% off each side: the last hair of the tail
  // on the left, the tip of one front paw on the right. `ox` stays 0
  // because the painting is already centred on its own mass and there
  // is nothing here worth spending the overflow on -- the face is in
  // the middle, not at an edge, which is what makes this different from
  // the tiger.
  //
  // `oy` 0.16 is solved like the rest: paws at 95.7%, sag intact.
  //
  // The hungry painting cost this rig nothing. Every change in it --
  // the yawn closing, the mane deflating, the crown tipping off the
  // top -- pulls the outline INWARD, so the shared frame is decided by
  // the fed painting alone and comes out as the crop that was already
  // there. lion-calm.png is byte-for-byte the old lion-whole.png, and
  // all four numbers below are untouched. Only the zebra did this too.
  lion: {
    fit: { span: 38, ox: 0, oy: 0.16 },
    parts: [
      ['@head', { w: 39, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'lionCalm', hungry: 'lionHungry' }
  },
  // THE TIGER IS THE FACE, AND THE FACE IS NOT SHOUTING.
  //
  // Same reasoning as the wolf and the deer. What this one has that
  // none of the others do is an aura: gold spikes struck around the
  // head. The wide soft glow they were drawn inside was transparent and
  // did not survive the crop, which is the outcome we wanted -- at 44px
  // a haze is dirt on the screen, while the spikes stay clean marks and
  // say the same thing.
  //
  // THE AURA IS THE HUNGER. Starving, the spikes reach half again as
  // far and stand over the tiger's back; the animal underneath is not
  // touched, down to the byte. Eight fiercer tigers were drawn and
  // thrown away before this one, and what carries it is the cold
  // half-lidded stare -- bare its teeth and it is a different animal.
  // So this is the one hungry pair made with no image model at all:
  // hungry-faces/flare-tiger-aura.py lifts the gold out of the painting
  // by hue and stacks scaled copies of it outward UNDER the body.
  //
  // `w` 51 puts it at 134.2% of the tile's width and 82.4% of its
  // height. Height is not the ladder here and never has been -- the
  // deer stands tallest of all at 88.3% and is fifth of twelve --
  // because a portrait painting fills a square differently from a
  // cropped one. What 82.4% buys is a tiger just over the wolf's 81.4%
  // and just under the elephant's 84.0%, so the two animals it is
  // drawn between read as its neighbours. Width is what says eleventh:
  // 134.2% is wider than anything else on the board, the bear's 123.7%
  // and the buffalo's 131.6% included, because those two are cropped to
  // head and shoulder and the tiger is drawn full length.
  //
  // `ox` 5 spends the overflow on purpose. Centred, the tile cuts 17%
  // off each side and takes the aura with it. Pushed left, the right
  // edge loses 3.9% -- the outer tips of two spikes -- and the tail
  // pays for the rest. The tail is the one part of this animal that
  // carries nothing. The face is the character, and the face is whole.
  //
  // `oy` -0.6 is the same solve as everywhere else: paws at 95.7% of
  // the tile, the wolf and buffalo baseline, which leaves the 1.1 units
  // of `sag` somewhere to go when it starves. It moved from 1.7 only
  // because the shared frame grew 131 source px taller to hold the
  // flared aura -- the frame did not get WIDER, so `w` is untouched and
  // the tiger is drawn at the size it always was (134.2% wide; 83.0%
  // tall against the old 82.4%, which is one row of rounding in the
  // crop, not a resize).
  tiger: {
    fit: { span: 38, ox: 5, oy: -0.6 },
    parts: [
      ['@head', { w: 51, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'tigerCalm', hungry: 'tigerHungry' }
  },
  // The muscled elephant is the first whole-body painting with a real
  // second face: a smirk when fed, a snorting glare when hungry. Both
  // were cut from one shared box, so the body stays put and only the
  // face (and the steam from the trunk) changes on the swap. The whole
  // body fits, rump to trunk tip, with a little room each side: it
  // breathes and sways, and a body cut off at the edge stops reading as
  // one animal the moment it moves. Feet sit where they did before.
  elephant: {
    fit: { span: 48, ox: 0, oy: 6.4 },
    parts: [
      ['@head', { w: 45, x: 0, y: 0, px: 0.5, py: 0.5 }, 1]
    ],
    head: { calm: 'elephantCalm', hungry: 'elephantHungry' }
  }
};

const sprites = {};
const spritesFor = {};   // kind -> is every part of its rig loaded?
let spritesReady = false;

// The source art is ~200px per part but a part lands on screen at
// 4-20px. Letting the canvas make that jump gives ragged line art, so
// each image is halved down once at load time.
function shrinkSprite(img, maxDim) {
  let c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  while (Math.max(c.width, c.height) > maxDim * 2) {
    const n = document.createElement('canvas');
    n.width = Math.max(1, Math.round(c.width / 2));
    n.height = Math.max(1, Math.round(c.height / 2));
    const g = n.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, n.width, n.height);
    c = n;
  }
  return c;
}

// Which parts each animal needs. A kind is painted only once every part
// it names has loaded; a kind whose art is missing falls back to its
// inline SVG silhouette on its own, leaving the other kinds painted.
// That is what lets a new rung arrive on the ladder before its art does.
function partsOf(kind) {
  const rig = RIG[kind];
  const keys = [];
  for (const part of rig.parts) {
    if (part[0] !== '@head') keys.push(part[0]);
  }
  for (const face in rig.head) keys.push(rig.head[face]);
  return keys;
}

function loadSprites() {
  const keys = Object.keys(SPRITE_FILES);
  let left = keys.length;
  const settle = function () {
    left -= 1;
    if (left > 0) return;
    // a kind is ready when every part it asks for is in hand
    for (const kind in RIG) {
      spritesFor[kind] = partsOf(kind).every(function (k) { return sprites[k]; });
    }
    spritesReady = true;
    render();
  };
  for (const key of keys) {
    const img = new Image();
    img.onload = function () {
      sprites[key] = { img: shrinkSprite(img, 72), w: img.width, h: img.height };
      settle();
    };
    // a missing file only costs the kinds that wanted it
    img.onerror = settle;
    img.src = 'img/' + SPRITE_FILES[key];
  }
}

// Paints one animal, still, into a canvas sized `px` on a side.
// `fed` is 1 just after a meal and 0 at death: a hungry animal sags and
// wears its other face, so the tile reads before the meter does.
function paintAnimal(canvas, type, fed) {
  const rig = RIG[type];
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const px = canvas.clientWidth || 44;
  canvas.width = Math.round(px * dpr);
  canvas.height = Math.round(px * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, px, px);

  const s = px / rig.fit.span;
  const sag = (1 - fed) * 1.1;
  ctx.save();
  ctx.translate(px / 2 - rig.fit.ox * s, px / 2 + (rig.fit.oy + sag) * s);
  ctx.scale(s, s);
  // A whole-body lean, in degrees, for animals whose pose is part of
  // their character. Negative lifts the nose (everything faces right).
  if (rig.fit.tilt) ctx.rotate(rig.fit.tilt * Math.PI / 180);

  const headKey = rig.head[fed < 0.34 ? 'hungry' : 'calm'];
  for (const [name, p, alpha] of rig.parts) {
    const sprite = sprites[name === '@head' ? headKey : name];
    if (!sprite) continue;
    const w = p.w, h = p.w * (sprite.h / sprite.w);
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(p.x, p.y);
    // `r` turns the part about its own anchor (px/py), so an ear pinned
    // at its base swings from the base rather than sliding sideways.
    if (p.r) ctx.rotate(p.r * Math.PI / 180);
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(sprite.img, -w * p.px, -h * p.py, w, h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------- Rendering ----------

const el = {};
let cellNodes = [];
let previewOrigin = -1;
let previewMode = '';
let pointerGesture = null;
let cancelledPlacement = false;

function kindName(kind) {
  return kind ? kind[0].toUpperCase() + kind.slice(1) : 'Waiting';
}

function clearMovePreview() {
  previewOrigin = -1;
  previewMode = '';
  if (el.previewLayer) el.previewLayer.textContent = '';
  for (const node of cellNodes) {
    node.classList.remove('cell--preview-origin', 'cell--preview-step', 'cell--preview-destination');
  }
  if (el.moveHint) {
    el.moveHint.classList.remove('is-previewing');
    el.moveHint.textContent = state.over ? 'Meadow full · try a new game'
      : state.paused ? 'The meadow is paused'
      : 'Tap to plant · hold to see the merge path';
  }
}

function showMovePreview(i, mode) {
  if (state.paused || state.over || state.cells[i] || !state.stock.length) return;
  previewOrigin = i;
  previewMode = mode;
  renderMovePreview();
}

// Recomputed from live state after every render, including world ticks.
// The overlay has no pointer events; the cell's ordinary click still plants.
function renderMovePreview() {
  const origin = previewOrigin;
  const mode = previewMode;
  clearMovePreview();
  // A world tick can put a stone under a finger before pointerup. Cancel
  // that gesture even if the browser stops dispatching events to the
  // newly disabled button, so it cannot later plant on another square.
  if (pointerGesture && (state.paused || state.over || state.cells[pointerGesture.at])) {
    cancelledPlacement = true;
    pointerGesture = null;
  }
  if (origin < 0 || state.paused || state.over || state.cells[origin] || !state.stock.length) return;
  previewOrigin = origin;
  previewMode = mode;
  const forecast = previewGrowth(origin);
  const last = forecast.length ? forecast[forecast.length - 1] : { at: origin, kind: state.stock[0] };
  const lastSide = bigSide(last.kind);
  cellNodes[origin].classList.add('cell--preview-origin');
  for (const step of forecast) cellNodes[step.at].classList.add('cell--preview-step');
  for (const at of blockAt(last.at, lastSide)) cellNodes[at].classList.add('cell--preview-destination');
  if (el.moveHint) {
    el.moveHint.classList.add('is-previewing');
    el.moveHint.textContent = kindName(last.kind)
      + (lastSide > 1 ? ' · ' + lastSide + '×' + lastSide : '')
      + (forecast.length ? ' · ' + forecast.length + (forecast.length === 1 ? ' merge' : ' merges') : ' · plant')
      + ' → row ' + (Math.floor(last.at / SIZE) + 1) + ', col ' + (last.at % SIZE + 1);
  }
  if (!el.previewLayer || !forecast.length) return;
  const frame = el.previewLayer.getBoundingClientRect();
  if (!frame.width || !frame.height) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svgNode = function (tag, attrs) {
    const node = document.createElementNS(svgNS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  };
  const svg = svgNode('svg', {
    class: 'merge-path', viewBox: '0 0 ' + frame.width + ' ' + frame.height,
    width: '100%', height: '100%', 'aria-hidden': 'true'
  });
  const defs = svgNode('defs', {});
  const marker = svgNode('marker', {
    id: 'mergePreviewArrow', viewBox: '0 0 10 10', refX: '8', refY: '5',
    markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse'
  });
  marker.appendChild(svgNode('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'currentColor' }));
  defs.appendChild(marker);
  svg.appendChild(defs);
  // Measure from the empty origin's single square. An existing elephant's
  // home already spans two rows, and its other three DOM cells are hidden;
  // their rectangles cannot describe a future footprint accurately.
  const originRect = cellNodes[origin].getBoundingClientRect();
  const gridStyle = window.getComputedStyle(el.board);
  const columnGap = parseFloat(gridStyle.columnGap) || 0;
  const rowGap = parseFloat(gridStyle.rowGap) || 0;
  const points = [{ at: origin, kind: state.stock[0] }].concat(forecast).map(function (step) {
    const side = bigSide(step.kind);
    const width = originRect.width * side + columnGap * (side - 1);
    const height = originRect.height * side + rowGap * (side - 1);
    const left = originRect.left - frame.left + (step.at % SIZE - origin % SIZE) * (originRect.width + columnGap);
    const top = originRect.top - frame.top + (Math.floor(step.at / SIZE) - Math.floor(origin / SIZE)) * (originRect.height + rowGap);
    return { x: left + width / 2, y: top + height / 2, width: width, height: height };
  });
  if (lastSide > 1) {
    const p = points[points.length - 1];
    svg.appendChild(svgNode('rect', {
      class: 'merge-path-footprint', x: p.x - p.width / 2 + 1.5, y: p.y - p.height / 2 + 1.5,
      width: p.width - 3, height: p.height - 3, rx: '8',
      fill: 'rgba(255, 210, 120, .12)', stroke: 'currentColor', 'stroke-width': '3'
    }));
  }
  for (let n = 1; n < points.length; n++) {
    const from = points[n - 1], to = points[n];
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.01) continue;
    const inset = Math.min(14, length / 4);
    svg.appendChild(svgNode('path', {
      class: 'merge-path-line',
      d: 'M ' + (from.x + dx / length * inset) + ' ' + (from.y + dy / length * inset)
        + ' L ' + (to.x - dx / length * inset) + ' ' + (to.y - dy / length * inset),
      fill: 'none', stroke: 'currentColor', 'stroke-width': '3',
      'stroke-linecap': 'round', 'marker-end': 'url(#mergePreviewArrow)'
    }));
  }
  for (let n = 1; n < points.length; n++) {
    const p = points[n];
    const group = svgNode('g', { class: 'merge-path-step', transform: 'translate(' + (p.x + p.width / 2 - 11) + ' ' + (p.y - p.height / 2 + 11) + ')' });
    group.appendChild(svgNode('circle', { r: '9', fill: 'currentColor' }));
    const number = svgNode('text', { x: '0', y: '0', 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-size': '11', 'font-weight': '700' });
    number.textContent = String(n);
    group.appendChild(number);
    svg.appendChild(group);
  }
  el.previewLayer.appendChild(svg);
}

function tileArt(kind) {
  // plants and bones are the inline symbols; animals get a canvas,
  // unless the art never loaded
  const useSvg = !isAnimal(kind) || !spritesReady || !spritesFor[kind];
  if (useSvg) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'tile-art');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#art' + kind[0].toUpperCase() + kind.slice(1));
    svg.appendChild(use);
    return svg;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'tile-art tile-art--paint';
  canvas.dataset.animal = kind;
  return canvas;
}

// Fills a `.tile` span with the art for `kind` (or empties it).
function paintTile(node, kind, fed) {
  node.textContent = '';
  node.className = node.className.replace(/ ?tile--\w+-art/g, '');
  if (!kind) return;
  node.classList.add('tile--' + kind + '-art');
  const art = tileArt(kind);
  node.appendChild(art);
  if (art.tagName === 'CANVAS') {
    // the canvas needs its laid-out size, which only exists after paint
    requestAnimationFrame(function () { paintAnimal(art, kind, fed == null ? 1 : fed); });
  }
}

// A square sits where its index says, and covers `side` of them when a
// big tile is standing on it.
function setSpan(node, i, side) {
  const span = side > 1 ? ' / span ' + side : '';
  node.style.gridColumn = ((i % SIZE) + 1) + span;
  node.style.gridRow = (((i / SIZE) | 0) + 1) + span;
}

function buildBoard() {
  el.board.textContent = '';
  cellNodes = [];
  for (let i = 0; i < CELLS; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell';
    btn.dataset.i = String(i);
    // Every square is placed explicitly. Left to flow, hiding the three
    // squares under an elephant would shuffle the whole rest of the
    // meadow up one place.
    setSpan(btn, i, 1);
    el.board.appendChild(btn);
    cellNodes.push(btn);
  }
}

const KIND_LABEL = Object.assign(Object.fromEntries(LADDER.map(k => [k,k])), { bones:'bones, blocked', scrub:'scrub, blocked', stone:'stone, blocked' });

const VITAL_WORD = Object.fromEntries(Object.keys(ANIMALS).map(k => [k, ['starving','hungry','fed']]));
const PLANT_WORD = ['going to seed', 'past its best', 'fresh'];

// Is the raised mark worth showing? Only from the tiger on, when the
// elephant is the next thing the ladder can reach.
function showRaised() { return rank(state.topKind) >= rank('tiger'); }

// Squares a starving animal will take on the coming turn. Animals only
// eat in the red, so this is rare and means something when it shows: a
// mouth beside this tile is one turn from dying and is going to take it.
// A marked square is not doomed — growth resolves before anyone eats, so
// a tile that completes a merge still gets away.
function inReach() {
  const risk = new Set();
  for (let i = 0; i < CELLS; i++) {
    const c = state.cells[i];
    if (!c || !isAnimal(c.kind) || isShadow(state.cells, i)) continue;
    const cfg = ANIMALS[c.kind];
    if (c.clock + 1 < cfg.eatAt) continue;
    for (const n of tileNeighbours(state.cells, i)) {
      const p = state.cells[n];
      if (p && cfg.diet.indexOf(p.kind) >= 0 && edible(cfg, p, p.kind)) risk.add(n);
    }
  }
  return risk;
}

// render() rebuilds every tile, and a new element starts its CSS
// animation from the first frame -- so every tick (1.8s) cut each idle
// loop (2.6-8s) off before it got anywhere, and the animals looked
// frozen. Pinning the endless loops to the page clock lets a redrawn
// animal carry on mid-breath. One-shot arrivals are left alone.
function keepIdlePhase() {
  for (const art of el.board.querySelectorAll('.cell .tile-art')) {
    if (!art.getAnimations) return;
    for (const anim of art.getAnimations()) {
      if (anim.effect && anim.effect.getTiming().iterations === Infinity) anim.startTime = 0;
    }
  }
}

function render(grew, meals, deaths) {
  const risk = inReach();
  // at -> which rung landed there, so the square's flash can wait for the
  // ghosts that caused it instead of going off before they arrive.
  const popped = new Map((grew || []).map(function (g, n) { return [g.at, n]; }));
  const eaten = new Set((meals || []).map(function (m) { return m.ate; }));
  const died = new Set((deaths || []).map(function (d) { return d.at; }));

  for (let i = 0; i < CELLS; i++) {
    const node = cellNodes[i];
    const cell = state.cells[i];
    node.className = 'cell';
    node.textContent = '';
    node.style.animationDelay = '';
    node.removeAttribute('title');
    delete node.dataset.previewKind;
    delete node.dataset.previewMerges;
    delete node.dataset.previewDestination;
    delete node.dataset.previewSide;
    node.disabled = state.over || state.paused || !!cell;

    // The three squares a big tile leans on draw nothing: its home
    // square is stretched over them instead.
    if (isShadow(state.cells, i)) { node.hidden = true; continue; }
    node.hidden = false;
    const side = cell && cell.big != null ? bigSide(cell.kind) : 1;
    setSpan(node, i, side);

    if (!cell) {
      const forecast = previewGrowth(i);
      let label = 'Empty square, row ' + (((i / SIZE) | 0) + 1) + ' column ' + ((i % SIZE) + 1);
      if (forecast.length) {
        const last = forecast[forecast.length - 1];
        node.classList.add('cell--merge-ready');
        const badge = document.createElement('span');
        badge.className = 'merge-preview';
        const result = document.createElement('span');
        result.className = 'merge-preview-art tile';
        paintTile(result, last.kind);
        badge.appendChild(result);
        const resultLabel = document.createElement('span');
        resultLabel.className = 'merge-preview-label';
        resultLabel.textContent = '→ ' + kindName(last.kind);
        badge.appendChild(resultLabel);
        if (forecast.length > 1) {
          const count = document.createElement('span');
          count.className = 'merge-preview-count';
          count.textContent = '×' + forecast.length;
          badge.appendChild(count);
        }
        node.appendChild(badge);
        node.dataset.previewKind = last.kind;
        node.dataset.previewMerges = String(forecast.length);
        node.dataset.previewDestination = String(last.at);
        node.dataset.previewSide = String(bigSide(last.kind));
        label += '. ' + forecast.length + ' growths, ' + last.kind + ' at row ' + (Math.floor(last.at / SIZE) + 1) + ' column ' + (last.at % SIZE + 1);
        if (bigSide(last.kind) > 1) label += ', occupies ' + bigSide(last.kind) + ' by ' + bigSide(last.kind) + ' squares';
        node.title = label;
      }
      node.setAttribute('aria-label', label);
      if (eaten.has(i)) node.classList.add('cell--eaten');
      continue;
    }

    node.classList.add('cell--taken', 'cell--' + cell.kind);
    if (side > 1) node.classList.add('cell--big');

    const art = tileArt(cell.kind);
    node.appendChild(art);

    let label = KIND_LABEL[cell.kind];
    if (side > 1) label += ', standing on ' + side + ' by ' + side + ' squares';

    // Which animals are elephant food. Hidden until the tiger is
    // discovered, because before that the mark answers a question
    // nothing on the board has asked yet — and a badge on half the tiles
    // from turn one is noise.
    if (showRaised() && isAnimal(cell.kind) && cell.kind !== 'elephant' && isRaised(cell)) {
      node.classList.add('cell--raised');
      label += ', raised';
    }

    // Everything alive carries the same meter, because everything alive
    // is on the same kind of clock. No numbers on it — the bar and the
    // word are what the player is meant to read.
    if (isAnimal(cell.kind) || isPlant(cell.kind)) {
      const left = vitality(cell);
      const meter = document.createElement('span');
      meter.className = 'meter';
      const fill = document.createElement('span');
      fill.className = 'meter-fill';
      fill.style.width = Math.round(left * 100) + '%';
      if (left <= 0.34) fill.classList.add('is-low');
      else if (left <= 0.67) fill.classList.add('is-mid');
      meter.appendChild(fill);
      node.appendChild(meter);

      const words = VITAL_WORD[cell.kind] || PLANT_WORD;
      label += ', ' + (left <= 0.34 ? words[0] : left <= 0.67 ? words[1] : words[2]);

      if (art.tagName === 'CANVAS') {
        requestAnimationFrame(function () { paintAnimal(art, cell.kind, left); });
      }
      if (left <= 0.34) node.classList.add('cell--fading');
    }
    if (risk.has(i)) {
      node.classList.add('cell--inreach');
      label += ', about to be eaten';
    }
    node.setAttribute('aria-label', label);

    if (popped.has(i)) {
      node.classList.add('cell--grew');
      const wait = chainStepAt(popped.get(i)) + 'ms';
      node.style.animationDelay = wait;
      // Bear and buffalo have their own arrival animation on the art, and
      // it is the same event as the flash, so it waits with it.
      const art = node.querySelector('.tile-art');
      if (art) art.style.animationDelay = wait;
    }
    if (died.has(i)) node.classList.add('cell--died');
  }

  renderHand();
  renderGrowth();
  renderSeason();
  el.goal.textContent = nextGoal();
  const shown = displayScore(state.score);
  el.scoreValue.textContent = shown.toLocaleString();
  el.bestValue.textContent = displayScore(state.best).toLocaleString();
  if (el.startBest) el.startBest.textContent = displayScore(state.best).toLocaleString();
  renderLevel(shown);
  el.board.classList.toggle('board--spent', !state.stock.length && !state.over);
  el.pauseNote.hidden = !state.paused || state.over;
  renderMovePreview();
  keepIdlePhase();
}

// The rung, and how far along it. The bar is the whole difficulty curve
// made visible: it fills in a few turns on Bare ground and crawls on
// Wilderness, because the rungs are equal in shown points and nothing
// else. sim.js has no DOM, so this returns on a missing node.
function renderLevel(shown) {
  if (!el.level) return;
  const lv = levelAt(shown);
  el.level.dataset.level = String(lv.level);
  el.levelNum.textContent = 'Lv ' + lv.level;
  el.levelName.textContent = lv.name;
  el.levelFill.style.width = (lv.pct * 100).toFixed(1) + '%';
  el.levelNext.textContent = lv.top
    ? (SCORE_CAP - shown).toLocaleString() + ' to the horizon'
    : (lv.to - shown).toLocaleString() + ' to ' + lv.next;
  el.level.setAttribute('aria-label',
    'Level ' + lv.level + ', ' + lv.name + '. ' + el.levelNext.textContent + '.');
}

function setTicker(text) { el.ticker.textContent = text; }

// ---------- The effects layer ----------
//
// Everything here is decoration and none of it is state. It lives in its
// own absolutely-positioned layer over the board rather than inside the
// cells, because render() rebuilds every cell from scratch and a pop
// that outlives its cell would be wiped halfway through by the next
// tick. Measured against the frame with getBoundingClientRect so it does
// not care how the board is laid out or what size the screen is.
//
// sim.js has no DOM, so every entry point here returns on a missing
// layer rather than being stubbed out one by one.

// The corner of a square and the size of one, in page coordinates.
//
// The three squares under an elephant are `hidden`, and a hidden element
// measures zero - a ghost leaving one would fly out of the top-left corner
// of the meadow. So when a square cannot be measured, its place is worked
// out from the grid: the pitch between two squares that CAN be measured is
// the pitch everywhere, because the board is one CSS grid.
function cellBox(i) {
  if (!cellNodes[i]) return null;
  const own = cellNodes[i].getBoundingClientRect();
  if (own.width) return { x: own.left, y: own.top, w: own.width, h: own.height };

  const plain = [];
  for (let k = 0; k < CELLS; k++) {
    const n = cellNodes[k];
    if (!n || n.hidden || n.classList.contains('cell--big')) continue;
    const r = n.getBoundingClientRect();
    if (r.width) plain.push({ at: k, r: r });
  }
  if (!plain.length) return null;

  const col = i % SIZE, row = (i / SIZE) | 0;
  const w = plain[0].r.width, h = plain[0].r.height;
  const sorted = function (key) {
    return plain.slice().sort(function (a, b) { return a.r[key] - b.r[key]; });
  };
  const xs = sorted('left'), ys = sorted('top');
  const lo = xs[0], hi = xs[xs.length - 1];
  const top = ys[0], bot = ys[ys.length - 1];
  const dc = (hi.at % SIZE) - (lo.at % SIZE);
  const dr = ((bot.at / SIZE) | 0) - ((top.at / SIZE) | 0);
  const pitchX = dc ? (hi.r.left - lo.r.left) / dc : w;
  const pitchY = dr ? (bot.r.top - top.r.top) / dr : h;
  return {
    x: lo.r.left + (col - (lo.at % SIZE)) * pitchX,
    y: top.r.top + (row - (((top.at / SIZE) | 0))) * pitchY,
    w: w, h: h
  };
}

function fxAt(i) {
  const c = cellBox(i);
  if (!c) return null;
  const f = el.fx.getBoundingClientRect();
  return { x: c.x - f.left + c.w / 2, y: c.y - f.top + c.h / 2, w: c.w, h: c.h };
}

function fxAdd(node, life) {
  el.fx.appendChild(node);
  setTimeout(function () { node.remove(); }, life);
}

function clearFx() {
  if (!el.fx) return;
  el.fx.textContent = '';
}

// The number that was missing. It leaves from the square that earned it,
// so the score and the move that made it are the same event rather than
// a tally that moves on its own in the corner.
function popScore(i, amount, kind) {
  if (!el.fx || !amount) return;
  const at = fxAt(i);
  if (!at) return;
  const pop = document.createElement('span');
  pop.className = 'pop pop--' + kind;
  pop.textContent = '+' + Math.round(amount).toLocaleString();
  pop.style.left = at.x + 'px';
  pop.style.top = at.y + 'px';
  fxAdd(pop, 1100);
}

// A chain is the one thing in the game that is purely a good decision —
// luck deals the tile, but only the player picks the square that makes
// it land twice. So it gets said out loud.
function showChain(steps) {
  if (!el.fx) return;
  // One badge at a time. The next rung replaces this one 145ms later, so
  // the number counts up in place instead of three badges stacking in the
  // same spot and reading as a smear.
  for (const old of el.fx.querySelectorAll('.fx-chain')) old.remove();
  const tag = document.createElement('span');
  tag.className = 'fx-chain';
  tag.textContent = 'Chain ×' + steps;
  fxAdd(tag, 1200);
}

// ---------- Replaying the chain ----------
//
// The board is finished before any of this runs. growFrom resolved every
// rung and render() has already drawn the result, so a tap is accepted at
// every moment of the replay and nothing here can be waited on. This is a
// story told over a settled board, which is the only way to stage a chain
// without making the player stand still for it.
//
// The timing is not a free choice. audio-synth.js already plays one pop
// per rung, the first at +105ms and the rest every 145ms, so the picture
// is fitted to the sound rather than the other way round. Changing either
// number here means changing effect('merge') with it.
const CHAIN_LEAD_MS = 105;
const CHAIN_STEP_MS = 145;
const GHOST_MS = 300;
const RING_MS = 500;

function chainStepAt(n) { return CHAIN_LEAD_MS + n * CHAIN_STEP_MS; }

let chainTimers = [];

// A second placement during a replay cancels the first. Two chains
// telling their stories over one board reads as neither, and the player
// who taps fast is exactly the player who did not want to watch.
function cancelChain() {
  for (const t of chainTimers) clearTimeout(t);
  chainTimers = [];
  if (!el.fx) return;
  for (const n of el.fx.querySelectorAll('.ghost, .ring')) n.remove();
}

// The tiles that are gone, shown going. A ghost leaves the square it
// stood on and is swallowed by the square that kept the result, which
// answers "where did my two foxes go" by watching rather than by reading
// the ticker. It is drawn in the same 92% x 82% box the art has inside a
// square, so it is the tile that was there and not another drawing of it.
function ghostInto(from, to, kind) {
  const a = fxAt(from), b = fxAt(to);
  if (!a || !b) return;
  const ghost = document.createElement('span');
  ghost.className = 'ghost';
  ghost.style.left = a.x + 'px';
  ghost.style.top = a.y + 'px';
  ghost.style.width = (a.w * 0.92) + 'px';
  ghost.style.height = (a.h * 0.82) + 'px';
  ghost.style.setProperty('--dx', (b.x - a.x) + 'px');
  ghost.style.setProperty('--dy', (b.y - a.y) + 'px');
  ghost.style.animationDuration = GHOST_MS + 'ms';
  fxAdd(ghost, GHOST_MS + 60);
  paintTile(ghost, kind, 1);
}

// Where it landed. Sized to the square that kept the result, so an
// elephant's ring is twice the size of a rabbit's without a word
// anywhere saying that it is bigger.
function ringAt(i) {
  const at = fxAt(i);
  if (!at) return;
  const ring = document.createElement('span');
  ring.className = 'ring';
  ring.style.left = at.x + 'px';
  ring.style.top = at.y + 'px';
  ring.style.width = at.w + 'px';
  ring.style.height = at.h + 'px';
  ring.style.animationDuration = RING_MS + 'ms';
  fxAdd(ring, RING_MS + 40);
}

// `before` is the raw score as it stood before the chain was paid. Each
// rung carries its own share, so walking the raw total upward gives every
// rung the display points the bar actually moved by at that moment - and
// because the shares add up to the total, the pops add up to the number
// in the ticker. Late in a run the same rung pays less, and this is where
// that becomes visible.
function replayChain(grew, before) {
  if (!el.fx) return;
  cancelChain();
  // Motion is the whole point of a ghost, so when motion is unwelcome the
  // rungs still arrive one at a time and still say what they paid - they
  // just do not travel.
  const still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let raw = before, shown = displayScore(before);
  for (let n = 0; n < grew.length; n++) {
    const step = grew[n];
    raw += step.points || 0;
    const next = displayScore(raw);
    const gain = Math.round(next - shown);
    shown = next;
    chainTimers.push(setTimeout(function () {
      if (!still) {
        for (const g of step.from) if (g !== step.at) ghostInto(g, step.at, step.was);
        ringAt(step.at);
      }
      if (gain >= 1) popScore(step.at, gain, step.kind);
      if (n > 0) showChain(n + 1);
    }, chainStepAt(n)));
  }
}

// The first rabbit, the first fox, the first wolf. These are the beats
// the run is actually about, and before this they arrived as one more
// line in the ticker — the same weight as a sprout withering.
//
// Once per kind, ever: a thing that happens every time is wallpaper,
// and the point of a milestone is that it does not.
const FIRST_LINE = Object.fromEntries(LADDER.slice(2).map(k => [k, k === 'elephant' ? 'Your elephant has arrived!' : 'Welcome, ' + k + '!']));
const FIRST_NOTE = Object.fromEntries(LADDER.slice(2).map(function (k) {
  if (!GROWS_INTO[k]) return [k, 'It stands on four squares and flattens what it lands on. All ten animals raised from plants!'];
  return [k, 'Two together bring a ' + GROWS_INTO[k] + '. Every animal grows from plants.'];
}));

function announceFirsts(grew) {
  if (!el.fx || state.over) return;
  let fresh = false;
  for (const g of grew) {
    if (!FIRST_LINE[g.kind] || state.seen[g.kind]) continue;
    state.seen[g.kind] = true;
    // Already welcomed on an earlier run. The discovery still counts; it
    // just does not stop the board to say so again.
    if (met.has(g.kind)) continue;
    met.add(g.kind);
    fresh = true;

    const card = document.createElement('div');
    card.className = 'first first--' + g.kind;
    const art = tileArt(g.kind);
    art.classList.add('first-art');
    card.appendChild(art);
    if (art.tagName === 'CANVAS') {
      requestAnimationFrame(function () { paintAnimal(art, g.kind, 1); });
    }
    const name = document.createElement('strong');
    name.textContent = FIRST_LINE[g.kind];
    card.appendChild(name);
    const note = document.createElement('span');
    note.textContent = FIRST_NOTE[g.kind];
    card.appendChild(note);
    fxAdd(card, g.kind === 'elephant' ? 4500 : 2200);
  }
  if (fresh) writeMet();
}

// The hand is HAND_MAX slots, filled oldest-first, with the empty ones
// left visible. Seeing the gaps is what tells you whether you can answer
// a crisis right now, and how much of one — a number would say the same
// thing and be read half as fast.
function renderGrowth() {
  if (!el.growthCurrentTile) return;
  const top = state.topKind;
  const next = GROWS_INTO[top];
  const summary = el.growthCurrentTile.closest('.growth-summary');
  if (summary) summary.classList.toggle('is-complete', !next);
  paintTile(el.growthCurrentTile, top);
  if (el.growthCurrentName) el.growthCurrentName.textContent = kindName(top);
  if (el.growthNextTile) {
    el.growthNextTile.hidden = !next;
    paintTile(el.growthNextTile, next || null);
  }
  if (el.growthNextLabel) el.growthNextLabel.textContent = next ? 'Grow next' : 'All raised';
  if (el.growthNextName) el.growthNextName.textContent = next ? kindName(next) : 'Complete!';
  if (el.growthFinalTile) paintTile(el.growthFinalTile, 'elephant');
  if (el.growthProgress) el.growthProgress.textContent = Math.max(0, rank(top) - 1) + '/10 animals';
  if (!el.growthTrack) return;
  for (const node of el.growthTrack.querySelectorAll('.chain-step')) {
    const art = node.querySelector('[data-art]');
    const kind = node.dataset.kind || (art && art.dataset.art);
    if (!kind) continue;
    const paintVersion = spritesReady ? 'ready' : 'fallback';
    if (art && art.dataset.paintVersion !== paintVersion) {
      paintTile(art, kind);
      art.dataset.paintVersion = paintVersion;
    }
    node.classList.toggle('is-reached', rank(kind) <= rank(top));
    node.classList.toggle('is-current', kind === top);
    node.classList.toggle('is-next', kind === next);
    node.setAttribute('aria-label', kindName(kind) + (kind === top ? ', highest reached' : kind === next ? ', next discovery' : rank(kind) < rank(top) ? ', reached' : ', undiscovered'));
  }
}

function renderHand() {
  for (let n = 0; n < HAND_MAX; n++) {
    const slot = el.handSlots[n];
    const kind = state.stock[n];
    slot.classList.toggle('is-empty', !kind);
    paintTile(slot, kind || null);
    const piece = slot.closest('.hand-piece');
    if (piece) {
      piece.classList.toggle('is-now', n === 0);
      piece.classList.toggle('is-empty', !kind);
      const name = piece.querySelector('.hand-kind-name');
      if (name) name.textContent = kindName(kind);
      piece.setAttribute('aria-label', (n === 0 ? 'Place now: ' : 'Next ' + n + ': ') + kindName(kind));
    }
  }
  paintTile(el.nextTile, state.next);
  if (el.nextKindName) el.nextKindName.textContent = kindName(state.next);

  const left = refillProgress();
  el.refillFill.style.width = Math.round(left * 100) + '%';
  // A word, not seconds. The number would be a tuning constant on screen
  // and would go stale the moment the tick rate changed.
  const full = state.stock.length >= HAND_MAX;
  el.refillWord.textContent = full ? 'Ready — no waiting'
    : state.stock.length ? 'Growing' : 'Next tile coming';
  el.hand.setAttribute('aria-label',
    'Hand: ' + state.stock.length + ' of ' + HAND_MAX + ' tiles'
    + (state.stock.length ? ' — ' + state.stock.join(', ') : ' — empty'));
}

function renderSeason() {
  const stage = difficultyStage();
  const finalStage = stage >= DIFFICULTY_STAGES - 1;
  el.seasonBar.dataset.season = String(season());
  el.seasonName.textContent = seasonLabel();
  el.seasonNote.textContent = SEASON_NOTES[season()];
  el.seasonMult.textContent = 'Points ×' + scoreMultiplier();
  el.seasonMult.title = 'Multiplier for growth and meals, before the score scale';
  el.seasonNext.textContent = finalStage ? 'Maximum pressure · keep growing'
    : 'Next challenge in ' + nextDifficultySeconds() + 's · Points ×' + (scoreMultiplier() + SCORE_PER_SEASON);
  el.seasonNext.title = 'Time advances only while the meadow is running';
  const within = finalStage ? 1 : (state.ticks % SEASON_LENGTH) / SEASON_LENGTH;
  el.seasonFill.style.width = Math.round(within * 100) + '%';
}

function countKind(kind) {
  let n = 0;
  for (let i = 0; i < CELLS; i++) {
    const c = state.cells[i];
    if (c && c.kind === kind && !isShadow(state.cells, i)) n += 1;
  }
  return n;
}

// One line saying what the board is one step away from. The rules are all
// in the guide, but nobody reads a guide while playing, and a player who
// cannot see the next rung does not know the ladder is there at all.
// Is an animal of this kind within two turns of its red bar with nothing
// it eats beside it? Returns its square, or -1.
function goingHungry(kind) {
  const cfg = ANIMALS[kind];
  for (let i = 0; i < CELLS; i++) {
    const c = state.cells[i];
    if (!c || c.kind !== kind || c.clock < cfg.eatAt - 2) continue;
    if (isShadow(state.cells, i)) continue;
    if (!pickMeal(i, cfg)) return i;
  }
  return -1;
}

// Is an elephant standing beside an animal it would have eaten if only
// the player had built it? That is the difference between "you are out
// of food" and "that is the wrong food", and they need different advice.
function nearElephant() {
  const cfg = ANIMALS.elephant;
  for (let i = 0; i < CELLS; i++) {
    const c = state.cells[i];
    if (!c || c.kind !== 'elephant' || isShadow(state.cells, i)) continue;
    for (const n of tileNeighbours(state.cells, i)) {
      const p = state.cells[n];
      if (p && cfg.diet.indexOf(p.kind) >= 0 && !isRaised(p)) return true;
    }
  }
  return false;
}

// Animals on the board the elephant could still be fed — raised, and on
// its menu. The count is what the goal line shows once an elephant is
// out, because the number of meals left IS the elephant's clock.
function elephantLarder() {
  const cfg = ANIMALS.elephant;
  let n = 0;
  for (let i = 0; i < CELLS; i++) {
    const c = state.cells[i];
    if (c && isRaised(c) && cfg.diet.indexOf(c.kind) >= 0 && !isShadow(state.cells, i)) n += 1;
  }
  return n;
}

// Is a fox sitting beside a wolf that is about to want feeding?
function foxUnderThreat() {
  for (let i = 0; i < CELLS; i++) {
    const c = state.cells[i];
    if (!c || c.kind !== 'wolf' || c.clock < ANIMALS.wolf.eatAt - 2) continue;
    const meal = pickMeal(i, ANIMALS.wolf);
    if (meal && meal.kind === 'fox') return true;
  }
  return false;
}

function nextGoal() {
  const top = state.topKind;
  const next = GROWS_INTO[top];
  const progress = Math.max(0, LADDER.indexOf(top) - 1);

  // With an elephant out, the ladder is finished and the only question
  // left is whether it can be kept. Say how many meals are on the board
  // rather than repeating a rung that has nowhere to go.
  if (countKind('elephant')) {
    const left = elephantLarder();
    return left
      ? '10/10 · Elephant fed by raised animals only · ' + left + ' on the board.'
      : '10/10 · Nothing raised left — merge something or the elephant starves.';
  }

  // One rung short, and this is the warning that matters: the tigers you
  // are about to spend are also the elephant's first dinner.
  if (next === 'elephant') {
    return progress + '/10 animals · Two tigers grow into the elephant — keep raised animals back to feed it.';
  }

  return next ? progress + '/10 animals · Two ' + top + ' tiles grow into ' + next + '.'
    : '10/10 · Elephant reached! Keep feeding your meadow for a higher score.';
}

// ---------- Wiring ----------

// The guide opens from the title screen as well as from the board, so
// closing it must not lift the title screen's own scroll lock, and
// focus goes back to whichever button opened it.
let howOpener = null;

function openHow(opener) {
  el.howModal.hidden = false;
  document.body.classList.add('is-modal');
  howOpener = opener || el.howBtn;
  el.howClose.focus();
}

function closeHow() {
  el.howModal.hidden = true;
  if (el.startScreen.hidden) document.body.classList.remove('is-modal');
  (howOpener || el.howBtn).focus();
}

// A short "Ready?? / Go!!" beat stands between the button and the first
// move, so the meadow does not begin ticking under the player's thumb.
// The title screen lifts at once — the board is already dealt — but the
// clock stays paused, and the overlay swallows taps, until Go clears.
let counting = false;
const countTimers = [];

function playIntro() {
  el.startScreen.hidden = true;
  document.body.classList.remove('is-modal');
  counting = true;
  showWord('Ready??', '');
  if (window.BioAudio) window.BioAudio.effect('ready');
  countTimers.push(setTimeout(function () {
    showWord('Go!!', ' countdown-word--go');
    if (window.BioAudio) window.BioAudio.effect('go');
  }, 900));
  countTimers.push(setTimeout(endIntro, 1520));
}

function showWord(text, cls) {
  el.countdown.hidden = false;
  el.countdownWord.className = 'countdown-word' + cls;
  el.countdownWord.textContent = text;
}

function endIntro() {
  if (!counting) return;
  counting = false;
  for (const t of countTimers) clearTimeout(t);
  countTimers.length = 0;
  el.countdown.hidden = true;
  el.countdownWord.className = 'countdown-word';
  el.countdownWord.textContent = '';
  startRun();
}

function startRun() {
  el.startScreen.hidden = true;
  document.body.classList.remove('is-modal');
  setPaused(false);
  el.board.focus();
}

// "New game" mid-run asks once, in the button itself, rather than
// throwing a browser dialog at the player.
let armedNew = false;
let armedTimer = 0;
function onNewGame() {
  const midRun = !state.over && state.score > 0;
  if (midRun && !armedNew) {
    armedNew = true;
    el.newBtn.textContent = 'Sure? Tap again';
    el.newBtn.classList.add('btn--armed');
    clearTimeout(armedTimer);
    armedTimer = setTimeout(disarmNew, 4000);
    return;
  }
  disarmNew();
  newGame();
}

function disarmNew() {
  armedNew = false;
  clearTimeout(armedTimer);
  el.newBtn.textContent = 'New game';
  el.newBtn.classList.remove('btn--armed');
}

async function init() {
  const ids = ['board', 'hand', 'nextTile', 'refillFill', 'refillWord', 'pauseNote',
    'scoreValue', 'bestValue', 'ticker',
    'level', 'levelNum', 'levelName', 'levelNext', 'levelFill',
    'goal', 'seasonBar', 'seasonName', 'seasonNote', 'seasonMult', 'seasonFill', 'seasonNext',
    'fx', 'gameover', 'goTitle', 'goScore', 'goLevel', 'goNote', 'goAgain', 'howBtn', 'newBtn',
    'speedBtn', 'howModal', 'howClose', 'howDone', 'startScreen', 'startBtn', 'startBest',
    'startHowBtn', 'countdown', 'countdownWord',
    'nextKindName', 'growthCurrentTile', 'growthCurrentName', 'growthNextTile', 'growthNextName', 'growthNextLabel',
    'growthFinalTile', 'growthProgress', 'growthTrack', 'moveHint', 'previewLayer'];
  for (const id of ids) el[id] = document.getElementById(id);
  el.handSlots = Array.prototype.slice.call(document.querySelectorAll('.hand-tile'));

  buildBoard();

  el.board.addEventListener('click', function (e) {
    const btn = e.target.closest('.cell');
    if (!btn || btn.disabled || state.paused) return;
    if (cancelledPlacement && e.detail !== 0) { cancelledPlacement = false; return; }
    clearMovePreview();
    disarmNew();
    placeTile(Number(btn.dataset.i));
  });
  el.board.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  el.board.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    const btn = e.target.closest('.cell');
    if (btn && !btn.disabled) showMovePreview(Number(btn.dataset.i), 'mouse');
    else if (previewMode === 'mouse') clearMovePreview();
  });
  el.board.addEventListener('pointerleave', function () {
    if (previewMode === 'mouse') clearMovePreview();
  });
  el.board.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.isPrimary === false) return;
    cancelledPlacement = false;
    const btn = e.target.closest('.cell');
    if (!btn || btn.disabled) return;
    pointerGesture = { id: e.pointerId, at: Number(btn.dataset.i), x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
    showMovePreview(Number(btn.dataset.i), e.pointerType === 'mouse' ? 'mouse' : 'touch');
  });
  document.addEventListener('pointermove', function (e) {
    if (!pointerGesture || pointerGesture.id !== e.pointerId || !pointerGesture.touch) return;
    if (Math.hypot(e.clientX - pointerGesture.x, e.clientY - pointerGesture.y) > 10) {
      cancelledPlacement = true;
      clearMovePreview();
    }
  }, { passive: true });
  document.addEventListener('pointercancel', function (e) {
    if (!pointerGesture || pointerGesture.id !== e.pointerId) return;
    cancelledPlacement = true;
    pointerGesture = null;
    clearMovePreview();
  });
  document.addEventListener('pointerup', function (e) {
    if (!pointerGesture || pointerGesture.id !== e.pointerId) return;
    if (pointerGesture.touch) clearMovePreview();
    pointerGesture = null;
  });
  el.board.addEventListener('focusin', function (e) {
    const btn = e.target.closest('.cell');
    if (btn && !btn.disabled && !pointerGesture) showMovePreview(Number(btn.dataset.i), 'keyboard');
  });
  el.board.addEventListener('focusout', function () {
    if (previewMode === 'keyboard') clearMovePreview();
  });
  window.addEventListener('resize', renderMovePreview);

  el.speedBtn.addEventListener('click', function () {
    setRelaxed(!state.relaxed);
    el.speedBtn.textContent = state.relaxed ? 'Relaxed' : 'Normal';
    el.speedBtn.setAttribute('aria-pressed', String(state.relaxed));
  });

  // The guide is several screens long and the meadow must not starve
  // behind it. Same for a backgrounded tab.
  el.howBtn.addEventListener('click', function () { openHow(el.howBtn); setPaused(true); });
  // the meadow also stays still while the title screen is up
  const resume = function () {
    closeHow();
    setPaused(document.hidden || !el.startScreen.hidden || counting);
  };
  el.howClose.addEventListener('click', resume);
  el.howDone.addEventListener('click', resume);
  el.howModal.addEventListener('click', function (e) {
    if (e.target === el.howModal) resume();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !el.howModal.hidden) resume();
  });
  document.addEventListener('visibilitychange', function () {
    setPaused(document.hidden || !el.startScreen.hidden || !el.howModal.hidden || counting);
  });

  // The title screen carries the guide, so it is reachable before the
  // first tap. Sound has no switch: the device's silent mode decides.
  el.startHowBtn.addEventListener('click', function () { openHow(el.startHowBtn); setPaused(true); });

  el.newBtn.addEventListener('click', onNewGame);
  el.goAgain.addEventListener('click', function () { disarmNew(); newGame(); });

  // the little reference row under the board
  for (const node of document.querySelectorAll('.tile--mini')) {
    paintTile(node, node.dataset.art);
  }

  loadSprites();
  // The title screen owns the first pause. Keeping the state default
  // unpaused preserves the headless rules harness, which starts a game
  // directly without a browser screen.
  state.paused = true;
  newGame();
  el.startBest.textContent = displayScore(state.best).toLocaleString();
  document.body.classList.add('is-modal');
  el.startBtn.addEventListener('click', playIntro);
  el.startBtn.focus();

  try {
    scoreStore = await openStore(SLUG, 'score', { version: 1, default: { best: 0 } });
    state.best = readBest();
    render();
    if (scoreStore.subscribe) {
      scoreStore.subscribe(function () {
        const b = readBest();
        if (b > state.best) { state.best = b; render(); }
      });
    }
  } catch (e) {
    console.error('Ecosystem Puzzle: store unavailable', e);
  }

  try {
    metStore = await openStore(SLUG, 'met', { version: 1, default: { kinds: [] } });
    readMet();
    if (metStore.subscribe) metStore.subscribe(readMet);
  } catch (e) {
    console.error('Ecosystem Puzzle: met store unavailable', e);
  }
}

document.addEventListener('DOMContentLoaded', init);
