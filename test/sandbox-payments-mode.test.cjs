// Configuration boundary: TEST payments cannot change the shipped config.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSandboxServer}=require('./sandbox-server.cjs');
(async()=>{
  const production=fs.readFileSync(path.join(__dirname,'../shared/monetization-config.js'),'utf8');
  assert.match(production,/paymentsEnabled:\s*false/);
  assert.match(production,/adsEnabled:\s*false/);
  for(const testPayments of [false,true]){
    const server=await createSandboxServer(0,{testPayments});
    try{
      for(const route of ['/shared/monetization-config.js','/SHARED/MONETIZATION-CONFIG.JS']){
        const text=await(await fetch(server.url+route)).text();
        assert.match(text,new RegExp('paymentsEnabled:'+testPayments+',adsEnabled:false'));
      }
      const html=await(await fetch(server.url)).text();
      assert.ok(html.includes(testPayments?'Stripe TEST payments · Ads OFF':'Payments/ads OFF'));
      assert.ok(!html.includes('static.cloudflareinsights.com'));
      const config=await(await fetch(server.url+'/shared/supabase-config.js')).text();
      assert.ok(config.includes('jcbohkzjmgbpsaqkrirg'));
      assert.ok(!config.includes('xyumhzecqhpzzzzylbwn'));
      assert.ok(!config.includes('sb_secret_'));
      assert.equal((await fetch(server.url+'/output/edge-deploy/checkout.ts')).status,403);
    }finally{await server.close();}
  }
  await assert.rejects(createSandboxServer(0,{testPayments:'true'}));
  assert.equal(fs.readFileSync(path.join(__dirname,'../shared/monetization-config.js'),'utf8'),production);
  console.log('TEST payments preview isolation, explicit opt-in and private paths passed. No payment or login requested.');
})().catch(e=>{console.error(e);process.exitCode=1;});
