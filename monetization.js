/* Account money is server-owned. Local test adapters are accepted on loopback ONLY. */
window.BioEconomy = (() => {
  'use strict';
  const cfg = window.BioMonetizationConfig || {};
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  const test = loopback ? window.__BIOCONNECT_TEST_ADAPTER__ : null;
  let session = null, wallet = null, known = false, epoch = 0, busy = false;
  let panel = null, adPanel = null, adActive = false, pending = null, refreshTimer = 0, opener = null;
  let authEmail = '', checkoutRequest = null;
  const $ = id => document.getElementById(id);
  const client = () => typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  const game = () => window.BioGame;
  const uid = () => session?.user.id || null;
  const googleLinked = user => !!user?.identities?.some(identity => identity.provider === 'google');
  const authReturnKey = 'bioconnect:auth-return';
  function oauthError() {
    const url = new URL(location.href), hash = new URLSearchParams(url.hash.slice(1));
    const source = url.searchParams.has('error') ? url.searchParams : hash.has('error') ? hash : null;
    if (!source) return null;
    const ownerOnly = source.get('error_description') === 'This sandbox is restricted to its owner.';
    return { text: ownerOnly
      ? 'This TEST account is restricted to its owner. Sign in with your original email, then link Google to that account.'
      : 'Google sign-in or linking did not complete. Your account balance and purchases have not been transferred. Please retry.' };
  }
  function clearOAuthError() {
    // Use the current URL after the SDK has consumed the callback. Never restore old tokens.
    const url = new URL(location.href), hash = new URLSearchParams(url.hash.slice(1));
    for (const params of [url.searchParams, hash]) {
      if (params.has('error')) for (const key of ['error', 'error_code', 'error_description']) params.delete(key);
    }
    // Keep successful OAuth credentials and unrelated URL fields for the Auth SDK.
    if (new URLSearchParams(location.hash.slice(1)).has('error')) url.hash = hash.toString();
    history.replaceState(null, '', url.href);
  }
  function clearAuthReturn() {
    sessionStorage.removeItem(authReturnKey);
    sessionStorage.removeItem('bioconnect:return-game');
  }
  function saveAuthReturn(kind, owner) {
    try {
      sessionStorage.setItem('bioconnect:return-game', JSON.stringify(game().snapshot()));
      sessionStorage.setItem(authReturnKey, JSON.stringify({ kind, owner, startedAt: Date.now() }));
    } catch {
      try { clearAuthReturn(); } catch {}
      throw new Error('Game state could not be saved. Enable browser storage before using Google.');
    }
  }
  function assertActor(owner, version) {
    if (owner !== uid() || version !== epoch) throw new Error('Account changed. Retry with the original account.');
  }
  const recoveryKey = owner => 'bioconnect:revival-pending:' + owner;
  const message = value => { if ($('shopStatus')) $('shopStatus').textContent = value; if ($('reviveStatus')) $('reviveStatus').textContent = value; };
  function saveRecovery(value) {
    // A durable pre-consumption snapshot is mandatory. Storage failure aborts spending.
    localStorage.setItem(recoveryKey(value.owner), JSON.stringify(value));
  }
  function removeRecovery(owner) { try { localStorage.removeItem(recoveryKey(owner)); } catch {} }
  function isBlocking() { return busy || !!panel || !!adPanel || adActive || !!pending; }
  function pause() { game()?.pause(); }
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
    const paid = !!wallet?.no_ads;
    // Until the live backend sells, the store and revivals stay out of sight there.
    const storeOn = cfg.storeEnabled === true || loopback;
    for (const id of ['shopBtn', 'startShopBtn']) if ($(id)) $(id).hidden = !storeOn;
    if ($('accountLabel')) $('accountLabel').textContent = session ? (session.user.email || 'Signed in') : 'Play without signing in';
    if ($('walletLabel')) $('walletLabel').textContent = session ? (wallet ? `${wallet.crystals} Crystals · ${paid ? 'No Ads owned' : 'No Ads not owned'}` : 'Account balance unavailable') : 'Sign in to claim 3 free Crystals or purchase';
    if ($('authControls')) $('authControls').hidden = !!session;
    if ($('googleLink')) {
      $('googleLink').hidden = !session || !!test || googleLinked(session.user);
      $('googleLink').disabled = busy || !!pending || !known;
    }
    if ($('googleLinkInfo')) {
      $('googleLinkInfo').hidden = !session || !!test;
      $('googleLinkInfo').textContent = googleLinked(session?.user) ? 'Google is linked to this account.'
        : 'Link Google to keep using this account, its Crystals and purchases, even with a different Google email.';
    }
    for (const id of ['googleSignIn', 'sendCodeBtn', 'verifyCodeBtn']) if ($(id)) $(id).disabled = busy;
    if ($('signOutBtn')) { $('signOutBtn').hidden = !session; $('signOutBtn').disabled = busy || !!pending && pending.owner === uid(); }
    if ($('claimBtn')) { $('claimBtn').hidden = !!wallet?.welcome_claimed; $('claimBtn').disabled = busy; }
    if ($('dailyInfo')) $('dailyInfo').textContent = paid ? (wallet.daily_available ? 'Your daily revival is available.' : 'Daily revival used. Next reset: 4:00 AM New York time.') : '';
    for (const btn of document.querySelectorAll('[data-product]')) btn.disabled = busy || !!pending || (btn.dataset.product === 'no_ads' && paid);
    if ($('reviveCrystal')) {
      const used = !s?.over || s.revived || !storeOn;
      // One revive button at a time: a pending retry first, then the daily
      // dawn, then a Crystal, then a rewarded ad, then a way to the store.
      const adOk = !paid && known && !(session && !wallet) && (!!test || cfg.adsEnabled);
      const main = pending ? pending.source
        : paid && wallet?.daily_available ? 'daily'
        : wallet?.crystals > 0 ? 'crystal'
        : adOk ? 'ad'
        : session && wallet ? 'find' : 'crystal';
      const show = { reviveDaily: 'daily', reviveCrystal: 'crystal', reviveAd: 'ad', reviveFind: 'find' };
      for (const id in show) $(id).hidden = used || main !== show[id];
      $('reviveDawnLocked').hidden = $('reviveHush').hidden = used || paid || !!pending;
      $('reviveCrystal').disabled = busy || (!!pending && pending.source !== 'crystal');
      $('reviveDaily').disabled = busy || (!!pending && pending.source !== 'daily');
      $('reviveAd').disabled = $('reviveFind').disabled = $('reviveDawnLocked').disabled = busy || !!pending;
      $('goAgain').disabled = busy || !!pending;
      const words = (id, title, note) => { const b = $(id); b.querySelector('strong').textContent = title; b.querySelector('em').textContent = note; };
      words('reviveCrystal', pending?.source === 'crystal' ? 'Retry Crystal revival' : 'Offer 1 Crystal',
        pending?.source === 'crystal' ? 'confirming with your account' : wallet ? `you have ${wallet.crystals}` : session ? '' : 'sign in for 3 free Crystals');
      words('reviveDaily', pending?.source === 'daily' ? 'Retry daily revival' : 'Wait for Dawn',
        pending?.source === 'daily' ? 'confirming with your account' : 'free · once a day');
      if (s?.revived) $('reviveStatus').textContent = 'Revival already used in this game.';
    }
  }
  async function rpc(name, args = {}) {
    const owner = uid(), version = epoch;
    if (!owner) throw new Error('Sign in to continue.');
    let data;
    if (test) data = await test.rpc(name, args, owner);
    else {
      if (!client()) throw new Error('Account service unavailable.');
      const result = await client().rpc(name, args);
      if (result.error) throw new Error(result.error.message);
      data = result.data;
    }
    if (owner !== uid() || version !== epoch) throw new Error('Account changed. Retry with the original account.');
    return data;
  }
  async function refresh() {
    if (!uid()) { wallet = null; draw(); return; }
    const version = epoch;
    try { const w = await rpc('bioconnect_wallet'); if (version === epoch) wallet = w; }
    catch { if (version === epoch) { wallet = null; message('Account unavailable. Purchases and paid revivals need a connection.'); } }
    draw();
  }
  async function authChanged(next) {
    const previous = uid(), owner = next?.user.id || null;
    session = next; known = true;
    game()?.accountChanged(owner);
    if (previous !== owner) {
      epoch++; wallet = null; checkoutRequest = null; authEmail = '';
      // Supabase callbacks must not await other Supabase auth operations.
      if (owner) {
        try {
          const p = JSON.parse(localStorage.getItem(recoveryKey(owner)) || 'null');
          if (p && p.owner === owner && ['crystal','daily'].includes(p.source) && p.snapshot?.runId === p.runId) {
            pending = p; game()?.restore(p.snapshot); message('A revival needs confirmation. Retry to recover this game.');
          }
        } catch { message('Saved revival recovery could not be loaded.'); }
      }
    }
    draw();
    await refresh();
  }
  async function exclusive(action) {
    if (busy) return;
    busy = true; pause(); draw();
    try { await action(); } catch (err) { message(err.message || 'Service unavailable. Please retry.'); }
    finally { busy = false; draw(); }
  }
  function requireLogin() {
    if (uid()) return true;
    openShop(); message('Sign in to purchase or claim your free Crystals.'); return false;
  }
  async function claim() {
    if (!requireLogin()) return;
    await exclusive(async () => { wallet = await rpc('bioconnect_claim_welcome'); message('Your 3 free Crystals are ready.'); });
  }
  async function buy(sku) {
    if (!requireLogin()) return;
    if (!test && !cfg.paymentsEnabled) { message('Purchases are not enabled yet.'); return; }
    const owner = uid(), version = epoch;
    await exclusive(async () => {
      await refresh();
      assertActor(owner, version);
      if (!wallet) throw new Error('Account unavailable. Please retry.');
      if (sku === 'no_ads' && wallet.no_ads) throw new Error('You already own No Ads.');
      // Persist key BEFORE contacting checkout; ambiguous retries retain the same key.
      const key = 'bioconnect:checkout:' + owner + ':' + sku;
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      checkoutRequest = saved?.id || crypto.randomUUID();
      if (saved?.order) {
        const status = await rpc('bioconnect_order_status', { p_order: saved.order });
        assertActor(owner, version);
        if (status.paid) { localStorage.removeItem(key); checkoutRequest = crypto.randomUUID(); }
      }
      localStorage.setItem(key, JSON.stringify({ id: checkoutRequest, order: saved?.id === checkoutRequest ? saved?.order : null }));
      let result;
      if (test) result = await test.checkout({ sku, request_id: checkoutRequest }, owner);
      else {
        const { data, error } = await client().functions.invoke('checkout', { body: { sku, request_id: checkoutRequest } });
        if (error) {
          let failure;
          try { failure = await error.context?.json(); } catch {}
          if (failure?.code === 'order_expired') {
            localStorage.removeItem(key);
            throw new Error('Order expired. Select this product again to start a new purchase.');
          }
          throw new Error('Checkout unavailable. Retry this purchase. No product has been granted.');
        }
        result = data;
      }
      if (result.error) throw new Error(result.error);
      if (owner !== uid() || version !== epoch) return;
      const url = new URL(result.url, location.href);
      if (test && url.origin === location.origin || !test && url.protocol === 'https:' && url.hostname === 'checkout.stripe.com') {
        localStorage.setItem(key, JSON.stringify({ id: checkoutRequest, order: result.order_id }));
        // Keep a game snapshot over the hosted checkout navigation.
        sessionStorage.setItem('bioconnect:return-game', JSON.stringify(game().snapshot()));
        location.assign(url.href);
      } else throw new Error('Invalid checkout destination.');
    });
  }
  async function revive(source) {
    const s = game().summary();
    if (busy || !s.over || s.revived) return;
    if (source !== 'ad' && !requireLogin()) return;
    if (pending && pending.owner !== uid()) {
      openShop(); message('Sign in with the original account to confirm the pending revival.'); return;
    }
    const owner = uid(), version = epoch;
    await exclusive(async () => {
      const run = game().summary().runId;
      if (source === 'ad') {
        if (pending) throw new Error('Confirm the previous revival first.');
        await refresh();
        assertActor(owner, version);
        if (!known || wallet?.no_ads || uid() && !wallet) throw new Error('Rewarded ads unavailable for this account.');
        const completed = await showAd('reward');
        assertActor(owner, version);
        if (!completed) throw new Error('Ad not completed. Choose another option. No Crystal was spent.');
      } else {
        if (pending && pending.source !== source) throw new Error('Retry the original revival confirmation.');
        if (!pending) {
          await refresh();
          assertActor(owner, version);
          if (!wallet) throw new Error('Account unavailable. Please retry.');
          if (source === 'daily' && (!wallet.no_ads || !wallet.daily_available)) throw new Error('Daily revival unavailable.');
          pending = { owner: uid(), source, runId: run, snapshot: game().snapshot() };
          try { saveRecovery(pending); } catch { pending = null; throw new Error('Device storage unavailable. No Crystal was spent.'); }
        }
        try {
          assertActor(owner, version);
          const result = await rpc('bioconnect_revive', { p_run_id: pending.runId, p_source: pending.source });
          wallet = result.wallet;
        } catch (err) {
          // Deterministic database rejections have no committed change. Network failures
          // retain the snapshot and original ID, so the server can acknowledge once.
          if (/Not enough crystals|Daily revival unavailable|Invalid revival/.test(err.message)) {
            removeRecovery(pending.owner); pending = null;
          }
          throw err;
        }
      }
      if (game().summary().runId !== run || !game().summary().over) throw new Error('Game changed. Recover the original game.');
      // Keep the durable snapshot until the revived state has actually rendered.
      game().revive();
      if (pending) removeRecovery(pending.owner);
      pending = null; message('Revived. Press Resume to continue.');
    });
  }
  async function newGame() {
    if (busy || pending) return;
    await exclusive(async () => {
      if (game().summary().over) { await refresh(); await showAd('next'); }
      game().replay();
    });
  }
  function showAd(type) {
    // Fail closed for an unverified signed-in entitlement. Never ask a purchaser.
    if (!known || wallet?.no_ads || uid() && !wallet) return Promise.resolve(false);
    if (test) return localAd(type);
    if (!cfg.adsEnabled || !/^ca-pub-\d+$/.test(cfg.adClient)) return Promise.resolve(false);
    return googleAd(type);
  }
  function localAd(type) {
    return new Promise(resolve => {
      const node = document.createElement('div'); node.className = 'economy-modal';
      node.innerHTML = '<div class="economy-card" role="dialog" aria-modal="true" aria-label="Local test advertisement"><h2>Local test advertisement</h2><p>No real ad is being requested.</p><button class="btn" data-ad="complete">Complete test ad</button><button class="btn" data-ad="cancel">Cancel test ad</button><button class="btn" data-ad="fail">Simulate ad failure</button></div>';
      document.body.appendChild(node); adPanel = node; pause(); window.BioAudio?.ad(true);
      node.querySelectorAll('[data-ad]').forEach(btn => btn.onclick = () => {
        node.remove(); adPanel = null; window.BioAudio?.ad(false); resolve(type === 'reward' && btn.dataset.ad === 'complete');
      });
      node.querySelector('button').focus();
    });
  }
  let googleReady = null;
  // Safe callback diagnostics are restricted to the explicit localhost TEST mode.
  function adTrace(event, type, status) {
    if (!loopback || !cfg.adsEnabled || cfg.adTestMode !== true) return;
    const detail = { event, type };
    const statuses = ['notReady','timeout','invalid','error','noAdPreloaded','frequencyCapped','ignored','other','dismissed','viewed'];
    if (statuses.includes(status)) detail.status = status;
    window.dispatchEvent(new CustomEvent('bioconnect:ad-test', { detail }));
  }
  function loadGoogle() {
    if (googleReady) return googleReady;
    googleReady = new Promise(resolve => {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adBreak = window.adConfig = o => window.adsbygoogle.push(o);
      const tag = document.createElement('script'); tag.async = true; tag.crossOrigin = 'anonymous';
      tag.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + cfg.adClient;
      if (cfg.adTestMode) tag.setAttribute('data-adbreak-test', 'on');
      let settled = false;
      const complete = ready => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        if (!ready) googleReady = null;
        adTrace(ready ? 'sdkReady' : 'sdkUnavailable');
        resolve(ready);
      };
      const timeout = setTimeout(() => complete(false), 8000);
      tag.onerror = () => complete(false);
      tag.onload = () => { if (!settled) window.adConfig({ preloadAdBreaks: 'on', sound: 'off', onReady: () => complete(true) }); };
      adTrace('sdkLoading');
      document.head.appendChild(tag);
    });
    return googleReady;
  }
  async function googleAd(type) {
    const owner = uid(), version = epoch;
    if (!await loadGoogle()) return false;
    if (owner !== uid() || version !== epoch || !known || wallet?.no_ads || uid() && !wallet) return false;
    return new Promise(resolve => {
      let viewed = false, finished = false, showing = false;
      const finish = () => { if (finished) return; finished = true; clearTimeout(timeout); window.BioAudio?.ad(false); resolve(type === 'reward' && viewed); };
      // No-fill/missing callback may fall back only BEFORE a full-screen ad starts.
      const timeout = setTimeout(() => { if (!showing) finish(); }, 10000);
      const config = { type, name: type === 'reward' ? 'revive_meadow' : 'new_meadow',
        beforeAd: () => { showing = true; adActive = true; pause(); window.BioAudio?.ad(true); adTrace('beforeAd', type); },
        afterAd: () => { showing = false; adActive = false; window.BioAudio?.ad(false); if (finished) game()?.resumeIfAllowed(); adTrace('afterAd', type); },
        adBreakDone: info => { adTrace('adBreakDone', type, info?.breakStatus); finish(); } };
      if (type === 'reward') Object.assign(config, {
        beforeReward: show => { if (!finished && owner === uid() && version === epoch && !wallet?.no_ads) show(); },
        adViewed: () => { adTrace('adViewed', type); if (!finished) viewed = true; },
        adDismissed: () => { adTrace('adDismissed', type); viewed = false; }
      });
      adTrace('requested', type);
      try { window.adBreak(config); } catch { finish(); }
    });
  }
  function openShop() {
    if (busy || adPanel || adActive) return;
    opener = document.activeElement; panel = $('shopModal'); panel.hidden = false;
    pause(); draw(); $('shopClose').focus();
    refresh();
  }
  function closeShop() {
    if (!panel || busy) return;
    panel.hidden = true; panel = null; game()?.resumeIfAllowed(); opener?.focus();
  }
  async function googleLogin() {
    if (test) { await test.signIn('google'); return; }
    if (!client()) { message('Sign-in service unavailable.'); return; }
    await exclusive(async () => {
      saveAuthReturn('sign-in-google', null);
      try {
        const { error } = await client().auth.signInWithOAuth({ provider: 'google',
          options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
        if (error) throw error;
      } catch { clearAuthReturn(); throw new Error('Google sign-in could not start. Please retry.'); }
    });
  }
  async function linkGoogle() {
    if (!uid() || test || pending || googleLinked(session.user)) return;
    if (!client()) { message('Sign-in service unavailable.'); return; }
    const owner = uid(), version = epoch;
    await exclusive(async () => {
      const { data, error } = await client().auth.getUser();
      assertActor(owner, version);
      if (error || data?.user?.id !== owner) throw new Error('Sign in with your original email before linking Google.');
      saveAuthReturn('link-google', owner);
      try {
        const { data: linkData, error: linkError } = await client().auth.linkIdentity({ provider: 'google',
          options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' }, skipBrowserRedirect: true } });
        assertActor(owner, version);
        if (linkError || pending) throw new Error();
        const { data: latest, error: latestError } = await client().auth.getSession();
        assertActor(owner, version);
        if (latestError || latest?.session?.user.id !== owner || pending) throw new Error();
        const target = new URL(linkData?.url);
        if (target.protocol !== 'https:' || target.hostname !== 'accounts.google.com' || target.port || target.username || target.password) throw new Error();
        location.assign(target.href);
      } catch {
        clearAuthReturn();
        throw new Error('Google linking could not start. Your existing account is unchanged. Please retry.');
      }
    });
  }
  async function finishAuthReturn(saved) {
    if (!saved || !Number.isFinite(saved.startedAt) || Date.now() - saved.startedAt > 15 * 60 * 1000 || saved.startedAt > Date.now()) return;
    if (saved.kind !== 'link-google') return;
    openShop();
    if (!uid() || uid() !== saved.owner) {
      message('Google linking could not be confirmed for your original account. Sign in with your original email to check it.'); return;
    }
    const owner = uid(), version = epoch;
    try {
      const { data, error } = await client().auth.getUser();
      assertActor(owner, version);
      if (error || data?.user?.id !== saved.owner || !googleLinked(data.user)) throw new Error();
      session = { ...session, user: data.user }; draw();
      message('Google is linked to your existing account. Your Crystals and purchases remain on this account.');
    } catch {
      message('Google linking could not be confirmed. Keep using your original email and retry when connected.');
    }
  }
  async function sendCode() {
    const email = $('signInEmail').value.trim();
    if (!$('signInEmail').reportValidity() || !email) return;
    await exclusive(async () => {
      if (test) await test.sendCode(email);
      else { if (!client()) throw new Error('Sign-in service unavailable.');
        const { error } = await client().auth.signInWithOtp({ email }); if (error) throw error; }
      authEmail = email; $('codeControls').hidden = false; $('signInCode').focus();
      message('Check your email for the sign-in code.');
    });
  }
  async function verifyCode() {
    const token = $('signInCode').value.trim();
    if (!authEmail || !/^\d{6,8}$/.test(token)) { message('Enter the code sent to your email.'); return; }
    await exclusive(async () => {
      if (test) await test.verifyCode(authEmail, token);
      else { const { error } = await client().auth.verifyOtp({ email: authEmail, token, type: 'email' }); if (error) throw error; }
      if (!pending && uid() && wallet) message('Signed in. Your account is ready.');
    });
  }
  async function signOut() {
    if (pending && pending.owner === uid()) return;
    await exclusive(async () => {
      if (test) await test.signOut();
      else { const { error } = await client().auth.signOut(); if (error) throw error; }
      await authChanged(null); message('Signed out. Normal play is always available.');
    });
  }
  function trapFocus(e) {
    const root = adPanel || panel;
    if (!root) return;
    if (e.key === 'Escape') { if (!adPanel) closeShop(); return; }
    if (e.key !== 'Tab') return;
    const nodes = [...root.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]')].filter(n => n.getClientRects().length);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }
  async function init() {
    $('shopBtn').onclick = openShop; $('startShopBtn').onclick = openShop;
    $('shopClose').onclick = closeShop; $('shopModal').onclick = e => { if (e.target === $('shopModal')) closeShop(); };
    $('claimBtn').onclick = claim; $('signOutBtn').onclick = signOut;
    $('googleLink').onclick = linkGoogle;
    $('googleSignIn').onclick = googleLogin; $('sendCodeBtn').onclick = sendCode; $('verifyCodeBtn').onclick = verifyCode;
    $('refreshWallet').onclick = () => exclusive(refresh);
    document.querySelectorAll('[data-product]').forEach(btn => btn.onclick = () => buy(btn.dataset.product));
    $('reviveCrystal').onclick = () => revive('crystal'); $('reviveDaily').onclick = () => revive('daily'); $('reviveAd').onclick = () => revive('ad');
    $('reviveFind').onclick = openShop;
    $('reviveDawnLocked').onclick = () => { openShop(); document.querySelector('.no-ads-product')?.scrollIntoView({ block: 'nearest' }); };
    $('reviveResume').onclick = () => { if (!isBlocking()) game().resumeRevival(); };
    document.addEventListener('keydown', trapFocus);
    const authError = oauthError();
    let authReturn;
    try { authReturn = JSON.parse(sessionStorage.getItem(authReturnKey) || 'null'); sessionStorage.removeItem(authReturnKey); } catch {}
    let snapshot;
    try { snapshot = JSON.parse(sessionStorage.getItem('bioconnect:return-game') || 'null'); sessionStorage.removeItem('bioconnect:return-game'); } catch {}
    if (snapshot) game().restore(snapshot);
    if (test) { test.onAuth(next => { authChanged(next); }); await authChanged(await test.getSession()); }
    else if (client()) {
      client().auth.onAuthStateChange((_event, next) => { setTimeout(() => authChanged(next), 0); });
      try { const { data, error } = await client().auth.getSession(); if (error) throw error; await authChanged(data.session); }
      catch { known = false; wallet = null; await game().accountChanged(null); draw(); }
    } else { known = false; await game().accountChanged(null); draw(); }
    if (!authError && uid() && wallet && !pending) message('Signed in. Your account is ready.');
    if (authError) {
      clearOAuthError();
      openShop(); message(authError.text);
    } else await finishAuthReturn(authReturn);
    const payment = new URLSearchParams(location.search).get('payment');
    if (payment) {
      if (!pending && !authError) { openShop(); message(payment === 'returned' ? 'Checkout returned. Only verified payments appear in your balance. Press Refresh to check.' : 'Checkout cancelled. No purchase has been granted.'); }
      const cleaned = new URL(location.href); cleaned.searchParams.delete('payment');
      history.replaceState(null, '', cleaned.href);
    }
    refreshTimer = setInterval(() => { if (!document.hidden && uid() && !busy) refresh(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) refresh(); });
  }
  return { init, draw, isBlocking, newGame, openShop, summary: () => ({ owner: uid(), wallet, busy, pending: !!pending, known }) };
})();
