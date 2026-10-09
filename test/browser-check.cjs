// Real browser interactions against disposable SQL + explicitly simulated providers.
const {engine,launchTestBrowser,evidenceDir}=require('./browser-runtime.cjs');const assert=require('assert/strict');const path=require('path'),fs=require('fs');
const {randomUUID}=require('crypto');const {createLocalServer}=require('./local-server.cjs');
async function main(){
  const server=await createLocalServer();
  let browser;
  try { browser=await launchTestBrowser(); }
  catch(error) { await server.close(); throw error; }
  const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const out=evidenceDir('monetization');fs.mkdirSync(out,{recursive:true});
  let checks=0;const ok=name=>{checks++;console.log('ok '+name)};
  const stage=async()=>{
    await page.evaluate(()=>{ if(overTimer){clearTimeout(overTimer);overTimer=0;}hideWord();
      state.cells.fill(null);['stone','bones','scrub','sprout','grass','rabbit','fox','deer','zebra','buffalo','wolf','bear','lion','tiger'].forEach((kind,i)=>state.cells[i]={kind,clock:9,born:'raised'});
      state.score=55555;state.ticks=103;state.stock=['grass','fox','rabbit'];state.topKind='tiger';state.over=false;state.paused=true;render();endRun();
    });await page.locator('#gameover').waitFor({state:'visible'});
  };
  const start=async()=>{await page.goto(server.url);await page.locator('#startBtn').focus();await page.locator('#startBtn').press('Enter');await page.locator('#countdown').waitFor({state:'hidden'});};
  const shop=async()=>{await page.locator('#menuBtn').click();await page.locator('#shopBtn').click();};
  const login=async(email='a@example.test')=>{await page.locator('#signInEmail').fill(email);await page.locator('#sendCodeBtn').click();await page.locator('#signInCode').fill('123456');await page.locator('#verifyCodeBtn').click();await page.waitForFunction(()=>BioEconomy.summary().wallet!==null);};
  try{
    // A separate browser profile covers hosted-checkout return before PLAY.
    const titleContext=await browser.newContext({viewport:{width:375,height:812}});
    const titlePage=await titleContext.newPage();
    try {
      await titlePage.goto(server.url);await titlePage.locator('#startShopBtn').click();
      await titlePage.locator('#signInEmail').fill('a@example.test');await titlePage.locator('#sendCodeBtn').click();
      await titlePage.locator('#signInCode').fill('123456');await titlePage.locator('#verifyCodeBtn').click();
      await titlePage.waitForFunction(()=>BioEconomy.summary().wallet!==null);
      const titleBefore=await titlePage.evaluate(()=>BioGame.snapshot());
      assert.equal(titleBefore.startScreenVisible,true);
      await titlePage.locator('[data-product="crystals5"]').click();await titlePage.locator('#unpaid').click();
      await titlePage.locator('#shopModal').waitFor({state:'visible'});
      assert.deepEqual(await titlePage.evaluate(()=>BioGame.snapshot()),titleBefore);
      ok('title Checkout return retains all game fields and title state');
      await titlePage.locator('#shopClose').click();
      assert.equal(await titlePage.locator('#startScreen').isVisible(),true);
      assert.equal(await titlePage.locator('#reviveResume').isVisible(),false);
      assert.equal(await titlePage.evaluate(()=>state.paused),true);
      ok('title purchase return waits for PLAY with no revival Resume');
      await titlePage.locator('#startBtn').focus();await titlePage.locator('#startBtn').press('Enter');await titlePage.locator('#countdown').waitFor({state:'hidden'});
      assert.equal(await titlePage.evaluate(()=>state.paused||state.revived||state.revivalWait),false);
      ok('PLAY starts normally after title purchase return');
    } finally { await titleContext.close(); }
    assert.ok(!(await (await fetch(server.url)).text()).includes('static.cloudflareinsights.com'),'Local simulations strip production analytics');
    await start();assert.equal(await page.evaluate(()=>BioEconomy.summary().owner),null);ok('guest normal play without login');
    await stage();await page.screenshot({path:path.join(out,'game-over-mobile.png')});
    await page.locator('#reviveAd').click();await page.locator('[data-ad="fail"]').click();
    await page.waitForFunction(()=>!BioEconomy.summary().busy);assert.equal(await page.evaluate(()=>state.over),true);assert.equal(await page.locator('#gameover').isVisible(),true);ok('reward ad failure returns to game over without spending');
    await page.locator('#reviveAd').click();await page.locator('[data-ad="cancel"]').click();await page.waitForFunction(()=>!BioEconomy.summary().busy);
    assert.equal(await page.evaluate(()=>state.revived),false);ok('cancelled reward does not revive');
    const before=await page.evaluate(()=>BioGame.snapshot());
    await page.locator('#reviveAd').click();const during=await page.evaluate(()=>({ticks:state.ticks,paused:state.paused,band:BioAudio.band()}));
    await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>state.ticks),during.ticks);assert.equal(during.band.adMuted,true);ok('ad holds game clock and mutes audio');
    await page.locator('[data-ad="complete"]').click();await page.locator('#reviveResume').waitFor({state:'visible'});
    const after=await page.evaluate(()=>BioGame.snapshot());assert.equal(after.score,before.score);assert.equal(after.ticks,before.ticks);assert.deepEqual(after.stock,before.stock);assert.equal(after.cells[0],null);assert.equal(after.cells[7].clock,0);
    assert.match(await page.locator('#scoreValue').textContent(),/💎$/);await page.screenshot({path:path.join(out,'revived-mobile.png')});ok('reward completion revives, retains run and marks score');
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await page.evaluate(()=>state.paused),true);
    await page.locator('#reviveResume').click();assert.equal(await page.evaluate(()=>state.revivalWait),false);ok('revival waits for explicit Resume');
    await stage();assert.equal(await page.locator('#reviveAd').isVisible(),false);assert.equal(await page.locator('#reviveCrystal').isVisible(),false);ok('second revival impossible');
    await page.locator('#goAgain').click();await page.locator('[data-ad="fail"]').click();await page.locator('#countdown').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>state.revived),false);ok('New Game starts after failed interstitial and resets revival');
    await shop();await login();await page.locator('#claimBtn').click();await page.waitForFunction(()=>BioEconomy.summary().wallet?.crystals===3);ok('email code login and one-time three-Crystal claim');
    await page.screenshot({path:path.join(out,'store-mobile.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);ok('375px store has no horizontal overflow');
    await page.locator('#shopClose').click();await page.locator('#menuClose').click();await stage();
    await page.locator('#reviveCrystal').click();await page.locator('#reviveResume').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>BioEconomy.summary().wallet.crystals),2);assert.equal(await page.locator('[data-ad="complete"]').count(),0);ok('Crystal revival spends one without an ad');
    await page.locator('#reviveResume').click();await shop();
    await page.locator('[data-product="crystals5"]').click();await page.locator('#unpaid').click();await page.locator('#shopModal').waitFor({state:'visible'});await page.waitForFunction(()=>BioEconomy.summary().wallet?.crystals===2);ok('checkout return alone grants nothing');
    await page.locator('[data-product="crystals5"]').click();await page.locator('#pay').click();await page.locator('#shopModal').waitFor({state:'visible'});await page.waitForFunction(()=>BioEconomy.summary().wallet?.crystals===7);ok('confirmed simulated payment grants five');
    await page.locator('[data-product="crystals5"]').click();await page.locator('#pay').click();await page.waitForFunction(()=>BioEconomy.summary().wallet?.crystals===12);ok('repeat Crystal purchase creates a new order after confirmation');
    await page.locator('[data-product="no_ads"]').click();await page.locator('#pay').click();await page.waitForFunction(()=>BioEconomy.summary().wallet?.no_ads);await page.screenshot({path:path.join(out,'no-ads-store-mobile.png')});ok('one-time entitlement loads after confirmed simulated payment');
    await page.locator('#shopClose').click();await page.evaluate(()=>newGame());await stage();assert.equal(await page.locator('#reviveAd').isVisible(),false);
    await page.locator('#reviveDaily').click();await page.locator('#reviveResume').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>BioEconomy.summary().wallet.crystals),12);ok('purchaser daily revival without spending or ads');
    await page.locator('#reviveResume').click();await stage();await page.locator('#goAgain').click();await page.locator('#countdown').waitFor({state:'hidden'});assert.equal(await page.locator('[data-ad="complete"]').count(),0);ok('purchaser New Game skips all ads');
    await stage();assert.equal(await page.locator('#reviveDaily').isVisible(),false);assert.equal(await page.locator('#reviveAd').isVisible(),false);
    await page.locator('#reviveCrystal').click();await page.locator('#reviveResume').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>BioEconomy.summary().wallet.crystals),11);ok('daily exhausted purchaser uses one Crystal');
    await page.locator('#reviveResume').click();await shop();await page.locator('#signOutBtn').click();await page.waitForFunction(()=>BioEconomy.summary().owner===null);await login('b@example.test');assert.equal(await page.evaluate(()=>BioEconomy.summary().wallet.crystals),0);assert.equal(await page.evaluate(()=>BioEconomy.summary().wallet.no_ads),false);ok('logout and account switching clear balances and rights');
    await page.locator('#claimBtn').click();await page.waitForFunction(()=>BioEconomy.summary().wallet.crystals===3);await page.locator('#shopClose').click();await page.locator('#menuClose').click();
    await page.evaluate(()=>newGame());await stage();
    await fetch(server.url+'/__test/drop-next',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    await page.locator('#reviveCrystal').click();await page.waitForFunction(()=>BioEconomy.summary().pending&&!BioEconomy.summary().busy);assert.equal(await page.locator('#goAgain').isDisabled(),true);ok('lost consume response locks alternative actions and keeps durable snapshot');
    await page.evaluate(()=>window.__BIOCONNECT_TEST_ADAPTER__.signIn());await page.waitForFunction(()=>BioEconomy.summary().wallet?.no_ads===true);
    await page.locator('#reviveCrystal').click();await page.locator('#shopModal').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>BioEconomy.summary().wallet.crystals),11);ok('pending revival cannot spend from a switched account');
    await page.evaluate(()=>window.__BIOCONNECT_TEST_ADAPTER__.verifyCode('b@example.test','123456'));await page.waitForFunction(()=>BioEconomy.summary().owner?.endsWith('2'));
    await page.locator('#shopClose').click();
    await page.reload();await page.waitForFunction(()=>BioEconomy.summary().pending&&!BioEconomy.summary().busy);
    await fetch(server.url+'/__test/drop-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    await page.locator('#reviveCrystal').click();await page.locator('#reviveResume').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>BioEconomy.summary().wallet.crystals),2);ok('reload and retry recover charged revival once');
    await page.setViewportSize({width:320,height:568});await page.screenshot({path:path.join(out,'revived-320.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const resumeBox=await page.locator('#reviveResume').boundingBox();assert.ok(resumeBox.y>=0&&resumeBox.y+resumeBox.height<=568);ok('320px mobile viewport with visible Resume and unwrapped score marker');
    await page.locator('#reviveResume').click();await shop();await page.locator('#signOutBtn').click();await page.locator('#googleSignIn').click();await page.waitForFunction(()=>BioEconomy.summary().owner?.endsWith('1'));ok('Google login control with explicitly simulated provider');
    await page.locator('#shopClose').click();await page.locator('#menuClose').click();await page.evaluate(()=>newGame());await stage();
    async function holdWalletWhileSwitching(action) {
      let held=false, release, started;
      const waitForStart=new Promise(r=>started=r), gate=new Promise(r=>release=r);
      const handler=async route=>{
        const body=route.request().postDataJSON();
        if(!held && body.name==='bioconnect_wallet' && body.owner.endsWith('1')) {held=true;started();await gate;}
        await route.continue();
      };
      await page.route('**/__test/rpc',handler);
      await action();await waitForStart;
      await page.evaluate(()=>window.__BIOCONNECT_TEST_ADAPTER__.verifyCode('b@example.test','123456'));
      await page.waitForFunction(()=>BioEconomy.summary().owner?.endsWith('2')&&BioEconomy.summary().wallet!==null);
      release();await page.waitForFunction(()=>!BioEconomy.summary().busy);await page.unroute('**/__test/rpc',handler);
    }
    await holdWalletWhileSwitching(()=>page.locator('#reviveCrystal').click());
    assert.equal(await page.evaluate(()=>BioEconomy.summary().wallet.crystals),2);assert.equal(await page.evaluate(()=>state.over&&!state.revived),true);assert.equal(await page.evaluate(()=>BioEconomy.summary().pending),false);ok('account switch while initial wallet awaits cannot consume the new account');
    await page.evaluate(()=>window.__BIOCONNECT_TEST_ADAPTER__.signIn());await page.waitForFunction(()=>BioEconomy.summary().wallet?.no_ads);await shop();
    const ordersBefore=(await server.db.query('select count(*)::int as n from bioconnect_private.orders where owner_id=$1',['00000000-0000-4000-8000-000000000002'])).rows[0].n;
    await holdWalletWhileSwitching(()=>page.locator('[data-product="crystals5"]').click());
    const ordersAfter=(await server.db.query('select count(*)::int as n from bioconnect_private.orders where owner_id=$1',['00000000-0000-4000-8000-000000000002'])).rows[0].n;
    assert.equal(ordersBefore,ordersAfter);assert.ok(!page.url().includes('checkout-page'));ok('account switch while purchase wallet awaits creates no order for the new account');
    assert.deepEqual(errors,[]);ok('no game JavaScript exceptions');
    // Exercise the production Google adapter with callback fixtures, not the local ad adapter.
    const sdkPage=await context.newPage();const sdkErrors=[];sdkPage.on('pageerror',e=>sdkErrors.push(e.message));
    await sdkPage.addInitScript(()=>{window.supabaseClient={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){}}};});
    await sdkPage.route('**/shared/monetization-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.BioMonetizationConfig={paymentsEnabled:false,adsEnabled:true,adClient:'ca-pub-123456',adTestMode:true}"}));
    await sdkPage.route('https://pagead2.googlesyndication.com/**',r=>r.fulfill({contentType:'text/javascript',body:`
      window.adsbygoogle.push=o=>{
        if(o.onReady)queueMicrotask(o.onReady);
        if(o.type){
          if(window.sdkFailure){queueMicrotask(()=>o.adBreakDone({breakStatus:'noAdPreloaded'}));return;}
          const show=()=>{o.beforeAd();const b=document.createElement('button');b.id='sdkFixtureFinish';b.textContent='Finish SDK callback fixture';b.style.cssText='position:fixed;inset:20px;z-index:5000';document.body.appendChild(b);
            b.onclick=()=>{b.remove();if(window.sdkCancel)o.adDismissed?.();else o.adViewed?.();o.afterAd();o.adBreakDone({breakStatus:'viewed'});};};
          if(o.beforeReward)o.beforeReward(show);else show();
        }
      };` }));
    await sdkPage.goto(server.url+'/plain.html');await sdkPage.locator('#startBtn').press('Enter');await sdkPage.locator('#countdown').waitFor({state:'hidden'});
    await sdkPage.evaluate(()=>{state.cells.fill(null);state.cells[0]={kind:'deer',clock:9};state.score=2222;state.over=true;state.paused=true;render();el.gameover.hidden=false;BioEconomy.draw();});
    await sdkPage.locator('#reviveAd').click();await sdkPage.locator('#sdkFixtureFinish').waitFor({state:'visible'});
    assert.equal(await sdkPage.evaluate(()=>BioAudio.band().adMuted),true);await sdkPage.locator('#sdkFixtureFinish').click();await sdkPage.locator('#reviveResume').waitFor({state:'visible'});ok('production Google callback adapter: adViewed then completion grants revival');
    await sdkPage.locator('#reviveResume').click();await sdkPage.evaluate(()=>{newGame();state.over=true;state.paused=true;render();el.gameover.hidden=false;window.sdkFailure=true;BioEconomy.draw();});
    await sdkPage.locator('#reviveAd').click();await sdkPage.waitForFunction(()=>!BioEconomy.summary().busy);assert.equal(await sdkPage.evaluate(()=>state.over&&!state.revived),true);ok('production Google no-fill callback keeps game over');
    await sdkPage.locator('#goAgain').click();await sdkPage.locator('#countdown').waitFor({state:'hidden'});assert.equal(await sdkPage.evaluate(()=>state.over),false);ok('production Google no-fill interstitial starts New Game');
    assert.deepEqual(sdkErrors,[]);await sdkPage.close();
    const offlinePage=await context.newPage();await offlinePage.goto(server.url+'/plain.html');
    await offlinePage.waitForFunction(()=>scoreStore!==null && metStore!==null);
    await offlinePage.locator('#startBtn').press('Enter');await offlinePage.locator('#countdown').waitFor({state:'hidden'});
    await offlinePage.locator('.cell[data-i="0"]').click();
    await offlinePage.evaluate(()=>{state.score=1000000;bankScore();state.over=true;recordRun();met.add('deer');writeMet();});
    await offlinePage.reload();await offlinePage.waitForFunction(()=>scoreStore!==null&&metStore!==null);
    assert.equal(await offlinePage.evaluate(()=>state.best),1000000);assert.equal(await offlinePage.evaluate(()=>met.has('deer')),true);assert.ok(await offlinePage.evaluate(()=>recordHistory.length>0));ok('missing Auth SDK preserves offline best, history and discoveries');
    await offlinePage.close();
    const failedAuth=await context.newPage();await failedAuth.addInitScript(()=>{window.supabaseClient={auth:{getSession:async()=>{throw Error('fixture Auth offline')},onAuthStateChange(){}}};});
    await failedAuth.goto(server.url+'/plain.html');await failedAuth.waitForFunction(()=>scoreStore!==null&&metStore!==null);
    assert.equal(await failedAuth.evaluate(()=>state.best),1000000);assert.equal(await failedAuth.evaluate(()=>BioEconomy.summary().wallet),null);ok('Auth exception falls back to local records without financial grants');await failedAuth.close();
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({engine,browserVersion:browser.version(),platform:process.platform,checks,errors,providers:'local simulations, not production connections'},null,2));
    console.log(checks+' '+engine+' browser checks passed; providers simulated.');
  }finally{await context.close();await browser.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
