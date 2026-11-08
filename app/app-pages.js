/* The app's other pages (the field book, how to play, privacy, terms) open
 * on top of the game instead of replacing it (app/build-app.cjs adds this
 * to the app's index.html only). Leaving index.html would stop the music and
 * restart it from the first bar; on top, the opening screen keeps playing.
 * The pages borrow this page's BioAudio (audio.js), and a link back to the
 * game closes the layer. */
window.BioPages = (() => {
  'use strict';
  let layer = null, frame = null, opener = null;

  // The page sits inside the safe area (insets read 0 inside a frame); the
  // strips around it take the page's own background colour.
  const style = document.createElement('style');
  style.textContent = `
    .app-page-layer { position: fixed; inset: 0; z-index: 2147483000; background: #10150e; }
    .app-page-layer[hidden] { display: none; }
    .app-page-layer iframe { position: absolute; border: 0; display: block;
      top: env(safe-area-inset-top, 0px); bottom: env(safe-area-inset-bottom, 0px);
      left: env(safe-area-inset-left, 0px); right: env(safe-area-inset-right, 0px);
      width: calc(100% - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
      height: calc(100% - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)); }
    html.app-page-open, html.app-page-open body { overflow: hidden; }`;
  document.head.appendChild(style);

  // A local page other than the game itself.
  function pageUrl(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch { return null; }
    if (url.origin !== location.origin || !/\.html$/.test(url.pathname) || isGame(url)) return null;
    return url;
  }
  const isGame = url => url.origin === location.origin && url.pathname === new URL('index.html', location.href).pathname;

  function open(url) {
    opener = document.activeElement;
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'app-page-layer';
      frame = document.createElement('iframe');
      frame.title = 'Bioconnect';
      frame.addEventListener('load', () => {
        try {
          const doc = frame.contentDocument, view = frame.contentWindow;
          const paint = [doc.body, doc.documentElement].map(n => view.getComputedStyle(n).backgroundColor)
            .find(c => c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c));
          if (paint) layer.style.background = paint;
        } catch {}
      });
      layer.appendChild(frame);
      document.body.appendChild(layer);
    }
    frame.src = url.href;
    layer.hidden = false;
    document.documentElement.classList.add('app-page-open');
    window.BioGame?.pause?.();
    frame.focus();
  }

  function close() {
    if (!layer || layer.hidden) return;
    layer.hidden = true;
    frame.src = 'about:blank';
    document.documentElement.classList.remove('app-page-open');
    window.BioAudio?.coin?.();
    window.BioGame?.resumeIfAllowed?.();
    opener?.focus?.();
  }

  document.addEventListener('click', e => {
    const url = pageUrl(e.target.closest?.('a[href]'));
    if (!url || e.defaultPrevented) return;
    e.preventDefault();
    open(url);
  });

  return { open, close, isGame };
})();
