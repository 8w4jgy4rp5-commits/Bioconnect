// Explicit localhost guest verification. Auth/entitlements are never simulated here.
(() => {
  'use strict';
  if (location.hostname !== '127.0.0.1') throw Error('Loopback verification only');
  const events = [];
  window.addEventListener('bioconnect:ad-test', e => {
    const {event,type,status} = e.detail;
    events.push({event,type,status}); if (events.length > 30) events.shift(); inspect();
  });
  function inspect() {
    const report = document.getElementById('adsTestReport'); if (!report || !window.BioEconomy || !window.BioGame) return;
    const account = BioEconomy.summary(), sdk = document.querySelector('script[src*="pagead/js/adsbygoogle.js"]');
    report.textContent = JSON.stringify({provider:'Google official TEST mode; no live ads or payments',
      signedIn:!!account.owner, known:account.known, busy:account.busy,
      wallet:account.wallet && {crystals:account.wallet.crystals,no_ads:account.wallet.no_ads},
      game:BioGame.summary(),paused:state.paused,audio:BioAudio.band(),
      sdkTestMode:sdk?.getAttribute('data-adbreak-test') || null, events},null,2);
  }
  function stage() {
    if (!BioEconomy.summary().known) throw Error('Wait for the TEST session check.');
    if (BioEconomy.summary().owner) throw Error('Use this verification entry as a guest.');
    if (BioEconomy.isBlocking()) throw Error('Close the menu or store before staging.');
    newGame(); BioGame.pause();
    el.startScreen.hidden=true; document.body.classList.remove('is-modal'); state.revivalWait=false;
    state.cells.fill(null);
    ['stone','bones','scrub','sprout','grass','rabbit','fox','deer','zebra','buffalo','wolf','bear','lion','tiger'].forEach((kind,i)=>state.cells[i]={kind,clock:9,born:'raised'});
    state.score=55555; state.ticks=103; state.stock=['grass','fox','rabbit']; state.topKind='tiger';
    render(); endRun(); inspect();
    document.getElementById('sandboxAdsVerification').open=false;
  }
  function init() {
    const details=document.createElement('details'); details.id='sandboxAdsVerification';
    details.style.cssText='position:fixed;bottom:0;left:0;z-index:9500;max-width:min(460px,100%);background:#fff;color:#222;border:2px solid #674493;font:12px sans-serif;padding:6px;max-height:65vh;overflow:auto';
    const title=document.createElement('summary');title.textContent='Official TEST ad controls';details.appendChild(title);
    const note=document.createElement('p');note.textContent='Guest verification on a separate localhost origin. Google documentation sample client; official TEST mode only. This does not verify publisher approval. Do not sign in here.';details.appendChild(note);
    for (const [id,label,fn] of [['adsStage','Stage an ended game',stage],['adsInspect','Inspect game and ads',inspect]]) {
      const button=document.createElement('button');button.id=id;button.textContent=label;
      button.onclick=()=>{try{fn();}catch(e){document.getElementById('adsTestReport').textContent=e.message;}};details.appendChild(button);
    }
    const report=document.createElement('pre');report.id='adsTestReport';report.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
    details.appendChild(report);document.body.appendChild(details);inspect();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
