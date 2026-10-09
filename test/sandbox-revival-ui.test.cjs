// Local harness boundary tests. No live login, wallet mutation or TEST grants.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createSandboxServer}=require('./sandbox-server.cjs');
(async()=>{
  await assert.rejects(createSandboxServer(0,{revivalTest:'true'}));
  await assert.rejects(createSandboxServer(0,{revivalTest:true,testPayments:true}));
  const normal=await createSandboxServer(0);
  try{
    assert.equal((await fetch(normal.url+'/__sandbox/revival-test.js')).status,403);
    assert.ok(!(await(await fetch(normal.url+'/?revivalTest=true')).text()).includes('/__sandbox/revival-test.js'));
    assert.ok(!(await(await fetch(normal.url+'/shared/supabase-config.js')).text()).includes('__BIOCONNECT_SANDBOX_FETCH__'));
  }finally{await normal.close();}
  const server=await createSandboxServer(0,{revivalTest:true});let browser;
  try{
    const html=await(await fetch(server.url)).text();
    assert.ok(html.indexOf('/__sandbox/revival-test.js')<html.indexOf('shared/supabase-config.js'));
    assert.match(await(await fetch(server.url+'/shared/monetization-config.js')).text(),/paymentsEnabled:false,adsEnabled:false/);
    assert.equal((await fetch(server.url+'/test/sandbox-revival-ui.js')).status,403);
    browser=await chromium.launch({headless:true,channel:process.env.BIOCONNECT_BROWSER_CHANNEL||'chrome'});
    const page=await browser.newPage();let calls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://jcbohkzjmgbpsaqkrirg.supabase.co/**',r=>{
      calls++;return r.fulfill({status:200,contentType:'application/json',body:'{"marker":"local transport fixture"}'});
    });
    await page.goto(server.url);await page.waitForFunction(()=>window.BioGame&&window.BioEconomy);
    await page.locator('#sandboxVerification summary').click();
    const request=()=>page.evaluate(async()=>{
      try{const r=await __BIOCONNECT_SANDBOX_FETCH__('https://jcbohkzjmgbpsaqkrirg.supabase.co/rest/v1/rpc/bioconnect_revive',{method:'POST',body:'{}'});return {status:r.status,body:await r.json()};}
      catch(e){return {error:e.message};}
    });
    await page.locator('#verifyDrop').click();const first=calls;
    assert.match((await request()).error,/response lost after server success/);assert.equal(calls,first+1);
    assert.equal((await request()).body.marker,'local transport fixture');assert.equal(calls,first+2);
    await page.locator('#verifyOffline').click();const prior=calls;
    assert.match((await request()).error,/disconnected before sending/);assert.equal(calls,prior);
    await page.locator('#verifyOnline').click();assert.equal((await request()).status,200);
    await page.locator('#verifyHold').click();const gatePrior=calls;
    const heldRequest=request();
    await page.waitForFunction(()=>JSON.parse(document.getElementById('verificationReport').textContent).queuedRevivalRequests===1);
    assert.equal(calls,gatePrior,'Held revival must not reach the service before release');
    const walletResponse=await page.evaluate(async()=>await(await __BIOCONNECT_SANDBOX_FETCH__('https://jcbohkzjmgbpsaqkrirg.supabase.co/rest/v1/rpc/bioconnect_wallet',{method:'POST',body:'{}'})).json());
    assert.equal(walletResponse.marker,'local transport fixture','Holding revival must not block wallet/Auth requests');
    await page.locator('#verifyRelease').click();assert.equal((await heldRequest).status,200);
    await page.locator('#verifyInspect').click();
    const gateReport=JSON.parse(await page.locator('#verificationReport').textContent());
    assert.equal(gateReport.queuedRevivalRequests,0);assert.equal(gateReport.transport,'online');
    assert.ok(gateReport.revivalRequests.some(r=>r.status===200&&r.finishedAt>=r.sentAt));
    assert.ok(gateReport.revivalRequests.every(r=>Object.keys(r).sort().join(',')==='finishedAt,sentAt,status'),'Timing evidence must not include credentials or payloads');
    await page.locator('#verifyHold').click();const disconnectedHeld=request();
    await page.waitForFunction(()=>JSON.parse(document.getElementById('verificationReport').textContent).queuedRevivalRequests===1);
    await page.locator('#verifyOnline').click();assert.equal((await disconnectedHeld).status,200,'Restore connection releases waiting revival');
    await page.locator('#verifyStage').click();assert.match(await page.locator('#verificationReport').textContent(),/sign in|Sign in/);
    // Only the stage guard receives a local owner fixture; Auth remains signed out.
    await page.evaluate(()=>{const summary=BioEconomy.summary;BioEconomy.summary=()=>({...summary(),owner:'local-stage-fixture'});});
    await page.locator('#verifyStage').click();await page.locator('#gameover').waitFor({state:'visible'});
    assert.equal(await page.locator('#startScreen').isVisible(),false);
    assert.equal(await page.evaluate(()=>BioGame.snapshot().startScreenVisible),false);
    await page.evaluate(()=>BioGame.revive());await page.locator('#reviveResume').waitFor({state:'visible'});
    assert.equal(await page.locator('#reviveResume').isEnabled(),true);
    assert.equal(await page.evaluate(()=>state.paused&&state.revivalWait),true);
    assert.deepEqual(errors,[]);
    console.log('Local TEST harness boundaries passed: opt-in, private paths, payments/ads OFF, one-shot response loss, pre-send disconnect, revival-only hold/release, credential-free timing, reconnect and unauthenticated stage refusal. Transport response is a local fixture.');
  }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
