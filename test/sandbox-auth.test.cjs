const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {createDB}=require('./db.cjs');
(async()=>{
 const db=await createDB();
 try {
  await db.query('create role supabase_auth_admin');
  await db.query(fs.readFileSync(path.join(__dirname,'../supabase/sandbox/auth-allowlist.sql'),'utf8'));
  await db.query("insert into bioconnect_private.sandbox_login_allowlist(email) values ('owner@example.test')");
  const hook=event=>db.as(null,'select public.bioconnect_sandbox_before_user_created($1) as decision',[JSON.stringify(event)],'supabase_auth_admin');
  assert.deepEqual((await hook({user:{email:'owner@example.test',is_anonymous:false}}))[0].decision,{});
  assert.deepEqual((await hook({user:{email:'OWNER@example.test'}}))[0].decision,{});
  for(const event of [{user:{email:'other@example.test'}},{user:{email:'owner@example.test.evil'}},{user:{email:null}},{user:{phone:'123'}},{user:{email:'owner@example.test',is_anonymous:true}},{}]) assert.equal((await hook(event))[0].decision.error.http_code,403);
  await db.query("update bioconnect_private.sandbox_login_allowlist set active=false");
  assert.equal((await hook({user:{email:'owner@example.test'}}))[0].decision.error.http_code,403);
  await assert.rejects(db.as(null,'select * from bioconnect_private.sandbox_login_allowlist',[],'anon'));
  await assert.rejects(db.as(null,'select * from bioconnect_private.sandbox_login_allowlist'));
  await assert.rejects(db.as(null,'select public.bioconnect_sandbox_before_user_created($1)',['{}']));
  await assert.rejects(db.as(null,'update bioconnect_private.sandbox_login_allowlist set active=true',[],'supabase_auth_admin'));
  console.log('Sandbox Auth allowlist passed: exact owner only; null/foreign/anonymous/inactive denied; private table and hook privileges enforced.');
 } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
