// Browser regression checks with Auth/RPC fixtures only; no live services.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {engine,launchTestBrowser,evidenceDir}=require('./browser-runtime.cjs');const {createLocalServer}=require('./local-server.cjs');
(async()=>{
 const server=await createLocalServer();let browser,checks=0;const errors=[],pages=[];
 const ok=name=>{checks++;console.log('ok '+name)};
 const owner='00000000-0000-0000-0000-000000000001';
 try {
  browser=await launchTestBrowser();
  async function fixture(options={},suffix='') {
   const context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage();pages.push(context);
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',event=>{if(event.text().startsWith('BIO_AUTH_PROOF '))page.authProof=JSON.parse(event.text().slice(15));});
   await page.route('**/*',async route=>{
    const target=new URL(route.request().url());
    if(target.hostname==='accounts.google.com' && target.searchParams.get('fixture')==='true') {
     return route.fulfill({contentType:'text/html',body:'<h1>Local Google navigation fixture</h1>'});
    }
    return target.origin===server.url?route.continue():route.abort();
   });
   await page.addInitScript(({options,owner})=>{
    const user={id:options.otherOwner?'00000000-0000-0000-0000-000000000002':owner,email:'owner@example.test',identities:[{provider:'email'}]};
    if(options.linked)user.identities.push({provider:'google'});
    let next=options.guest?null:{user},authObserver;window.fixtureCalls=[];
    const record=(name,args)=>window.fixtureCalls.push({name,args});
    window.supabaseClient={auth:{
     getSession:async()=>{window.fixtureSdkUrl=location.href;if(options.sdkClean)history.replaceState(null,'',location.pathname+location.search);return {data:{session:next}}},
     onAuthStateChange:cb=>{authObserver=cb;window.fixtureSwitch=()=>{next={user:{...user,id:'00000000-0000-0000-0000-000000000002'}};cb('SIGNED_IN',next)}},
     getUser:async()=>{record('getUser');if(options.userFail)return {error:Error('private upstream error')};
      if(options.race){window.fixtureSwitch();await new Promise(r=>setTimeout(r,20));}
      const fresh={...user,identities:options.freshLinked?[{provider:'email'},{provider:'google'}]:user.identities};
      return {data:{user:options.userMismatch?{...fresh,id:'wrong'}:fresh}}},
     signInWithOtp:async()=>({}),
     verifyOtp:async()=>{next={user};authObserver?.('SIGNED_IN',next);await new Promise(r=>setTimeout(r,20));return {}},
     signInWithOAuth:async args=>{record('signInWithOAuth',args);return {error:options.startFail?Error('<img src=x onerror=alert(1)>private@fixture.test'):null}},
     linkIdentity:async args=>{record('linkIdentity',args);
      console.log('BIO_AUTH_PROOF '+JSON.stringify({calls:fixtureCalls,snapshot:JSON.parse(sessionStorage.getItem('bioconnect:return-game')),authReturn:JSON.parse(sessionStorage.getItem('bioconnect:auth-return')),wallet:BioEconomy.summary().wallet}));
      if(options.linkRace){window.fixtureSwitch();await new Promise(r=>setTimeout(r,20));}
      return {data:{url:options.badUrl?'https://evil.fixture.test/auth':'https://accounts.google.com/o/oauth2/v2/auth?fixture=true'},error:options.startFail?Error('manual linking disabled'):null}},
    },rpc:async(name,args)=>{record(name,args);if(options.walletFail)return {error:Error('fixture offline')};return {data:{crystals:6,no_ads:true,daily_available:true,welcome_claimed:true}}}};
    if(options.lateRecords) {
     let releaseRecords,scoreObserver;
     const scoreGate=new Promise(resolve=>{releaseRecords=resolve;});
     let scoreData={best:0,rules:20,history:[{runId:'late-score-fixture',score:55555,rules:20,revived:true,season:'Winter 2',ticks:103,at:1}]};
     window.fixtureReleaseRecords=()=>releaseRecords();
     window.fixtureRemoteRecords=()=>{scoreData.history.push({runId:'remote-score-fixture',score:12345,rules:20,revived:false,season:'Summer',ticks:30,at:2});scoreObserver?.();};
     window.AppSync={store:async(_slug,key)=>{
      if(key==='score')await scoreGate;
      return {get:()=>JSON.parse(JSON.stringify(key==='score'?scoreData:{kinds:[]})),
       set:async value=>{if(key==='score')scoreData=value;},subscribe:cb=>{if(key==='score')scoreObserver=cb;return()=>{};},dispose:()=>{scoreObserver=null;}};
     }};
    }
    if(options.returnKind)sessionStorage.setItem('bioconnect:auth-return',JSON.stringify({kind:options.returnKind,owner,startedAt:Date.now()}));
    if(options.storageFail){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='bioconnect:auth-return')throw Error('fixture storage full');return set.call(this,k,v)}}
   },{options,owner});
   await page.goto(server.url+'/plain.html'+suffix);await page.waitForFunction(late=>BioGame&&BioEconomy&&(late||scoreStore!==null),!!options.lateRecords);
   if(!options.guest&&!options.walletFail)await page.waitForFunction(()=>BioEconomy.summary().wallet?.crystals===6);
   return page;
  }
  const guest=await fixture({guest:true});await guest.locator('#startShopBtn').click();
  assert.equal(await guest.locator('#googleLink').isVisible(),false);await guest.locator('#googleSignIn').click();await guest.waitForFunction(()=>!BioEconomy.summary().busy);
  const sign=await guest.evaluate(()=>fixtureCalls.find(c=>c.name==='signInWithOAuth'));
  assert.equal(sign.args.options.redirectTo,server.url+'/plain.html');assert.equal(sign.args.options.queryParams.prompt,'select_account');
  assert.equal(await guest.evaluate(()=>JSON.parse(sessionStorage.getItem('bioconnect:return-game')).startScreenVisible),true);ok('guest signs in with Google and preserves title snapshot');
  const signedReturn=await fixture({linked:true,returnKind:'sign-in-google'});await signedReturn.waitForFunction(()=>document.querySelector('#shopStatus').textContent==='Signed in. Your account is ready.');
  assert.equal(await signedReturn.locator('#shopModal').isVisible(),false);await signedReturn.locator('#startShopBtn').click();assert.match(await signedReturn.locator('#shopStatus').textContent(),/Signed in/);assert.equal(await signedReturn.evaluate(()=>BioEconomy.summary().wallet.crystals),6);
  await signedReturn.reload();await signedReturn.waitForFunction(()=>document.querySelector('#shopStatus').textContent==='Signed in. Your account is ready.');ok('Google return and reload show signed-in status while preserving title and existing assets');
  const lateRecords=await fixture({linked:true,lateRecords:true});await lateRecords.locator('#startShopBtn').click();
  assert.equal(await lateRecords.locator('#recordList').textContent(),'');assert.equal(await lateRecords.evaluate(()=>BioEconomy.summary().wallet.crystals),6);
  await lateRecords.evaluate(()=>fixtureReleaseRecords());await lateRecords.waitForFunction(()=>BioGame.records().length===1);
  assert.match(await lateRecords.locator('#recordList').textContent(),/2,349 💎.*Winter 2/);ok('late score load updates the open store without refresh or reopen');
  await lateRecords.evaluate(()=>fixtureRemoteRecords());await lateRecords.waitForFunction(()=>BioGame.records().length===2);
  assert.match(await lateRecords.locator('#recordList').textContent(),/Summer/);ok('remote record subscription updates the open store immediately');
  const offlineReturn=await fixture({linked:true,returnKind:'sign-in-google',walletFail:true});await offlineReturn.waitForFunction(()=>document.querySelector('#shopStatus').textContent.includes('Account unavailable'));
  assert.equal(await offlineReturn.evaluate(()=>BioEconomy.summary().wallet),null);assert.doesNotMatch(await offlineReturn.locator('#shopStatus').textContent(),/account is ready/);ok('failed wallet refresh retains connection warning after authenticated return');
  const otpRecovery=await fixture({guest:true});await otpRecovery.evaluate(owner=>{const snapshot=BioGame.snapshot();localStorage.setItem('bioconnect:revival-pending:'+owner,JSON.stringify({owner,source:'crystal',runId:snapshot.runId,snapshot}));},owner);
  await otpRecovery.locator('#startShopBtn').click();await otpRecovery.locator('#signInEmail').fill('owner@example.test');await otpRecovery.locator('#sendCodeBtn').click();await otpRecovery.locator('#signInCode').fill('123456');await otpRecovery.locator('#verifyCodeBtn').click();await otpRecovery.waitForFunction(()=>BioEconomy.summary().pending&&!BioEconomy.summary().busy);
  assert.match(await otpRecovery.locator('#shopStatus').textContent(),/needs confirmation/);assert.equal(await otpRecovery.evaluate(()=>BioEconomy.summary().wallet.crystals),6);ok('OTP sign-in preserves pending revival confirmation instead of ready message');
  const otpOffline=await fixture({guest:true,walletFail:true});await otpOffline.locator('#startShopBtn').click();await otpOffline.locator('#signInEmail').fill('owner@example.test');await otpOffline.locator('#sendCodeBtn').click();await otpOffline.locator('#signInCode').fill('123456');await otpOffline.locator('#verifyCodeBtn').click();await otpOffline.waitForFunction(()=>!BioEconomy.summary().busy);
  assert.match(await otpOffline.locator('#shopStatus').textContent(),/Account unavailable/);assert.equal(await otpOffline.evaluate(()=>BioEconomy.summary().wallet),null);ok('OTP sign-in preserves wallet connection failure instead of ready message');
  const linked=await fixture();await linked.locator('#startShopBtn').click();const original=await linked.evaluate(()=>BioGame.snapshot());
  await linked.locator('#googleLink').click();await linked.waitForURL('https://accounts.google.com/**');
  const calls=linked.authProof.calls;assert.ok(calls.some(c=>c.name==='getUser'));assert.ok(calls.some(c=>c.name==='linkIdentity'));assert.ok(!calls.some(c=>c.name==='signInWithOAuth'));
  assert.equal(calls.find(c=>c.name==='linkIdentity').args.options.skipBrowserRedirect,true);
  assert.deepEqual(linked.authProof.snapshot,original);
  assert.equal(linked.authProof.authReturn.owner,owner);
  assert.equal(linked.authProof.wallet.crystals,6);ok('linking checks authenticated owner and preserves wallet and title');
  const fail=await fixture({startFail:true});await fail.locator('#startShopBtn').click();await fail.locator('#googleLink').click();await fail.waitForFunction(()=>!BioEconomy.summary().busy);
  assert.match(await fail.locator('#shopStatus').textContent(),/could not start/);assert.equal(await fail.evaluate(()=>sessionStorage.getItem('bioconnect:auth-return')||sessionStorage.getItem('bioconnect:return-game')),null);ok('immediate linking failure clears redirect state and keeps existing account');
  const storage=await fixture({storageFail:true});await storage.locator('#startShopBtn').click();await storage.locator('#googleLink').click();await storage.waitForFunction(()=>!BioEconomy.summary().busy);
  assert.match(await storage.locator('#shopStatus').textContent(),/state could not be saved/);assert.equal(await storage.evaluate(()=>fixtureCalls.some(c=>c.name==='linkIdentity')),false);assert.equal(await storage.evaluate(()=>sessionStorage.getItem('bioconnect:return-game')),null);ok('storage failure aborts linking before redirect');
  const race=await fixture({race:true});await race.locator('#startShopBtn').click();await race.locator('#googleLink').click();await race.waitForFunction(()=>!BioEconomy.summary().busy);
  assert.equal(await race.evaluate(()=>fixtureCalls.some(c=>c.name==='linkIdentity')),false);ok('account switch during server identity check cannot link old owner');
  const linkRace=await fixture({linkRace:true});await linkRace.locator('#startShopBtn').click();await linkRace.locator('#googleLink').click();await linkRace.waitForFunction(()=>!BioEconomy.summary().busy);
  assert.equal(linkRace.url(),server.url+'/plain.html');assert.equal(await linkRace.evaluate(()=>sessionStorage.getItem('bioconnect:auth-return')),null);ok('account switch during linkIdentity request cannot navigate to old owner authorization');
  const badUrl=await fixture({badUrl:true});await badUrl.locator('#startShopBtn').click();await badUrl.locator('#googleLink').click();await badUrl.waitForFunction(()=>!BioEconomy.summary().busy);
  assert.equal(badUrl.url(),server.url+'/plain.html');assert.match(await badUrl.locator('#shopStatus').textContent(),/could not start/);ok('untrusted authorization URL cannot receive navigation');
  const pending=await fixture();await pending.evaluate(owner=>{const snapshot=BioGame.snapshot();localStorage.setItem('bioconnect:revival-pending:'+owner,JSON.stringify({owner,source:'crystal',runId:snapshot.runId,snapshot}));},owner);await pending.reload();await pending.waitForFunction(()=>BioEconomy.summary().pending);await pending.locator('#startShopBtn').click();
  assert.match(await pending.locator('#shopStatus').textContent(),/needs confirmation/);assert.equal(await pending.locator('#googleLink').isDisabled(),true);assert.equal(await pending.evaluate(()=>fixtureCalls.some(c=>c.name==='linkIdentity')),false);ok('pending revival blocks linking until recovery completes');
  const mismatch=await fixture({userMismatch:true});await mismatch.locator('#startShopBtn').click();await mismatch.locator('#googleLink').click();await mismatch.waitForFunction(()=>!BioEconomy.summary().busy);
  assert.equal(await mismatch.evaluate(()=>fixtureCalls.some(c=>c.name==='linkIdentity')),false);ok('server identity mismatch cannot initiate linking');
  const success=await fixture({returnKind:'link-google',freshLinked:true});await success.locator('#shopModal').waitFor({state:'visible'});await success.waitForFunction(()=>document.querySelector('#shopStatus').textContent.includes('Google is linked'));
  assert.equal(await success.locator('#googleLink').isVisible(),false);assert.equal(await success.evaluate(()=>BioEconomy.summary().owner),owner);assert.equal(await success.evaluate(()=>BioEconomy.summary().wallet.crystals),6);assert.equal(await success.evaluate(()=>BioEconomy.summary().wallet.no_ads),true);
  assert.ok(await success.evaluate(()=>!fixtureCalls.some(c=>c.name==='bioconnect_claim_welcome')));ok('successful link return verifies live user identity without granting or moving assets');
  const wrong=await fixture({returnKind:'link-google',otherOwner:true,linked:true});await wrong.locator('#shopModal').waitFor({state:'visible'});
  assert.match(await wrong.locator('#shopStatus').textContent(),/original account/);assert.doesNotMatch(await wrong.locator('#shopStatus').textContent(),/^Google is linked/);ok('different owner on return cannot be reported as a successful link');
  const unverified=await fixture({returnKind:'link-google',userFail:true});await unverified.locator('#shopModal').waitFor({state:'visible'});await unverified.waitForFunction(()=>document.querySelector('#shopStatus').textContent.includes('Keep using'));
  assert.equal(await unverified.locator('#googleLink').isVisible(),true);ok('failed server verification gives no false success');
  const denied=await fixture({guest:true},'?keep=1&error=access_denied&error_description='+encodeURIComponent('This sandbox is restricted to its owner.')+'#section');await denied.locator('#shopModal').waitFor({state:'visible'});
  assert.match(await denied.locator('#shopStatus').textContent(),/restricted to its owner/);assert.equal(denied.url(),server.url+'/plain.html?keep=1#section');assert.equal(await denied.evaluate(()=>BioEconomy.summary().wallet),null);ok('actual owner hook error is explained and removed from URL, without grants');
  const unsafe=await fixture({guest:true},'#error=access_denied&error_description='+encodeURIComponent('<img src=x onerror=alert(1)>private@fixture.test')+'&keep=1');await unsafe.locator('#shopModal').waitFor({state:'visible'});
  assert.match(await unsafe.locator('#shopStatus').textContent(),/did not complete/);assert.doesNotMatch(await unsafe.locator('#shopStatus').textContent(),/private@|<img/);assert.equal(unsafe.url(),server.url+'/plain.html#keep=1');ok('hash failure shows static text without upstream HTML or personal details');
  const mixed=await fixture({guest:true,sdkClean:true},'?error=access_denied#access_token=fixture-token&refresh_token=fixture-refresh');await mixed.locator('#shopModal').waitFor({state:'visible'});
  assert.equal(mixed.url(),server.url+'/plain.html');ok('error cleanup never restores credentials already removed by Auth SDK');
  const sdk=await fixture({guest:true},'?code=fixture-code&keep=1#access_token=fixture-token&refresh_token=fixture-refresh');
  assert.equal(await sdk.evaluate(()=>fixtureSdkUrl),sdk.url());assert.match(sdk.url(),/code=fixture-code/);assert.equal(await sdk.locator('#shopModal').isVisible(),false);ok('successful callback parameters remain available to Auth SDK');
  // A real game snapshot, including paused active play, survives a denied OAuth return.
  await linked.goto(server.url+'/plain.html');await linked.locator('#shopModal').waitFor({state:'visible'});await linked.locator('#shopClose').click();await linked.locator('#startBtn').press('Enter');await linked.locator('#countdown').waitFor({state:'hidden'});
  await linked.locator('#menuBtn').click();await linked.locator('#shopBtn').click();await linked.locator('#googleLink').click();await linked.waitForURL('https://accounts.google.com/**');
  const active=linked.authProof.snapshot;
  await linked.goto(server.url+'/plain.html?error=access_denied&error_description=cancelled');await linked.locator('#shopModal').waitFor({state:'visible'});
  assert.deepEqual(await linked.evaluate(()=>BioGame.snapshot()),active);assert.equal(await linked.evaluate(()=>BioGame.snapshot().startScreenVisible),false);assert.equal(await linked.evaluate(()=>state.paused),true);ok('denied OAuth restores the complete active game and holds it paused');
  assert.deepEqual(errors,[]);
  const out=evidenceDir('monetization');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'auth-result.json'),JSON.stringify({engine,browserVersion:browser.version(),platform:process.platform,checks,errors,providers:'Auth and wallet fixtures only; no real OAuth verification'},null,2));
  console.log(checks+' '+engine+' browser Auth checks passed; services simulated.');
 } finally {for(const context of pages){for(const page of context.pages())await page.unrouteAll({behavior:'ignoreErrors'});await context.close();}if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
