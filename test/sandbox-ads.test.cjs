// Callback/boundary fixtures only. No Google requests, real accounts or grants.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {engine,launchTestBrowser,evidenceDir}=require('./browser-runtime.cjs');
const {createSandboxServer}=require('./sandbox-server.cjs');
(async()=>{
 let checks=0,browser;const contexts=[],ok=name=>{checks++;console.log('ok '+name)};
 for(const options of [{testAds:'true'},{testAds:true,testPayments:true},{testAds:true,revivalTest:true}])
   await assert.rejects(createSandboxServer(0,options));
 const normal=await createSandboxServer(0);
 try{
   assert.equal((await fetch(normal.url+'/__sandbox/ads-test.js')).status,403);
   assert.ok(!(await(await fetch(normal.url+'/?testAds=true')).text()).includes('/__sandbox/ads-test.js'));
   assert.match(await(await fetch(normal.url+'/shared/monetization-config.js')).text(),/adsEnabled:false/);
 }finally{await normal.close()}
 ok('normal preview stays ads OFF; explicit boolean and isolated modes required');
 const server=await createSandboxServer(0,{testAds:true});
 try{
   const config=await(await fetch(server.url+'/shared/monetization-config.js')).text();
   assert.match(config,/paymentsEnabled:false,adsEnabled:true,adClient:"ca-pub-123456789",adTestMode:true/);
   const index=await fetch(server.url);
   assert.match(await index.text(),/Official Google TEST ads/);
   const csp=index.headers.get('content-security-policy');
   assert.match(csp,/frame-src 'self'/);assert.ok(csp.includes("connect-src 'self' https://jcbohkzjmgbpsaqkrirg.supabase.co"));
   assert.ok(!csp.includes('doubleclick.net'));
   for(const p of ['/test/sandbox-ads-ui.js','/supabase/sandbox/project.json'])
     assert.equal((await fetch(server.url+p)).status,403);
   ok('official TEST mode is fixed, uses documentation sample, private sources protected');
   browser=await launchTestBrowser();
   const errors=[];
   async function fixture(mode='complete',account='guest') {
     const context=await browser.newContext({viewport:{width:375,height:812}});
     contexts.push(context);const page=await context.newPage();page.sdkRequests=0;
     page.on('pageerror',e=>errors.push(e.message));
     await page.addInitScript(({mode,account})=>{
       const session=account==='guest'?null:{user:{id:'00000000-0000-0000-0000-000000000001'}};
       let authObserver;window.fixtureCalls=[];window.fixtureMode=mode;
       window.fixtureClient={auth:{
         getSession:async()=>({data:{session}}),
         onAuthStateChange:cb=>{authObserver=cb},
       },rpc:async name=>{fixtureCalls.push(name);return account==='unknown'?{error:Error('fixture offline')}:{data:{crystals:6,no_ads:account==='owned',daily_available:true,welcome_claimed:true}}}};
       window.fixtureSignOut=()=>authObserver('SIGNED_OUT',null);
       window.AppSync={store:async(_slug,key)=>{let value=key==='score'?{best:0,rules:20,history:[]}:{kinds:[]};
         return {get:()=>value,set:async next=>{value=next},subscribe:()=>()=>{},dispose:()=>{}};}};
     },{mode,account});
     await page.route('**/*',async route=>{
       const url=new URL(route.request().url());
       if(url.origin===server.url) {
         if(url.pathname==='/shared/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'var supabaseClient=window.fixtureClient;'});
         return route.continue();
       }
       if(url.hostname==='pagead2.googlesyndication.com'&&url.pathname==='/pagead/js/adsbygoogle.js') {
         page.sdkRequests++;if(mode==='sdkFailure')return route.abort();
         return route.fulfill({contentType:'text/javascript',body:`(() => {
           const consume=o=>{
             if(o.onReady){o.onReady();return;}
             window.fixturePlacement=o;
             if(window.fixtureMode==='noFill'){o.adBreakDone({breakStatus:'frequencyCapped'});return;}
             const show=()=>{
               o.beforeAd();const div=document.createElement('div');div.id='fixtureGoogleAd';
               div.style.cssText='position:fixed;inset:0;z-index:10000;background:white;color:black';
               for(const [id,label,viewed] of [['fixtureComplete','Complete fixture ad',true],['fixtureDismiss','Dismiss fixture ad',false]]) {
                 const b=document.createElement('button');b.id=id;b.textContent=label;
                 b.onclick=()=>{div.remove();if(o.type==='reward'){if(viewed)o.adViewed();else o.adDismissed();}o.afterAd();o.adBreakDone({breakStatus:viewed?'viewed':'dismissed'});};
                 div.appendChild(b);
               }document.body.appendChild(div);
             };
             if(o.beforeReward)o.beforeReward(show);else show();
           };
           const queue=window.adsbygoogle;window.adsbygoogle={push:consume};queue.forEach(consume);
         })();`});
       }
       return route.abort();
     });
     await page.goto(server.url);await page.waitForFunction(()=>window.BioEconomy?.summary().known);
     if(account!=='guest'&&account!=='unknown')await page.waitForFunction(()=>BioEconomy.summary().wallet);
     return page;
   }
   async function stage(page,guest=true) {
     if(guest){await page.locator('#sandboxAdsVerification summary').click();await page.locator('#adsStage').click();assert.equal(await page.locator('#sandboxAdsVerification').evaluate(node=>node.open),false,'Successful stage closes the controls automatically');}
     else await page.evaluate(()=>{
       newGame();BioGame.pause();el.startScreen.hidden=true;document.body.classList.remove('is-modal');state.revivalWait=false;
       state.cells.fill(null);state.cells[7]={kind:'tiger',clock:9,born:'raised'};
       state.score=55555;state.ticks=103;state.stock=['grass','fox','rabbit'];render();endRun();
     });
     await page.locator('#gameover').waitFor({state:'visible'});
   }
   const complete=await fixture();await stage(complete);
   const before=await complete.evaluate(()=>BioGame.snapshot());
   await complete.locator('#reviveAd').click();await complete.locator('#fixtureGoogleAd').waitFor();
   assert.equal(await complete.evaluate(()=>BioAudio.band().adMuted&&state.paused),true);
   assert.equal(await complete.evaluate(()=>document.querySelector('script[src*="adsbygoogle.js"]').getAttribute('data-adbreak-test')),'on');
   await complete.waitForTimeout(1100);assert.equal(await complete.evaluate(()=>state.ticks),before.ticks);
   ok('Google adapter pauses clock and mutes audio; TEST attribute is set before load');
   await complete.locator('#fixtureComplete').click();await complete.locator('#reviveResume').waitFor({state:'visible'});
   const after=await complete.evaluate(()=>BioGame.snapshot());
   assert.equal(after.runId,before.runId);assert.equal(after.score,before.score);assert.equal(after.ticks,before.ticks);
   assert.deepEqual(after.stock,before.stock);assert.equal(await complete.evaluate(()=>BioAudio.band().adMuted),false);
   assert.equal(after.revived,true);assert.equal(await complete.evaluate(()=>state.paused&&state.revivalWait),true);
   assert.equal(await complete.evaluate(()=>fixtureCalls.includes('bioconnect_revive')),false);
   ok('completion revives same run, preserves game, waits for Resume, never consumes Crystals');
   await complete.locator('#reviveResume').click();await complete.evaluate(()=>state.over=false);await complete.evaluate(()=>endRun());
   assert.equal(await complete.locator('#reviveAd').isVisible(),false);ok('second rewarded revival in the same game is unavailable');
   const dismiss=await fixture('dismiss');await stage(dismiss);await dismiss.locator('#reviveAd').click();
   await dismiss.locator('#fixtureDismiss').click();await dismiss.waitForFunction(()=>!BioEconomy.summary().busy);
   assert.equal(await dismiss.evaluate(()=>state.over&&!state.revived),true);
   assert.equal(await dismiss.evaluate(()=>BioAudio.band().adMuted),false);
   assert.match(await dismiss.locator('#reviveStatus').textContent(),/No Crystal was spent/);
   ok('dismissal gives no revival and restores audio');
   for(const mode of ['noFill','sdkFailure']) {
     const page=await fixture(mode);await stage(page);await page.locator('#reviveAd').click();
     await page.waitForFunction(()=>!BioEconomy.summary().busy);
     assert.equal(await page.evaluate(()=>state.over&&!state.revived&&!BioAudio.band().adMuted),true);
     ok(mode+' returns to game over without reward or spend');
   }
   const next=await fixture('noFill');await stage(next);const run=await next.evaluate(()=>BioGame.summary().runId);
   await next.locator('#goAgain').click();await next.waitForFunction(()=>!BioEconomy.summary().busy);
   assert.notEqual(await next.evaluate(()=>BioGame.summary().runId),run);assert.equal(await next.evaluate(()=>state.over),false);
   ok('no-fill next-game ad does not block normal replay');
   const owned=await fixture('complete','owned');await stage(owned,false);
   assert.equal(await owned.locator('#reviveAd').isVisible(),false);
   await owned.locator('#goAgain').click();await owned.waitForFunction(()=>!BioEconomy.summary().busy);
   assert.equal(owned.sdkRequests,0);assert.equal(await owned.evaluate(()=>BioEconomy.summary().wallet.crystals),6);
   ok('No Ads owner never loads Google SDK or sees rewarded ad');
   const unknown=await fixture('complete','unknown');await stage(unknown,false);
   assert.equal(await unknown.locator('#reviveAd').isVisible(),false);
   await unknown.locator('#goAgain').click();await unknown.waitForFunction(()=>!BioEconomy.summary().busy);
   assert.equal(unknown.sdkRequests,0);ok('unknown paid entitlement fails closed without advertising');
   await complete.locator('#sandboxAdsVerification summary').click();await complete.locator('#adsInspect').click();
   const report=JSON.parse(await complete.locator('#adsTestReport').textContent());
   assert.ok(report.events.some(e=>e.event==='adBreakDone'&&e.status==='viewed'));
   assert.ok(report.events.every(e=>Object.keys(e).every(k=>['event','type','status'].includes(k))));
   assert.deepEqual(errors,[]);ok('diagnostics contain only callback event/type/status; no page errors');
   const out=evidenceDir('sandbox');fs.mkdirSync(out,{recursive:true});
   fs.writeFileSync(path.join(out,'ad-adapter-result.json'),JSON.stringify({engine,browserVersion:browser.version(),platform:process.platform,checks,errors,providers:'Local Auth/Google SDK fixtures only; no real services'},null,2));
   console.log(checks+' '+engine+' official-ad adapter fixture checks passed; no live Google/Auth/payment requests.');
 }finally{for(const context of contexts)await context.close();if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
