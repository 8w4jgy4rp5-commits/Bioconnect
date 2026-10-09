const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {createSandboxServer}=require('./sandbox-server.cjs');
const {chromium}=require('playwright');
(async()=>{
  const server=await createSandboxServer(0);
  let browser;
  try {
    const index=await (await fetch(server.url)).text();
    assert.match(index,/SANDBOX · Real test DB/);assert.ok(!index.includes('static.cloudflareinsights.com'));
    const config=await (await fetch(server.url+'/shared/supabase-config.js')).text();
    assert.match(config,/jcbohkzjmgbpsaqkrirg/);assert.ok(!config.includes('xyumhzecqhpzzzzylbwn'));
    assert.ok(!config.includes('sb_secret_'));assert.ok(!config.includes('service_role'));
    const economy=await (await fetch(server.url+'/shared/monetization-config.js')).text();
    assert.match(economy,/paymentsEnabled:false,adsEnabled:false/);
    for(const requestPath of ['/supabase/.env.example','/.git/config','/test/local-adapter.js','/supabase/sandbox/project.json','/node_modules/package.json']) assert.equal((await fetch(server.url+requestPath)).status,403);
    for(const requestPath of ['/TEST/local-adapter.js','/NODE_MODULES/@supabase/supabase-js/dist/umd/supabase.js','/shared%5csupabase-config.js','/%2fshared/supabase-config.js']) assert.equal((await fetch(server.url+requestPath)).status,403);
    for(const requestPath of ['/shared/%2e%2fsupabase-config.js','/foo/%2e%2e%2fshared/supabase-config.js','/shared/supaba~1.js']) assert.equal((await fetch(server.url+requestPath)).status,403);
    for(const requestPath of ['/SHARED/supabase-config.js','/shared/SUPABASE-CONFIG.JS']) {
      const c=await (await fetch(server.url+requestPath)).text();assert.match(c,/jcbohkzjmgbpsaqkrirg/);assert.ok(!c.includes('xyumhzecqhpzzzzylbwn'));
    }
    const aliasIndex=await (await fetch(server.url+'/Index.html')).text();
    assert.match(aliasIndex,/SANDBOX · Real test DB/);assert.ok(!aliasIndex.includes('static.cloudflareinsights.com'));
    assert.match(await (await fetch(server.url+'/SHARED/MONETIZATION-CONFIG.JS')).text(),/paymentsEnabled:false,adsEnabled:false/);
    assert.equal((await fetch(server.url,{method:'POST'})).status,405);
    const hostile=await new Promise(resolve=>{
      const req=http.get(server.url,{headers:{Host:'untrusted.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',e=>{throw e;});
    });assert.equal(hostile,403);
    browser=await chromium.launch({channel:process.env.BIOCONNECT_BROWSER_CHANNEL||'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:375,height:812}}),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.goto(server.url);await page.waitForFunction(()=>window.BioGame&&window.BioEconomy);
    assert.equal(await page.evaluate(()=>SUPABASE_URL),'https://jcbohkzjmgbpsaqkrirg.supabase.co');
    assert.equal(await page.evaluate(()=>BioEconomy.summary().owner),null);
    await page.locator('#startShopBtn').click();await page.locator('#shopModal').waitFor({state:'visible'});
    assert.equal(await page.locator('#googleSignIn').isVisible(),true);assert.equal(await page.locator('#sendCodeBtn').isVisible(),true);
    assert.deepEqual(await page.evaluate(()=>({payments:BioMonetizationConfig.paymentsEnabled,ads:BioMonetizationConfig.adsEnabled})),{payments:false,ads:false});
    const out=path.join(__dirname,'../output/playwright/sandbox');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'store-375.png')});
    await page.locator('#shopClose').click();await page.locator('#startBtn').press('Enter');await page.locator('#countdown').waitFor({state:'hidden'});
    await page.setViewportSize({width:320,height:568});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,'game-320.png')});
    assert.ok(requests.every(u=>!u.includes('xyumhzecqhpzzzzylbwn')));assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({target:'bioconnect-sandbox',realAuthLoginTested:false,paymentsEnabled:false,adsEnabled:false,checks:'loopback host, paths, config isolation, actual SDK, UI, 320px, no production requests',errors},null,2));
    console.log('Sandbox preview passed: isolated config, localhost-only access, blocked private paths, real SDK and Chrome 375/320 UI. No real login/payment/ad was performed.');
  } finally {if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
