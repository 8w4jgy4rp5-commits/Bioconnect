/* Share on X in the app (app/build-app.cjs adds this to the app only).
 * The website opens X's post box and puts the result card on the clipboard.
 * In the app, the iPhone share sheet takes the card itself, so choosing X
 * opens a post with the picture (the board at its fullest and the score)
 * already attached. */
window.BioShare = (() => {
  'use strict';
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.() || typeof cap.nativePromise !== 'function') return null;
  const call = (plugin, method, options) => cap.nativePromise(plugin, method, options);

  const base64 = blob => new Promise((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result).split(',')[1]);
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(blob);
  });

  return async function share(text, picture) {
    const files = [];
    if (picture) {
      try {
        const { uri } = await call('Filesystem', 'writeFile',
          { path: 'bioconnect-result.png', data: await base64(picture), directory: 'CACHE' });
        files.push(uri);
      } catch {}
    }
    try { await call('Share', 'share', files.length ? { text, files } : { text }); }
    catch (err) { if (!/cancel/i.test(String(err?.message || err))) throw err; }
  };
})();
