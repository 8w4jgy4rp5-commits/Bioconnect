// Cozy Eldritch, the standard look (see eldritch.css). Does nothing unless the
// head script put .skin-eldritch on <html>. Its one job: under each
// line the ticker says, a small deadpan aside — the meadow is watching,
// and it is a bit of a dork about it. The game never reads the aside.
(function () {
  if (!document.documentElement.classList.contains('skin-eldritch')) return;

  // first match wins; each list rotates so the same line is not said twice in a row
  const ASIDES = [
    [/starved/, ['(the meadow will remember this.)', '(a moment of silence. okay, done.)']],
    [/chain of/i, ['(the meadow is impressed. it won\'t say so.)', '(something under the soil applauded.)']],
    [/elephant/i, ['(it is very old. do not mention it.)', '(the ground hums.)']],
    [/joined the meadow/, ['(it has been noticed.)', '(welcome. there is no leaving.)', '(it seems nice. for now.)']],
    [/\+\d/, ['(crunch.)', '(don\'t think about it.)', '(nature is beautiful.)', '(it was a willing offering. probably.)']],
    [/scrub/, ['(it\'s fine. it\'s fine.)', '(the grass gave up. relatable.)']],
    [/stone|rock/i, ['(it wasn\'t there before.)', '(do not look at the stone.)']],
    [/Hand empty|Nothing in hand/, ['(the meadow is thinking.)', '(patience. it is coming.)']],
    [/^Planted/, ['(the soil said thank you.)', '(something underneath moved.)', '(nothing to see here.)']],
    [/Tap an empty square/, ['(it\'s watching. it means well.)']]
  ];
  const turn = new Map();

  function asideFor(text) {
    for (const [pattern, lines] of ASIDES) {
      if (!pattern.test(text)) continue;
      const n = turn.get(pattern) || 0;
      turn.set(pattern, n + 1);
      return lines[n % lines.length];
    }
    return '';
  }

  function attach(ticker) {
    const decorate = function () {
      if (ticker.querySelector('.el-aside')) return;
      const line = asideFor(ticker.textContent.trim());
      if (!line) return;
      const span = document.createElement('span');
      span.className = 'el-aside';
      span.textContent = line;
      ticker.appendChild(span);
    };
    new MutationObserver(decorate).observe(ticker, { childList: true });
    decorate();
  }

  const start = function () { const t = document.getElementById('ticker'); if (t) attach(t); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
