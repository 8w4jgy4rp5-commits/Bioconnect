// Fills the parts every concept shares, so each file only holds its staging.
// The strings are fixed text written here, never user input.
(function () {
  const SPROUT = '<svg class="sprout" viewBox="0 0 24 30" aria-hidden="true">' +
    '<path d="M12 29V13" stroke="#6f8a3e" stroke-width="4" stroke-linecap="round" fill="none"/>' +
    '<path d="M12 18c-4 0-6.4-2.8-6.8-6.6 4 .2 6.5 2.8 6.8 6.6z" fill="#a8c66c"/>' +
    '<path d="M12 16.6c.4-3.8 2.8-6.4 6.8-6.6-.4 3.8-2.8 6.6-6.8 6.6z" fill="#c2dc8a"/></svg>';
  const LEDGER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>';
  window.SPROUT = SPROUT;
  document.querySelectorAll('[data-top]').forEach(function (el) {
    el.classList.add('top');
    el.innerHTML = '<p class="kicker">A living puzzle</p><p class="pill">Best <b>0</b></p><button class="pill shop" type="button">Crystals &amp; No Ads</button>';
  });
  document.querySelectorAll('[data-logo]').forEach(function (el) {
    el.classList.add('logo');
    el.innerHTML = '<span>Bio</span><span class="l2">' + SPROUT + 'connect</span>';
  });
  document.querySelectorAll('[data-controls]').forEach(function (el) {
    el.classList.add('controls');
    const aside = el.dataset.controls ? '<p class="aside">' + el.dataset.controls + '</p>' : '';
    el.innerHTML = '<button class="play" type="button">PLAY</button>' +
      '<div class="minor"><button class="icon" type="button" aria-label="How to play">?</button>' +
      '<button class="icon" type="button" aria-label="The Ledger">' + LEDGER + '</button></div>' + aside +
      '<p class="foot">Your best score is saved in this browser.</p>';
  });
})();
