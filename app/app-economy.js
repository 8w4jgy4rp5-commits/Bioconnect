/* The iPhone app's store (app/build-app.cjs ships this as monetization.js).
 * The website sells through Stripe with an account; the app sells Crystals
 * through Apple instead, with no account. The balance lives on this iPhone.
 * Same outside shape as the website's BioEconomy, so script.js is unchanged. */
window.BioEconomy = (() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const game = () => window.BioGame;
  // Apple product IDs (App Store Connect) and how many Crystals each gives.
  const PACKS = { crystals5: 5, crystals11: 11, crystals30: 30, crystals65: 65 };
  const KEY = 'bioconnect:app-wallet';
  const cap = window.Capacitor;
  const native = !!cap?.isNativePlatform?.() && typeof cap.nativePromise === 'function';
  // Off the iPhone (the offline test), a stand-in store may be given; the app never has one.
  const store = native ? {
    call: (method, options = {}) => cap.nativePromise('NativePurchases', method, options),
    listen: (event, fn) => cap.addListener('NativePurchases', event, fn)
  } : window.__BIO_APP_STORE__ || null;

  let wallet = load(), prices = null, busy = false, panel = null, opener = null;

  function load() {
    try {
      const w = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (w && Number.isInteger(w.crystals) && w.crystals >= 0 && Array.isArray(w.credited)) return w;
    } catch {}
    return { crystals: 0, welcome_claimed: false, credited: [] };
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(wallet)); }
  const message = text => { for (const id of ['shopStatus', 'reviveStatus']) if ($(id)) $(id).textContent = text; };
  const notice = text => { message(text); if (panel) $('shopStatus')?.scrollIntoView({ block: 'nearest' }); };

  // Each Apple transaction adds its Crystals once, even if Apple reports it twice.
  function credit(t) {
    const amount = PACKS[t?.productIdentifier], id = String(t?.transactionId || '');
    if (!amount || !id || wallet.credited.includes(id)) return 0;
    wallet.crystals += amount * Math.max(1, Number(t.quantity) || 1);
    wallet.credited = wallet.credited.concat(id).slice(-200);
    save(); draw();
    return amount;
  }

  function isBlocking() { return busy || !!panel; }
  function draw() {
    const s = game()?.summary();
    if ($('recordList') && game()?.records) {
      $('recordList').replaceChildren();
      for (const record of game().records()) {
        const row = document.createElement('p');
        row.textContent = record.label;
        $('recordList').appendChild(row);
      }
    }
    for (const id of ['shopBtn', 'startShopBtn', 'startWallet']) if ($(id)) $(id).hidden = false;
    // No ads in the app, so nothing about No Ads, a daily revival or ads shows.
    for (const id of ['startNoAdsBtn', 'reviveDaily', 'reviveAd']) if ($(id)) $(id).hidden = true;
    if ($('shopBtn')) $('shopBtn').textContent = 'Crystals';
    if ($('shopTitle')) $('shopTitle').textContent = 'Crystals';
    if ($('startCrystalCount')) $('startCrystalCount').textContent = String(wallet.crystals);
    if ($('startCrystalBalance')) $('startCrystalBalance').setAttribute('aria-label', 'Crystals: ' + wallet.crystals);
    if ($('walletLabel')) $('walletLabel').textContent = `${wallet.crystals} Crystals`;
    if ($('claimBtn')) { $('claimBtn').hidden = wallet.welcome_claimed; $('claimBtn').disabled = busy; }
    for (const btn of document.querySelectorAll('[data-product]')) {
      const price = prices?.[btn.dataset.product];
      btn.disabled = busy || !price;
      const tag = btn.querySelector('.pack-price');
      if (tag) tag.textContent = price || '…';
      btn.setAttribute('aria-label', `${PACKS[btn.dataset.product]} Crystals, ${price || 'price unavailable'}`);
    }
    if ($('reviveCrystal')) {
      const open = s?.over && !s.revived;
      $('reviveCrystal').hidden = !open || wallet.crystals < 1;
      $('reviveFind').hidden = !open || wallet.crystals >= 1;
      $('reviveCrystal').disabled = $('reviveFind').disabled = $('goAgain').disabled = busy;
      $('reviveCrystal').querySelector('em').textContent = `1 Crystal · balance: ${wallet.crystals}`;
      if (s?.revived) $('reviveStatus').textContent = 'Revival already used in this game.';
    }
  }

  async function exclusive(action) {
    if (busy) return;
    busy = true; game()?.pause(); draw();
    try { await action(); } catch (err) { notice(err.message || 'Something went wrong. Please retry.'); }
    finally { busy = false; draw(); }
  }

  // Prices come from Apple, in the player's own currency.
  async function loadPrices() {
    if (prices) return;
    if (!store) { message('The store is unavailable here.'); return; }
    try {
      const { products } = await store.call('getProducts', { productIdentifiers: Object.keys(PACKS), productType: 'inapp' });
      const found = {};
      for (const p of products || []) if (PACKS[p.identifier] && p.priceString) found[p.identifier] = p.priceString;
      if (Object.keys(found).length) { prices = found; message('Crystals are saved on this iPhone. Deleting the app removes them.'); }
      else message('The store is unavailable right now. Please try again later.');
    } catch { message('The store needs an internet connection. Please try again later.'); }
    draw();
  }

  async function buy(sku) {
    if (!PACKS[sku] || !prices?.[sku]) return;
    await exclusive(async () => {
      message('Opening the App Store…');
      let t;
      try {
        // Finished only after the Crystals are saved, so a crash in between
        // leaves the purchase with Apple, who hands it back on the next launch.
        t = await store.call('purchaseProduct', { productIdentifier: sku, productType: 'inapp', quantity: 1, autoAcknowledgePurchases: false });
      } catch (err) {
        const why = String(err?.message || err);
        if (/cancel/i.test(why)) throw new Error('Purchase cancelled. You were not charged.');
        if (/pending/i.test(why)) throw new Error('Waiting for approval. The Crystals arrive once the purchase is approved.');
        throw new Error('The purchase did not go through. You were not charged.');
      }
      if (t?.productIdentifier !== sku) throw new Error('The purchase could not be confirmed. Please contact us.');
      const added = credit(t);
      try { await store.call('acknowledgePurchase', { purchaseToken: String(t.transactionId) }); } catch {}
      message(added ? `${added} Crystals added.` : 'This purchase was already added.');
    });
  }

  function claim() {
    if (wallet.welcome_claimed) return;
    wallet.crystals += 3; wallet.welcome_claimed = true;
    save(); message('Your 3 free Crystals are ready.'); draw();
  }

  async function revive() {
    const s = game().summary();
    if (busy || !s.over || s.revived) return;
    if (wallet.crystals < 1) { openShop(); return; }
    await exclusive(async () => {
      wallet.crystals -= 1;
      try { save(); } catch { wallet.crystals += 1; throw new Error('Device storage unavailable. No Crystal was spent.'); }
      game().revive();
      message('Revived. Press Resume to continue.');
    });
  }

  async function newGame() { if (!busy) game().replay(); }

  function openShop() {
    if (busy) return;
    opener = document.activeElement; panel = $('shopModal');
    panel.dataset.shopView = 'crystals';
    panel.hidden = false;
    panel.querySelector('.shop-card').scrollTop = 0;
    game()?.pause(); draw(); $('shopClose').focus();
    loadPrices();
  }
  function closeShop() {
    if (!panel || busy) return;
    panel.hidden = true; panel = null; game()?.resumeIfAllowed(); opener?.focus();
  }
  function trapFocus(e) {
    if (!panel) return;
    if (e.key === 'Escape') { closeShop(); return; }
    if (e.key !== 'Tab') return;
    const nodes = [...panel.querySelectorAll('button:not([disabled]),a[href]')].filter(n => n.getClientRects().length);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }

  async function init() {
    $('shopBtn').onclick = () => openShop(); $('startShopBtn').onclick = () => openShop();
    $('shopClose').onclick = closeShop; $('shopModal').onclick = e => { if (e.target === $('shopModal')) closeShop(); };
    $('claimBtn').onclick = claim;
    document.querySelectorAll('[data-product]').forEach(btn => btn.onclick = () => buy(btn.dataset.product));
    $('reviveCrystal').onclick = revive;
    $('reviveFind').onclick = () => openShop();
    $('reviveResume').onclick = () => { if (!isBlocking()) game().resumeRevival(); };
    document.addEventListener('keydown', trapFocus);
    // Purchases Apple finishes later (Ask to Buy, an interrupted purchase).
    try { store?.listen('transactionUpdated', t => { const added = credit(t); if (added) message(`${added} Crystals added.`); }); } catch {}
    await game().accountChanged(null);
    draw();
  }

  return { init, draw, isBlocking, newGame, openShop, summary: () => ({ owner: null, wallet, busy, pending: false, known: true }) };
})();
