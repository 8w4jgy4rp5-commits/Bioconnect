/* The iPhone app's store (app/build-app.cjs ships this as monetization.js).
 * The website sells through Stripe with an account; the app sells Crystals
 * and No Ads through Apple instead, with no account, and shows Google AdMob
 * ads (non-personalized) to players without No Ads.
 * Same outside shape as the website's BioEconomy, so script.js is unchanged. */
window.BioEconomy = (() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const game = () => window.BioGame;
  // Apple product IDs (App Store Connect) and how many Crystals each gives.
  const PACKS = { crystals5: 5, crystals11: 11, crystals30: 30, crystals65: 65 };
  // No Ads: a one-time (non-consumable) Apple purchase. Apple keeps it with the
  // player's Apple Account, so Restore purchases brings it back on a new iPhone.
  const NO_ADS = 'no_ads';
  // Google AdMob. While test is true only Google's sample ads show (the
  // plugin swaps in Google's test ad units). Real ads need the app's own ad
  // unit IDs here and test: false, and the AdMob app ID in Info.plist.
  const ADS = { test: true, reward: 'ca-app-pub-7033615978880555/7140625313', next: 'ca-app-pub-7033615978880555/5242375234' };
  const KEY = 'bioconnect:app-wallet';
  const cap = window.Capacitor;
  const native = !!cap?.isNativePlatform?.() && typeof cap.nativePromise === 'function';
  const bridge = name => ({
    call: (method, options = {}) => cap.nativePromise(name, method, options),
    listen: (event, fn) => cap.addListener(name, event, fn)
  });
  // Off the iPhone (the offline test), stand-ins may be given; the app never has them.
  const store = native ? bridge('NativePurchases') : window.__BIO_APP_STORE__ || null;
  const admob = native ? bridge('AdMob') : window.__BIO_APP_ADS__ || null;

  let wallet = load(), prices = null, busy = false, panel = null, opener = null;
  let shown = wallet.crystals, counter = 0, wasOver = false, music = null;

  function load() {
    try {
      const w = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (w && Number.isInteger(w.crystals) && w.crystals >= 0 && Array.isArray(w.credited)) {
        return { welcome_claimed: false, no_ads: false, daily: '', ...w, no_ads: w.no_ads === true };
      }
    } catch {}
    return { crystals: 0, welcome_claimed: false, credited: [], no_ads: false, daily: '' };
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(wallet)); }
  // A message goes where the player is looking: the shop while it is open,
  // otherwise the game over card. It never waits around for a later screen.
  const SHOP_NOTE = { crystals: 'Crystals are saved on this iPhone. Deleting the app removes them.',
    no_ads: 'No Ads stays with your Apple Account. On a new iPhone, tap Restore purchases.' };
  const note = () => SHOP_NOTE[panel?.dataset.shopView] || SHOP_NOTE.crystals;
  const message = text => {
    if ($('shopStatus')) $('shopStatus').textContent = panel ? text : '';
    if ($('reviveStatus')) $('reviveStatus').textContent = panel ? '' : text;
  };
  const notice = text => { message(text); if (panel) $('shopStatus')?.scrollIntoView({ block: 'nearest' }); };

  // The free daily revival (No Ads) resets at 4:00 AM New York time.
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() - 4 * 3600e3));
  const dailyFree = () => wallet.no_ads && wallet.daily !== today();

  // Each Apple transaction adds its Crystals once, even if Apple reports it twice.
  function credit(t) {
    if (t?.productIdentifier === NO_ADS) { if (!t.revocationDate) grantNoAds(); return 0; }
    const amount = PACKS[t?.productIdentifier], id = String(t?.transactionId || '');
    if (!amount || !id || wallet.credited.includes(id)) return 0;
    wallet.crystals += amount * Math.max(1, Number(t.quantity) || 1);
    wallet.credited = wallet.credited.concat(id).slice(-200);
    save(); draw(); celebrate();
    return amount;
  }
  function grantNoAds() {
    if (wallet.no_ads) return false;
    wallet.no_ads = true; save(); draw();
    window.BioAudio?.chime?.();
    return true;
  }
  // Apple's own list of what this Apple Account owns: No Ads comes back after
  // a reinstall, and goes away if Apple refunded it. A failed check changes nothing.
  async function checkNoAds() {
    if (!store) return;
    try {
      const { purchases } = await store.call('getPurchases', {});
      const owned = (purchases || []).some(p => p.productIdentifier === NO_ADS && !p.revocationDate);
      if (owned !== wallet.no_ads) { wallet.no_ads = owned; save(); draw(); }
    } catch {}
  }
  // Crystals arrived: a cha-ching, the balances glow, and the numbers count
  // up to the new total, so the purchase is seen as well as heard.
  function celebrate() {
    window.BioAudio?.chime?.();
    for (const id of ['gameCrystals', 'startCrystalBalance', 'shopBalance']) {
      const node = $(id);
      if (!node) continue;
      node.classList.remove('crystal-gain'); void node.offsetWidth; node.classList.add('crystal-gain');
    }
    countUp();
  }
  function showCount(n) {
    for (const id of ['gameCrystalCount', 'startCrystalCount', 'shopBalanceCount']) if ($(id)) $(id).textContent = String(n);
  }
  function countUp() {
    clearInterval(counter); counter = 0;
    const from = shown, to = wallet.crystals;
    if (to <= from || matchMedia('(prefers-reduced-motion: reduce)').matches) { shown = to; showCount(to); return; }
    const steps = Math.min(to - from, 20), started = performance.now(), length = 700;
    counter = setInterval(() => {
      const done = Math.min(1, (performance.now() - started) / length);
      shown = Math.round(from + (to - from) * (1 - (1 - done) ** 2));
      if (done >= 1) { clearInterval(counter); counter = 0; shown = to; }
      showCount(shown);
    }, length / steps);
  }

  /* ---- Ads (Google AdMob) ----
   * Two kinds, as on the website: a rewarded ad the player may choose to
   * revive, and a short ad when a new game starts after a game over.
   * Non-personalized only, so the app never asks to track. Where the law asks
   * for consent (Europe, the UK), Google's consent form comes first. */
  const ads = { started: false, starting: null, ready: { reward: false, next: false }, loading: {}, privacy: false, open: null };
  const adsOn = () => !!admob && !wallet.no_ads && ads.started;
  function startAds() {
    if (!admob || wallet.no_ads || ads.started) return Promise.resolve();
    if (ads.starting) return ads.starting;
    ads.starting = (async () => {
      try {
        let info = await admob.call('requestConsentInfo', {});
        if (info?.status === 'REQUIRED' && info.isConsentFormAvailable) info = await admob.call('showConsentForm');
        ads.privacy = info?.privacyOptionsRequirementStatus === 'REQUIRED';
        if (!info?.canRequestAds) return;
        await admob.call('initialize', { initializeForTesting: ADS.test, maxAdContentRating: 'ParentalGuidance' });
        ads.started = true;
      } catch {}  // offline or no answer: tried again at the next game over
      finally { ads.starting = null; draw(); }
      prepare('reward'); prepare('next');
    })();
    return ads.starting;
  }
  async function prepare(type) {
    if (!adsOn() || ads.ready[type] || ads.loading[type]) return;
    ads.loading[type] = true;
    try {
      await admob.call(type === 'reward' ? 'prepareRewardVideoAd' : 'prepareInterstitial', { adId: ADS[type], isTesting: ADS.test, npa: true });
      ads.ready[type] = true;
    } catch {}  // no ad to show right now: asked for again at the next game over
    ads.loading[type] = false; draw();
  }
  // Shows one full-screen ad and settles once it has closed: true only for a
  // rewarded ad watched to the end. The music and the game wait meanwhile.
  function showAd(type) {
    if (!adsOn() || !ads.ready[type]) return Promise.resolve(false);
    ads.ready[type] = false;
    return new Promise(resolve => {
      let earned = false, done = false;
      const finish = () => {
        if (done) return; done = true; clearTimeout(wait); ads.open = null;
        window.BioAudio?.ad(false); resolve(earned); prepare(type);
      };
      // An ad that never comes up does not leave the game waiting.
      const wait = setTimeout(finish, 8000);
      ads.open = { type, finish, shown: () => clearTimeout(wait), earn: () => { earned = true; } };
      window.BioAudio?.ad(true);
      admob.call(type === 'reward' ? 'showRewardVideoAd' : 'showInterstitial')
        .then(() => { if (type === 'reward') earned = true; }, finish);
    });
  }
  function listenAds() {
    if (!admob) return;
    const on = (event, type, what) => { try { admob.listen(event, () => { if (ads.open?.type === type) ads.open[what](); }); } catch {} };
    on('onRewardedVideoAdShowed', 'reward', 'shown'); on('interstitialAdShowed', 'next', 'shown');
    on('onRewardedVideoAdReward', 'reward', 'earn');
    on('onRewardedVideoAdDismissed', 'reward', 'finish'); on('onRewardedVideoAdFailedToShow', 'reward', 'finish');
    on('interstitialAdDismissed', 'next', 'finish'); on('interstitialAdFailedToShow', 'next', 'finish');
  }

  function isBlocking() { return busy || !!panel || !!ads.open; }
  function draw() {
    const s = game()?.summary();
    // A new game over starts with a clean card (no message from earlier).
    if (s?.over && !wasOver) {
      if ($('reviveStatus')) $('reviveStatus').textContent = '';
      startAds(); prepare('reward'); prepare('next');
    }
    wasOver = !!s?.over;
    // Crystals are bought on the title screen and at game over, not mid-game:
    // the balance in play only shows the number.
    for (const id of ['startShopBtn', 'startWallet', 'gameCrystals']) if ($(id)) $(id).hidden = false;
    if ($('shopBtn')) $('shopBtn').hidden = true;
    if (!counter || shown > wallet.crystals) { clearInterval(counter); counter = 0; shown = wallet.crystals; showCount(shown); }
    if ($('gameCrystals')) { $('gameCrystals').setAttribute('aria-label', `Crystals: ${wallet.crystals}`); $('gameCrystals').tabIndex = -1; }
    if ($('shopBalance')) $('shopBalance').setAttribute('aria-label', `Your Crystals: ${wallet.crystals}`);
    const owned = wallet.no_ads, noAdsPrice = prices?.[NO_ADS];
    // No Ads sits on the title screen next to the Crystals.
    if ($('startNoAdsBtn')) {
      $('startNoAdsBtn').hidden = !store && !owned;
      $('startNoAdsBtn').classList.toggle('is-owned', owned);
      $('startNoAdsBtn').setAttribute('aria-label', owned ? 'No Ads owned. View benefits' : 'Open No Ads shop');
    }
    if ($('startNoAdsLabel')) $('startNoAdsLabel').textContent = owned ? 'Owned' : 'No Ads';
    if ($('startCrystalBalance')) $('startCrystalBalance').setAttribute('aria-label', 'Crystals: ' + wallet.crystals);
    if ($('walletLabel')) $('walletLabel').textContent = panel?.dataset.shopView === 'no_ads'
      ? (owned ? 'No Ads owned' : 'No Ads not owned') : `${wallet.crystals} Crystals`;
    if ($('claimBtn')) { $('claimBtn').hidden = wallet.welcome_claimed; $('claimBtn').disabled = busy; }
    for (const btn of document.querySelectorAll('[data-product]')) {
      const sku = btn.dataset.product, price = prices?.[sku];
      const waiting = !price && !!loading;
      btn.classList.toggle('is-loading', waiting);
      if (sku === NO_ADS) {
        btn.disabled = busy || owned || !price;
        btn.textContent = owned ? 'Owned' : price || (waiting ? 'Loading' : '—');
        btn.setAttribute('aria-label', owned ? 'No Ads owned' : `Buy No Ads, ${price || 'price unavailable'}, one-time purchase`);
        continue;
      }
      btn.disabled = busy || !price;
      const tag = btn.querySelector('.pack-price');
      if (tag) tag.textContent = price || (waiting ? 'Loading' : '—');
      btn.setAttribute('aria-label', `${PACKS[sku]} Crystals, ${price || 'price unavailable'}`);
    }
    if ($('dailyInfo')) $('dailyInfo').textContent = owned ? (dailyFree() ? 'Your daily revival is available.' : 'Daily revival used. Next reset: 4:00 AM New York time.') : '';
    if ($('restoreBtn')) $('restoreBtn').disabled = busy || !store;
    if ($('adPrivacyBtn')) { $('adPrivacyBtn').hidden = !ads.privacy || owned; $('adPrivacyBtn').disabled = busy; }
    if ($('reviveCrystal')) {
      const open = s?.over && !s.revived;
      // One revive button at a time: the free daily one (No Ads), then a
      // Crystal, then a rewarded ad, then a way to the store.
      const main = dailyFree() ? 'daily' : wallet.crystals > 0 ? 'crystal' : adsOn() && ads.ready.reward ? 'ad' : 'find';
      const pick = { reviveDaily: 'daily', reviveCrystal: 'crystal', reviveAd: 'ad', reviveFind: 'find' };
      for (const id in pick) if ($(id)) { $(id).hidden = !open || main !== pick[id]; $(id).disabled = busy; }
      // Without No Ads, the daily dawn sits above it in chains.
      for (const id of ['reviveDawnLocked', 'reviveHush']) if ($(id)) $(id).hidden = !open || owned || !noAdsPrice;
      if ($('reviveDawnLocked')) $('reviveDawnLocked').disabled = busy;
      $('goAgain').disabled = busy;
      $('reviveCrystal').querySelector('em').textContent = `1 Crystal · balance: ${wallet.crystals}`;
      if (s?.revived && s.over && !panel) $('reviveStatus').textContent = 'Revival already used in this game.';
    }
  }

  async function exclusive(action) {
    if (busy) return;
    busy = true; game()?.pause(); draw();
    try { await action(); } catch (err) { notice(err.message || 'Something went wrong. Please retry.'); }
    finally { busy = false; draw(); }
  }

  // Prices come from Apple, in the player's own currency.
  // Asked for once at launch (and again if that failed), so the shop
  // usually opens with its prices ready.
  let loading = null, storeDown = '';
  function loadPrices() {
    if (prices) return Promise.resolve();
    if (!store) { storeDown = 'The store is unavailable here.'; if (panel) message(storeDown); return Promise.resolve(); }
    if (loading) return loading;
    loading = (async () => {
      try {
        const ids = Object.keys(PACKS).concat(NO_ADS);
        const { products } = await store.call('getProducts', { productIdentifiers: ids, productType: 'inapp' });
        const found = {};
        for (const p of products || []) if (ids.includes(p.identifier) && p.priceString) found[p.identifier] = p.priceString;
        if (Object.keys(found).length) { prices = found; storeDown = ''; }
        else storeDown = 'The store is unavailable right now. Please try again later.';
      } catch { storeDown = 'The store needs an internet connection. Please try again later.'; }
      loading = null;
      if (panel && !busy) message(storeDown || note());
      draw();
    })();
    draw();
    return loading;
  }

  async function buy(sku) {
    if (!(PACKS[sku] || sku === NO_ADS) || !prices?.[sku] || (sku === NO_ADS && wallet.no_ads)) return;
    await exclusive(async () => {
      message('Opening the App Store…');
      let t;
      try {
        // Finished only after the purchase is saved, so a crash in between
        // leaves it with Apple, who hands it back on the next launch.
        t = await store.call('purchaseProduct', { productIdentifier: sku, productType: 'inapp', quantity: 1, autoAcknowledgePurchases: false });
      } catch (err) {
        const why = String(err?.message || err);
        if (/cancel/i.test(why)) throw new Error('Purchase cancelled. You were not charged.');
        if (/pending/i.test(why)) throw new Error(sku === NO_ADS ? 'Waiting for approval. No Ads turns on once the purchase is approved.' : 'Waiting for approval. The Crystals arrive once the purchase is approved.');
        throw new Error('The purchase did not go through. You were not charged.');
      }
      if (t?.productIdentifier !== sku) throw new Error('The purchase could not be confirmed. Please contact us.');
      if (sku === NO_ADS) {
        grantNoAds();
        message('No Ads is on. Thank you! Your free daily revival is ready.');
      } else {
        const added = credit(t);
        message(added ? `${added} Crystals added.` : 'This purchase was already added.');
      }
      try { await store.call('acknowledgePurchase', { purchaseToken: String(t.transactionId) }); } catch {}
    });
  }
  // Apple asks for the Apple Account password, then hands back what it owns.
  async function restore() {
    await exclusive(async () => {
      message('Checking with the App Store…');
      try { await store.call('restorePurchases'); } catch { throw new Error('Could not reach the App Store. Please try again later.'); }
      await checkNoAds();
      message(wallet.no_ads ? 'No Ads restored.' : 'No earlier No Ads purchase was found for this Apple Account.');
    });
  }
  async function adPrivacy() {
    await exclusive(async () => { try { await admob.call('showPrivacyOptionsForm'); } catch {} });
  }

  function claim() {
    if (wallet.welcome_claimed) return;
    wallet.crystals += 3; wallet.welcome_claimed = true;
    save(); message('Your 3 free Crystals are ready.'); draw(); celebrate();
  }

  async function revive(source) {
    const s = game().summary();
    if (busy || !s.over || s.revived) return;
    if (source === 'crystal' && wallet.crystals < 1) { openShop('crystals'); return; }
    await exclusive(async () => {
      if (source === 'daily') {
        if (!dailyFree()) throw new Error('Daily revival already used. Next reset: 4:00 AM New York time.');
        const before = wallet.daily;
        wallet.daily = today();
        try { save(); } catch { wallet.daily = before; throw new Error('Device storage unavailable. Please retry.'); }
      } else if (source === 'ad') {
        const run = s.runId;
        if (!await showAd('reward')) throw new Error('Ad not finished, so no revival. No Crystal was spent.');
        if (game().summary().runId !== run || !game().summary().over) return;
      } else {
        wallet.crystals -= 1;
        try { save(); } catch { wallet.crystals += 1; throw new Error('Device storage unavailable. No Crystal was spent.'); }
      }
      game().revive();
      message('Revived. Press Resume to continue.');
    });
  }

  // After a game over, a short ad plays before the new meadow (not with No Ads).
  async function newGame() {
    if (busy) return;
    if (game().summary().over && adsOn() && ads.ready.next) await exclusive(() => showAd('next'));
    game().replay();
  }

  function openShop(view = 'crystals') {
    if (busy || ads.open) return;
    opener = document.activeElement; panel = $('shopModal');
    panel.dataset.shopView = view === 'no_ads' ? 'no_ads' : 'crystals';
    if ($('shopTitle')) $('shopTitle').textContent = view === 'no_ads' ? 'No Ads' : 'Crystals';
    panel.hidden = false;
    panel.querySelector('.shop-card').scrollTop = 0;
    // The shop has its own music box tune; closing it brings back what played before.
    music = window.BioAudio?.band?.().theme || null;
    window.BioAudio?.theme?.('shop');
    message(prices ? note() : storeDown);
    game()?.pause(); draw(); $('shopClose').focus();
    loadPrices();
  }
  function closeShop() {
    if (!panel || busy) return;
    panel.hidden = true; panel = null;
    if ($('shopStatus')) $('shopStatus').textContent = '';
    if (music) window.BioAudio?.theme?.(music);
    music = null;
    game()?.resumeIfAllowed(); opener?.focus();
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
    $('shopBtn').onclick = () => openShop(); $('startShopBtn').onclick = () => openShop('crystals');
    if ($('startNoAdsBtn')) $('startNoAdsBtn').onclick = () => openShop('no_ads');
    $('shopClose').onclick = closeShop; $('shopModal').onclick = e => { if (e.target === $('shopModal')) closeShop(); };
    $('claimBtn').onclick = claim;
    document.querySelectorAll('[data-product]').forEach(btn => btn.onclick = () => buy(btn.dataset.product));
    if ($('restoreBtn')) $('restoreBtn').onclick = restore;
    if ($('adPrivacyBtn')) $('adPrivacyBtn').onclick = adPrivacy;
    $('reviveCrystal').onclick = () => revive('crystal');
    $('reviveDaily').onclick = () => revive('daily');
    $('reviveAd').onclick = () => revive('ad');
    $('reviveFind').onclick = () => openShop('crystals');
    if ($('reviveDawnLocked')) $('reviveDawnLocked').onclick = () => openShop('no_ads');
    $('reviveResume').onclick = () => { if (!isBlocking()) game().resumeRevival(); };
    document.addEventListener('keydown', trapFocus);
    // Purchases Apple finishes later (Ask to Buy, an interrupted purchase).
    try { store?.listen('transactionUpdated', t => { const added = credit(t); if (added) message(`${added} Crystals added.`); }); } catch {}
    listenAds();
    await game().accountChanged(null);
    draw();
    loadPrices();
    // No Ads is checked with Apple before any ad is asked for.
    checkNoAds().then(startAds);
  }

  return { init, draw, isBlocking, newGame, openShop, summary: () => ({ owner: null, wallet, busy, pending: false, known: true, ads: { on: adsOn(), ready: { ...ads.ready } } }) };
})();
