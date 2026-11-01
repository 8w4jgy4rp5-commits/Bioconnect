// `?stage=fail-01` — start a run on a staged board, for recording videos.
//
// Only `npm run stage` (test/local-server.cjs --stage) loads this file; the
// live index.html has no tag for it, so the public site cannot run it even
// with ?stage in the address. Like watch.js, it swaps a few of script.js's
// shared globals and adds no rule of its own. See dev/README.md.
//
// Keys while staged:  R = deal the staged board again   T = one world tick
//                     H = show/hide the STAGE badge
(function () {
  const param = new URLSearchParams(location.search).get('stage');
  if (!param || !window.BioStage) return;

  // The local server's purple "LOCAL SIMULATION" strip must not be in the shot.
  const hideStrip = document.createElement('style');
  hideStrip.textContent = '#localTestBanner{display:none!important}';
  document.head.appendChild(hideStrip);

  let preset = null, built = null, queue = [];
  let moves = 0, frozen = true, firstTickTimer = 0, sound = null, badge = null;

  // A staged run is not the player's: no best score, discoveries, run
  // record, visit count, and no first-time practice board in the way.
  writeBest = function () {};
  writeMet = function () {};
  recordRun = function () {};
  reportVisit = function () {};
  offerLesson = function () { return false; };

  // Deal the queue first, then fall back to the normal random deal.
  const realRoll = rollHand;
  rollHand = function () { return built && queue.length ? queue.shift() : realRoll(); };

  const realNewGame = newGame;
  newGame = function () {
    realNewGame();
    if (built) stage();
  };

  // The meadow's clock stays still until `clockAfterMoves` placements.
  const realSync = syncClock;
  syncClock = function () {
    realSync();
    if (frozen && tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
  };

  const realPlace = placeTile;
  placeTile = function (i) {
    const before = state.runStats ? state.runStats.placed : 0;
    realPlace(i);
    if (!built || !state.runStats || state.runStats.placed === before) return;
    moves += 1;
    if (frozen && typeof preset.clockAfterMoves === 'number' && moves >= preset.clockAfterMoves) startClock();
  };

  function startClock() {
    clearTimeout(firstTickTimer);
    const wait = Number(preset.firstTickMs);
    if (wait > 0) {
      // The first tick on its own beat, so the fatal bite lands when the
      // video wants it rather than up to a full tick later.
      firstTickTimer = setTimeout(function () {
        firstTickTimer = 0;
        frozen = false;
        worldTick();
        syncClock();
      }, wait);
    } else {
      frozen = false;
      syncClock();
    }
  }

  // The fatal moment: a precious (*) tile is eaten.
  const realFeed = feedEveryone;
  feedEveryone = function () {
    const precious = new Set();
    state.cells.forEach(function (c, i) { if (c && c.stagePrecious) precious.add(i); });
    const meals = realFeed();
    if (meals.some(function (m) { return precious.has(m.ate); })) fatal();
    return meals;
  };

  function fatal() {
    if (!sound) { console.warn('stage: no fatal sound file (' + (preset.fatalSound || 'none set') + ')'); return; }
    try { sound.currentTime = 0; sound.play().catch(function (e) { console.warn('stage: fatal sound did not play', e); }); } catch (e) {}
  }

  function stage() {
    clearTimeout(firstTickTimer);
    moves = 0;
    frozen = preset.clockAfterMoves !== 0;
    queue = BioStage.apply(state, built, api());
    syncClock();
    render();
    setTicker('Tap an empty square to plant. The meadow moves on its own.');
  }

  function api() {
    return { SIZE: SIZE, CELLS: CELLS, ANIMALS: ANIMALS, PLANTS: PLANTS, BLOCKERS: BLOCKERS, HAND_MAX: HAND_MAX,
      makeTile: makeTile, bigSide: bigSide, blockAt: blockAt, rank: rank, rollHand: realRoll };
  }

  function showBadge(text, bad) {
    if (!badge) {
      badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;padding:4px 8px;border-radius:6px;font:12px/1.4 monospace;color:#fff;pointer-events:none';
      document.body.appendChild(badge);
    }
    badge.textContent = text;
    badge.style.background = bad ? '#b00020' : 'rgba(0,0,0,.6)';
    badge.hidden = false;
    // Out of the way before recording starts; H brings it back.
    if (!bad) setTimeout(function () { badge.hidden = true; }, 3000);
  }

  document.addEventListener('keydown', function (e) {
    if (!built || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r') newGame();
    else if (k === 't') { const was = state.paused; state.paused = false; worldTick(); state.paused = was; }
    else if (k === 'h' && badge) badge.hidden = !badge.hidden;
  });

  function load() {
    if (param.trim().charAt(0) === '{') return Promise.resolve(JSON.parse(param));
    if (!/^[a-z0-9_-]+$/i.test(param)) return Promise.reject(new Error('preset names are letters, digits, - and _'));
    return fetch('dev/stages/' + param + '.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('no preset dev/stages/' + param + '.json');
      return r.json();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    load().then(function (p) {
      preset = p;
      built = BioStage.build(p, api());
      if (p.fatalSound) {
        sound = new Audio(p.fatalSound);
        sound.preload = 'auto';
        sound.addEventListener('error', function () { sound = null; console.warn('stage: could not load ' + p.fatalSound); });
      }
      newGame();
      showBadge('STAGE ' + (p.name || param) + ' · R reset · T tick · H badge');
    }).catch(function (e) {
      console.error('stage:', e);
      showBadge('STAGE ERROR: ' + e.message, true);
    });
  });
})();
