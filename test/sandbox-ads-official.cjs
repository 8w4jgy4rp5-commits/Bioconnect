// Opt-in real Google SDK integration. Fresh guest browser, TEST mode, live ad endpoints blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {engine,launchTestBrowser,evidenceDir}=require('./browser-runtime.cjs'),{createSandboxServer}=require('./sandbox-server.cjs');
(async()=>{
 const out=evidenceDir('sandbox');fs.mkdirSync(out,{recursive:true});
 const server=await createSandboxServer(0,{testAds:true});let browser;
 const proof={engine,platform:process.platform,provider:'Real Google SDK; documentation sample client; data-adbreak-test=on; guest; payments OFF',
   cases:[],network:[],errors:[],blockedByCsp:[]};
 try{
   browser=await launchTestBrowser();
   proof.browserVersion=browser.version();
   for(const kind of ['complete','dismiss','next']) {
     const context=await browser.newContext(engine==='webkit'?{viewport:{width:375,height:812},isMobile:true,hasTouch:true}:{viewport:{width:960,height:850}}),page=await context.newPage();
     try{
       await page.addInitScript(()=>{
         window.adsCspViolations=[];
         document.addEventListener('securitypolicyviolation',e=>{
           try{const u=new URL(e.blockedURI);if(u.protocol==='https:')adsCspViolations.push({directive:e.effectiveDirective,host:u.hostname,path:u.pathname});}catch{}
         });
       });
       page.on('pageerror',e=>proof.errors.push(e.message.slice(0,160)));
       await page.route('**/*',async route=>{
         const request=route.request(),url=new URL(request.url());if(url.origin===server.url)return route.continue();
         const allowed=url.protocol==='https:'&&url.hostname==='pagead2.googlesyndication.com'
           &&request.resourceType()==='script'&&(/^\/pagead\/(js|managed\/js)\//).test(url.pathname);
         proof.network.push({case:kind,host:url.hostname,path:url.pathname,type:request.resourceType(),allowed});
         return allowed?route.continue():route.abort();
       });
       page.on('response',r=>{const u=new URL(r.url());if(u.hostname==='pagead2.googlesyndication.com'){
         const row=proof.network.findLast(n=>n.case===kind&&n.host===u.hostname&&n.path===u.pathname);if(row)row.status=r.status();
       }});
       await page.goto(server.url);await page.waitForFunction(()=>window.BioEconomy?.summary().known);
       assert.equal(await page.evaluate(()=>BioEconomy.summary().owner),null);
       assert.equal(await page.evaluate(()=>BioMonetizationConfig.paymentsEnabled),false);
       await page.locator('#sandboxAdsVerification summary').click();await page.locator('#adsStage').click();
       assert.equal(await page.locator('#sandboxAdsVerification').evaluate(node=>node.open),false);await page.locator('#gameover').waitFor();
       const before=await page.evaluate(()=>BioGame.snapshot());
       await page.locator(kind==='next'?'#goAgain':'#reviveAd').click();
       const frame=page.frameLocator('#aswift-fake:visible');
       await frame.locator('.adText').waitFor({state:'visible',timeout:15000});
       assert.equal(await frame.locator('.adText').textContent(),kind==='next'?'Interstitial ad example':'Rewarded ad example');
       assert.equal(await page.evaluate(()=>state.paused&&BioAudio.band().adMuted),true);
       await page.screenshot({path:path.join(out,'google-official-'+kind+'-shown.png')});
       if(kind==='dismiss'){
         await frame.locator('#close-button').click();
         await frame.locator('#close-ad-button').waitFor({state:'visible'});
         await page.screenshot({path:path.join(out,'google-official-dismiss-confirm.png')});
         await frame.locator('#close-ad-button').click();
       }
       else {
         if(kind==='complete')await frame.locator('#count-down-container').waitFor({state:'hidden',timeout:15000});
         await frame.locator('#dismiss-button-element').click();
       }
       try{await page.waitForFunction(()=>!BioEconomy.summary().busy,{},{timeout:5000});}
       catch(e){
         const ui=await frame.locator('body').innerText();
         console.log('TEST close UI '+kind+' '+ui);
         console.log(await frame.locator('button,[id]').evaluateAll(nodes=>nodes.map(n=>({id:n.id,text:n.innerText?.slice(0,100)}))));
         await page.screenshot({path:path.join(out,'google-official-'+kind+'-close.png')});throw e;
       }
       if(kind==='next'){
         await page.locator('#countdown').waitFor({state:'hidden'});
         assert.equal(await page.evaluate(()=>state.paused),false);
       }
       await page.locator('#sandboxAdsVerification summary').click();await page.locator('#adsInspect').click();
       const report=JSON.parse(await page.locator('#adsTestReport').textContent()),after=await page.evaluate(()=>BioGame.snapshot());
       if(kind==='complete') {
         await page.locator('#sandboxAdsVerification summary').click();await page.locator('#reviveResume').waitFor();
         assert.equal(after.revived,true);assert.equal(after.runId,before.runId);assert.equal(after.score,before.score);
         assert.equal(after.ticks,before.ticks);assert.deepEqual(after.stock,before.stock);
         assert.equal(await page.evaluate(()=>state.paused&&state.revivalWait),true);
         assert.ok(report.events.some(e=>e.event==='adViewed'));
       } else if(kind==='dismiss') {
         assert.equal(after.revived,false);assert.equal(after.over,true);assert.equal(after.runId,before.runId);
         assert.ok(report.events.some(e=>e.event==='adDismissed'));
       } else {assert.equal(after.over,false);assert.notEqual(after.runId,before.runId);}
       assert.equal(await page.evaluate(()=>BioAudio.band().adMuted),false);
       proof.blockedByCsp.push(...await page.evaluate(()=>adsCspViolations));
       proof.cases.push({kind,events:report.events,state:{game:report.game,paused:report.paused,audio:report.audio},gamePreserved:kind==='complete'});
       await page.screenshot({path:path.join(out,'google-official-'+kind+'-result.png')});
       if(kind==='complete'){
         await page.locator('#reviveResume').click();
         assert.equal(await page.evaluate(()=>state.revivalWait||state.paused),false);
         proof.cases.at(-1).resumeConfirmed=true;
       }
       console.log('ok official Google TEST '+kind);
     }finally{await context.close();}
   }
   assert.deepEqual(proof.errors,[]);
   assert.ok(proof.network.some(n=>n.status===200&&n.path==='/pagead/js/adsbygoogle.js'));
   assert.ok(proof.network.filter(n=>n.allowed).every(n=>n.host==='pagead2.googlesyndication.com'&&n.type==='script'));
   proof.allowedExternalRequests=proof.network.filter(n=>n.allowed).length;
   fs.writeFileSync(path.join(out,'google-official-test-result.json'),JSON.stringify(proof,null,2));
   console.log(JSON.stringify(proof,null,2));
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
