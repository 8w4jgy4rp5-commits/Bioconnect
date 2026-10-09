// Read-only checks of the user-designated real sandbox. Never sends email or signs in.
const assert=require('node:assert/strict');
const p=require('../supabase/sandbox/project.json');
(async()=>{
  const headers={apikey:p.publishableKey,'Content-Type':'application/json'};
  const response=await fetch(p.url+'/auth/v1/settings',{headers});
  assert.equal(response.status,200);const settings=await response.json();
  console.log(JSON.stringify({target:p.name,googleEnabled:settings.external?.google,emailEnabled:settings.external?.email,signupDisabled:settings.disable_signup,mailerAutoconfirm:settings.mailer_autoconfirm}));
  for(const name of ['bioconnect_wallet','bioconnect_claim_welcome','bioconnect_order']) {
    const r=await fetch(p.url+'/rest/v1/rpc/'+name,{method:'POST',headers,body:'{}'});
    const result=await r.json();assert.ok([401,403,404].includes(r.status));
    console.log(JSON.stringify({rpc:name,anonymousStatus:r.status,code:result.code}));
  }
  const r=await fetch(p.url+'/rest/v1/user_app_data?select=value',{headers});assert.ok([401,403].includes(r.status));
  console.log('Anonymous cannot read records or change money.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
