// Explicit localhost TEST harness. No mock Auth, wallet, payment or grants.
(() => {
  'use strict';
  const base = 'https://jcbohkzjmgbpsaqkrirg.supabase.co';
  if (location.hostname !== '127.0.0.1') throw Error('Loopback verification only');
  const nativeFetch = window.fetch.bind(window);
  let mode = 'online', lastTransport = 'No fault used', before = null;
  const heldRevivals = [], revivalRequests = [];
  function releaseHeld() {
    mode = 'online';
    for (const release of heldRevivals.splice(0)) release();
  }
  window.__BIOCONNECT_SANDBOX_FETCH__ = async (input, options) => {
    const url = typeof input === 'string' ? input : input.url;
    const target = url === base || url.startsWith(base + '/');
    if (target && mode === 'offline') throw new TypeError('TEST transport disconnected before sending');
    const revival = target && url === base + '/rest/v1/rpc/bioconnect_revive';
    if (revival && mode === 'hold') await new Promise(resolve => {
      heldRevivals.push(resolve); inspect();
    });
    if (target && mode === 'offline') throw new TypeError('TEST transport disconnected before sending');
    const drop = revival && mode === 'drop';
    // Consume the one-shot arm before awaiting, so parallel requests cannot both drop.
    if (drop) mode = 'online';
    // Timing/status only: never record request headers, payloads, owner or tokens.
    const timing = revival ? {sentAt:Date.now(),finishedAt:null,status:null} : null;
    if (timing) { revivalRequests.push(timing); if (revivalRequests.length > 8) revivalRequests.shift(); }
    let response;
    try { response = await nativeFetch(input, options); if (timing) timing.status = response.status; }
    finally { if (timing) timing.finishedAt = Date.now(); }
    if (drop && response.ok) {
      await response.arrayBuffer();
      lastTransport = 'Real TEST revival returned HTTP ' + response.status + '; response withheld from app';
      throw new TypeError('TEST revival response lost after server success');
    }
    if (drop) lastTransport = 'TEST request rejected: HTTP ' + response.status + '; response passed through';
    return response;
  };
  const safeWallet = w => w && ({crystals:w.crystals,no_ads:w.no_ads,daily_available:w.daily_available});
  const setReport = data => { document.getElementById('verificationReport').textContent = JSON.stringify(data,null,2); };
  function inspect() {
    const economy = BioEconomy.summary(), snapshot = BioGame.snapshot();
    setReport({providers:'Real Supabase TEST Auth/DB; staged game and injected transport faults',
      signedIn:!!economy.owner, wallet:safeWallet(economy.wallet),busy:economy.busy,pending:economy.pending,
      transport:mode,lastTransport,queuedRevivalRequests:heldRevivals.length,revivalRequests,game:snapshot,summary:BioGame.summary(),
      paused:state.paused,localHistory:recordHistory,
      recoveryStored:!!economy.owner && !!localStorage.getItem('bioconnect:revival-pending:'+economy.owner),
      before:before || JSON.parse(sessionStorage.getItem('bioconnect:verification-before') || 'null')});
  }
  function stage() {
    if (BioEconomy.isBlocking()) throw Error('Close the shop/menu and confirm any pending revival first');
    if (!BioEconomy.summary().owner) throw Error('Sign in with the TEST account first');
    newGame(); BioGame.pause();
    el.startScreen.hidden=true;document.body.classList.remove('is-modal');state.revivalWait=false;
    state.cells.fill(null);
    ['stone','bones','scrub','sprout','grass','rabbit','fox','deer','zebra','buffalo','wolf','bear','lion','tiger'].forEach((kind,i)=>state.cells[i]={kind,clock:9,born:'raised'});
    state.score=55555;state.ticks=103;state.stock=['grass','fox','rabbit'];state.topKind='tiger';
    // Ordinary endRun records the staged score through the existing real TEST store.
    render();endRun();before=BioGame.snapshot();
    sessionStorage.setItem('bioconnect:verification-before',JSON.stringify(before));inspect();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const details=document.createElement('details');details.id='sandboxVerification';
    details.style.cssText='position:fixed;bottom:0;left:0;z-index:9500;max-width:min(520px,100%);background:#fff;color:#222;border:2px solid #674493;font:12px sans-serif;padding:6px;max-height:70vh;overflow:auto';
    const summary=document.createElement('summary');summary.textContent='TEST verification controls';details.appendChild(summary);
    const note=document.createElement('p');note.textContent='Staged game only. Auth, wallet, revival and record requests use the real TEST service. Faults affect this tab only; purchases/ads OFF.';details.appendChild(note);
    const action=(id,label,fn)=>{const button=document.createElement('button');button.id=id;button.textContent=label;button.style.margin='3px';button.onclick=async()=>{try{await fn();}catch(e){setReport({error:e.message});}};details.appendChild(button);};
    action('verifyStage','Stage a fresh ended game',stage);
    action('verifyDrop','Lose next revival response',()=>{mode='drop';inspect();});
    action('verifyOffline','Disconnect TEST requests',()=>{mode='offline';inspect();});
    action('verifyOnline','Restore TEST connection',()=>{releaseHeld();inspect();});
    action('verifyHold','Hold revival requests before sending',()=>{mode='hold';inspect();});
    action('verifyRelease','Release held revival requests',()=>{releaseHeld();inspect();});
    action('verifyInspect','Inspect game and wallet',inspect);
    action('verifyRecords','Read TEST saved score',async()=>{
      if(!BioEconomy.summary().owner) throw Error('TEST sign-in required');
      const saved=await AppSync.pull('ecosystem-puzzle','score');
      setReport({providers:'Real TEST record GET',saved:saved?.value?.d || null,localHistory:recordHistory});
    });
    const report=document.createElement('pre');report.id='verificationReport';report.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';details.appendChild(report);document.body.appendChild(details);
  });
})();
