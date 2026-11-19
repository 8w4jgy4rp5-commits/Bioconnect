// The guide's tab bar: light the tab for the section being read, keep that
// tab in view in the bar, and glide to a section when its tab is tapped.
(() => {
  'use strict';
  const bar = document.querySelector('.toc');
  if (!bar) return;
  const tabs = [...bar.querySelectorAll('a[href^="#"]')];
  const heads = tabs.map(a => document.getElementById(a.getAttribute('href').slice(1)));
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lit = null;
  function light(tab) {
    if (tab === lit) return;
    if (lit) { lit.classList.remove('is-here'); lit.removeAttribute('aria-current'); }
    lit = tab;
    if (!tab) return;
    tab.classList.add('is-here'); tab.setAttribute('aria-current', 'true');
    const left = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
    bar.scrollTo({ left, behavior: calm ? 'auto' : 'smooth' });
  }
  function update() {
    const line = bar.getBoundingClientRect().bottom + 24;
    let here = null;
    heads.forEach((h, i) => { if (h && h.getBoundingClientRect().top <= line) here = tabs[i]; });
    // At the very bottom the last short sections can never reach the line.
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) here = tabs[tabs.length - 1];
    light(here);
  }
  tabs.forEach((tab, i) => tab.addEventListener('click', e => {
    if (!heads[i]) return;
    e.preventDefault();
    heads[i].scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', tab.getAttribute('href'));
  }));
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
