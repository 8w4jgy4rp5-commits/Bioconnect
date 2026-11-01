// Recording-only board staging: turns a preset (dev/stages/*.json) into
// cells, a hand and a deal queue. Shared by dev/stage.js (the browser) and
// dev/check-stages.cjs (node). Not part of the game: the live index.html
// never loads it; only `npm run stage` injects it.
//
// `api` is the handful of script.js names this needs, passed in so the
// same file works in the page and in sim.js's sandbox.
(function (root) {
  const SHORT = { '.': null, '_': null };

  // "lion*" = precious (its loss plays the fatal sound)
  // "tiger!" = hungry: eats on the very first tick the clock runs
  // "fox~"   = wild (as if dealt from the hand). Animals default to raised,
  //            plants and blockers are always wild.
  function parseToken(token) {
    const m = /^([a-z]+)([*!~]*)$/.exec(token);
    if (!m) throw new Error('bad square "' + token + '"');
    return { kind: m[1], precious: m[2].includes('*'), hungry: m[2].includes('!'), wild: m[2].includes('~') };
  }

  function build(preset, api) {
    const { SIZE, CELLS, ANIMALS, PLANTS, BLOCKERS, makeTile, bigSide, blockAt } = api;
    const known = function (k) { return !!ANIMALS[k] || !!PLANTS[k] || BLOCKERS.indexOf(k) >= 0; };
    const cells = new Array(CELLS).fill(null);
    const precious = [];
    const list = [];

    if (preset.board) {
      if (preset.board.length !== SIZE) throw new Error('board needs ' + SIZE + ' rows');
      preset.board.forEach(function (line, r) {
        const tokens = line.trim().split(/\s+/);
        if (tokens.length !== SIZE) throw new Error('row ' + (r + 1) + ' needs ' + SIZE + ' squares, has ' + tokens.length);
        tokens.forEach(function (t, c) {
          if (t in SHORT) return;
          list.push(Object.assign(parseToken(t), { row: r + 1, col: c + 1 }));
        });
      });
    }
    for (const p of preset.pieces || []) {
      list.push({ kind: p.animal || p.kind, row: p.row, col: p.col,
        precious: !!p.precious, hungry: !!p.hungry, wild: !!p.wild, hunger: p.hunger });
    }

    for (const p of list) {
      if (!known(p.kind)) throw new Error('unknown kind "' + p.kind + '"');
      if (!(p.row >= 1 && p.row <= SIZE && p.col >= 1 && p.col <= SIZE)) throw new Error(p.kind + ': row/col must be 1-' + SIZE);
      const at = (p.row - 1) * SIZE + (p.col - 1);
      const animal = !!ANIMALS[p.kind];
      const tile = makeTile(p.kind, animal && !p.wild ? 'raised' : 'wild');
      if (p.hungry) {
        if (!animal) throw new Error(p.kind + ' cannot be hungry');
        tile.clock = ANIMALS[p.kind].eatAt - 1;
      } else if (typeof p.hunger === 'number') tile.clock = p.hunger;
      const side = bigSide(p.kind);
      const block = side > 1 ? blockAt(at, side) : [at];
      if (side > 1 && ((at % SIZE) + side > SIZE || ((at / SIZE) | 0) + side > SIZE)) throw new Error(p.kind + ' does not fit at row ' + p.row + ' col ' + p.col);
      if (side > 1) tile.big = at;
      for (const b of block) {
        if (cells[b]) throw new Error('two tiles on row ' + (((b / SIZE) | 0) + 1) + ' col ' + (b % SIZE + 1));
        cells[b] = tile;
      }
      if (p.precious) { tile.stagePrecious = true; precious.push(at); }
    }

    const deal = (preset.hand || []).concat(preset.then || preset.nextQueue || []);
    for (const k of deal) if (!known(k) || BLOCKERS.indexOf(k) >= 0) throw new Error('cannot deal "' + k + '"');
    return { cells: cells, deal: deal, precious: precious };
  }

  // Apply a built stage to the live state. The first three dealt tiles are
  // the hand (left to right), the fourth is "next", the rest follow in order.
  function apply(state, built, api) {
    const queue = built.deal.slice();
    state.cells = built.cells.map(function (c) { return c; });
    state.stock = [];
    while (state.stock.length < api.HAND_MAX) state.stock.push(queue.length ? queue.shift() : api.rollHand());
    state.next = queue.length ? queue.shift() : api.rollHand();
    state.refill = 0;
    state.ticks = 0;
    let top = 'sprout';
    for (const c of state.cells) if (c && api.rank(c.kind) > api.rank(top) && api.ANIMALS[c.kind]) top = c.kind;
    state.topKind = top;
    return queue;
  }

  // "r1c1" / [1, 1] -> square index
  function square(where, SIZE) {
    const rc = Array.isArray(where) ? where : (/^r(\d)c(\d)$/i.exec(where) || []).slice(1).map(Number);
    if (rc.length !== 2) throw new Error('bad square ' + JSON.stringify(where));
    return (rc[0] - 1) * SIZE + (rc[1] - 1);
  }

  const api = { build: build, apply: apply, square: square, parseToken: parseToken };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BioStage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
