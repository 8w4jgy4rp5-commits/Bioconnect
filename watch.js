// `index.html?watch` — watch a bot raise an elephant on the real board.
//
// watch/elephant-run.json (written by `node watch-record.js`) holds a
// seed and the bot's moves. Every roll the rules make goes through
// gameRandom(), so dealing from the same seed and making the same moves
// replays the run exactly, with the page's own animations and sounds.
// Nothing here is a rule; without `?watch` this file does nothing.
//
// script.js is a classic script, so its top-level functions and lets are
// shared globals; this file swaps a few of them for the length of a watch.
(function () {
  if (!/[?&]watch\b/.test(location.search)) return;

  const SPEEDS = [1, 2, 4];
  const PLACE_MS = 260;   // one placement at 1x
  const TICK_MS_X1 = 650; // the pause that goes with each tick at 1x
  const CELEBRATION_MS = 5200;

  // mulberry32 — the same twelve lines as watch-record.js.
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

  let run = null;
  let step = 0;
  let speed = 1;
  let timer = 0;
  let badge = null;

  // The bot drives; taps and drags must not, or the replay drifts.
  const botPlace = placeTile;
  const botTick = worldTick;
  placeTile = function () {};
  // The page's own clock stays off — each tick comes from the move list.
  const realSync = syncClock;
  syncClock = function () {
    realSync();
    if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; }
  };
  // A bot's score is not the player's best, and its discoveries are not
  // the player's either.
  writeBest = function () {};
  writeMet = function () {};

  const realStart = startRun;
  startRun = function () {
    realStart();
    begin();
  };

  function begin() {
    clearTimeout(timer);
    if (!run) { setTicker('Loading the bot’s run…'); return; }
    gameRandom = seeded(run.seed);
    newGame();
    step = 0;
    setTicker('A bot is playing. It raised its elephant on tick ' + run.elephantAt + '.');
    timer = setTimeout(next, 600);
  }

  function next() {
    timer = 0;
    if (!run || step >= run.moves.length || state.over) return finish();
    // The elephant stops the meadow for its celebration; let it play,
    // then carry on.
    if (state.celebrating) {
      timer = setTimeout(function () { closeCelebration(); next(); }, CELEBRATION_MS);
      return;
    }
    if (state.paused) { timer = setTimeout(next, 250); return; }
    const m = run.moves[step++];
    if (m < 0) botTick(); else botPlace(m);
    timer = setTimeout(next, (m < 0 ? TICK_MS_X1 : PLACE_MS) / speed);
  }

  function finish() {
    const shown = displayScore(state.score);
    if (shown !== run.score) console.warn('watch: replay drifted, got ' + shown + ', recorded ' + run.score);
  }

  function addBadge() {
    badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'watch-badge';
    badge.setAttribute('aria-label', 'Bot playing. Change replay speed');
    const paint = function () { badge.textContent = 'BOT ▶ ×' + speed; };
    paint();
    badge.addEventListener('click', function () {
      speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      paint();
    });
    document.body.appendChild(badge);
    document.body.classList.add('is-watching');
  }

  document.addEventListener('DOMContentLoaded', function () {
    addBadge();
    fetch('watch/elephant-run.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        run = data;
        // PLAY was pressed before the file arrived.
        if (el.startScreen && el.startScreen.hidden && !counting) begin();
      })
      .catch(function (e) { console.error('watch: no recorded run', e); });
  });
})();
