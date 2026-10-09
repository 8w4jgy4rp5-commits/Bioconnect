const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const { randomUUID } = require('crypto');
const { createDB, ids } = require('./db.cjs');
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('ok '+name); }
const scalar = rows => rows[0].result;
async function main() {
  const db = await createDB(process.argv.includes('--postgres'));
  const rpc = (owner, call, args=[]) => db.as(owner, `select ${call} as result`,args).then(scalar);
  const wallet = u => rpc(u,'public.bioconnect_wallet()');
  const claim = u => rpc(u,'public.bioconnect_claim_welcome()');
  const revive = (u,r,source='crystal') => rpc(u,'public.bioconnect_revive($1,$2)',[r,source]);
  const order = (u,sku,request=randomUUID()) => db.as(null,'select public.bioconnect_order($1,$2,$3) as result',[u,request,sku],'service_role').then(scalar);
  const fulfill = (o,session,event,amount,currency='usd') => db.as(null,'select public.bioconnect_fulfill($1,$2,$3,$4,$5,$6,$7)',[o.id,o.owner_id,session,event,o.sku,amount,currency],'service_role');
  try {
    await check('anonymous claim rejected', async () => { await assert.rejects(db.as(null,'select public.bioconnect_claim_welcome()',[],'anon'),/permission denied/); });
    await check('browser cannot edit money or fulfill payment', async () => {
      await assert.rejects(db.as(ids.a,'update bioconnect_private.accounts set crystals=999'),/permission denied/);
      await assert.rejects(db.as(ids.a,'select public.bioconnect_fulfill($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),ids.a,'cs_fake','evt_fake','crystals5',100,'usd']),/permission denied/);
      await assert.rejects(db.as(ids.a,'select public.bioconnect_order($1,$2,$3)',[ids.b,randomUUID(),'crystals5']),/permission denied/);
    });
    await check('parallel welcome claims grant exactly three', async () => {
      await Promise.all(Array.from({length:12},()=>claim(ids.a))); assert.equal((await wallet(ids.a)).crystals,3);
    });
    const run=randomUUID();
    await check('same run on two devices spends once', async () => {
      await Promise.all(Array.from({length:12},()=>revive(ids.a,run))); assert.equal((await wallet(ids.a)).crystals,2);
    });
    await check('different simultaneous runs cannot overspend', async () => {
      const results = await Promise.allSettled(Array.from({length:8},()=>revive(ids.a,randomUUID())));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,2); assert.equal((await wallet(ids.a)).crystals,0);
    });
    await check('account B inherits no balance or entitlement', async () => {
      const b=await wallet(ids.b); assert.equal(b.crystals,0); assert.equal(b.no_ads,false); assert.equal(b.welcome_claimed,false);
    });
    const paid=await order(ids.a,'crystals5');
    await check('unpaid order grants nothing', async () => { assert.equal((await wallet(ids.a)).crystals,0); });
    await check('amount/currency mismatch rolls back', async () => {
      await assert.rejects(fulfill(paid,'cs_a','evt_a',99),/Payment mismatch/);
      await assert.rejects(fulfill(paid,'cs_a','evt_a',100,'jpy'),/Payment mismatch/);
      assert.equal((await wallet(ids.a)).crystals,0);
    });
    await check('duplicate notifications and different event IDs grant once', async () => {
      await Promise.all(Array.from({length:10},(_,i)=>fulfill(paid,'cs_a','evt_a'+i,100)));
      assert.equal((await wallet(ids.a)).crystals,5);
    });
    await check('order ownership and product cannot be spoofed', async () => {
      await assert.rejects(db.as(null,'select public.bioconnect_fulfill($1,$2,$3,$4,$5,$6,$7)',[paid.id,ids.b,'cs_a','evt_spoof','crystals5',100,'usd'],'service_role'),/Order mismatch/);
      await assert.rejects(rpc(ids.b,'public.bioconnect_order_status($1)',[paid.id]),/Order unavailable/);
    });
    await check('all Crystal bundles grant exact units', async () => {
      for(const [sku,units,amount] of [['crystals11',11,200],['crystals30',30,500],['crystals65',65,1000]]) {
        const before=(await wallet(ids.b)).crystals; const o=await order(ids.b,sku);
        await fulfill(o,'cs_'+sku,'evt_'+sku,amount); assert.equal((await wallet(ids.b)).crystals,before+units);
      }
    });
    await check('checkout retries retain one durable order', async () => {
      const req=randomUUID(); const list=await Promise.all(Array.from({length:10},()=>order(ids.a,'crystals5',req)));
      assert.equal(new Set(list.map(o=>o.id)).size,1);
      await assert.rejects(order(ids.a,'crystals11',req),/Request already used/);
    });
    const noadOrders=await Promise.all(Array.from({length:10},()=>order(ids.a,'no_ads')));
    await check('one-time checkout is shared across concurrent devices',async()=>{assert.equal(new Set(noadOrders.map(o=>o.id)).size,1);});
    const noads=noadOrders[0]; await fulfill(noads,'cs_noads','evt_noads',300);
    await check('one-time purchase and concurrent daily revival', async () => {
      assert.equal((await wallet(ids.a)).no_ads,true);
      await assert.rejects(order(ids.a,'no_ads'),/Already owned/);
      const list=await Promise.allSettled(Array.from({length:10},()=>revive(ids.a,randomUUID(),'daily')));
      assert.equal(list.filter(r=>r.status==='fulfilled').length,1);
      assert.equal((await wallet(ids.a)).daily_available,false);
    });
    await check('daily and Crystal attempts for the same run have one receipt', async () => {
      await db.query('update bioconnect_private.accounts set free_day=null where owner_id=$1',[ids.a]);
      const before=(await wallet(ids.a)).crystals, r=randomUUID();
      const res=await Promise.all([revive(ids.a,r,'daily'),revive(ids.a,r,'crystal')]);
      assert.equal(res[0].source,res[1].source);
      assert.equal((await wallet(ids.a)).crystals,before-(res[0].source==='crystal'?1:0));
    });
    await check('past unused days do not accumulate', async () => {
      await db.query("update bioconnect_private.accounts set free_day='2020-01-01' where owner_id=$1",[ids.a]);
      assert.equal((await wallet(ids.a)).daily_available,true);
      await revive(ids.a,randomUUID(),'daily'); await assert.rejects(revive(ids.a,randomUUID(),'daily'),/Daily revival unavailable/);
    });
    await check('4AM New York boundaries and both DST transitions', async () => {
      for(const [instant,day] of [
        ['2026-03-08T07:59:59Z','2026-03-07'],['2026-03-08T08:00:00Z','2026-03-08'],
        ['2026-03-07T08:59:59Z','2026-03-06'],['2026-03-07T09:00:00Z','2026-03-07'],
        ['2026-11-01T05:30:00Z','2026-10-31'],['2026-11-01T06:30:00Z','2026-10-31'],
        ['2026-11-01T08:59:59Z','2026-10-31'],['2026-11-01T09:00:00Z','2026-11-01'],
        ['2026-10-05T07:59:59Z','2026-10-04'],['2026-10-05T08:00:00Z','2026-10-05']]) {
        const result=await db.query('select bioconnect_private.revival_day($1)::text as d',[instant]); assert.equal(result.rows[0].d,day);
      }
    });
  } finally { await db.close(); }
  await check('Stripe signature accepts genuine fixture and rejects altered payload', async () => {
    const Stripe=require('stripe'), stripe=new Stripe('sk_test_local_fixture'); const secret='whsec_local_fixture';
    const payload=JSON.stringify({id:'evt_fixture',type:'checkout.session.completed',data:{object:{id:'cs_fixture'}}});
    const header=stripe.webhooks.generateTestHeaderString({payload,secret});
    assert.equal((await stripe.webhooks.constructEventAsync(payload,header,secret)).id,'evt_fixture');
    await assert.rejects(stripe.webhooks.constructEventAsync(payload+' ',header,secret));
  });
  await check('real revival keeps large animals, footprints and run state', () => {
    const ctx={console,document:{addEventListener(){},querySelectorAll:()=>[]},window:{},setTimeout:()=>0,clearTimeout(){},setInterval:()=>1,clearInterval(){},requestAnimationFrame(){},crypto:{randomUUID}};
    vm.createContext(ctx); vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../script.js'),'utf8')+ '\nglobalThis.X={state,el,ANIMALS,reviveRun,snapshotRun,rank,CELLS,scoreLabel,readBest,writeBest,applyRemoteScore,RULES_VERSION};',ctx);
    for(const name of ['render','syncClock','clearFx','clearMovePreview','hideWord','setTicker']) ctx[name]=()=>{};
    const {state:s,el}=ctx.X; el.startScreen={hidden:true}; el.gameover={hidden:false}; el.reviveResume={hidden:true,focus(){}};
    const kinds=['stone','bones','scrub','sprout','grass','rabbit','fox','deer','zebra','buffalo','wolf','bear','lion','tiger'];
    s.cells.fill(null); kinds.forEach((kind,i)=>s.cells[i]={kind,clock:10,born:'raised'});
    for(const i of [24,25,30,31]) s.cells[i]={kind:'elephant',clock:10,big:24,born:'raised'};
    s.stock=['grass','fox']; s.score=3000; s.best=3000; s.ticks=126; s.runId=randomUUID(); s.over=true;
    const before=ctx.X.snapshotRun(); assert.equal(ctx.X.reviveRun(),true);
    for(let i=0;i<7;i++) assert.equal(s.cells[i],null);
    for(let i=7;i<14;i++) assert.equal(s.cells[i].clock,0);
    for(const i of [24,25,30,31]) assert.equal(s.cells[i].kind,'elephant');
    assert.equal(s.cells[24].clock,0); assert.equal(s.score,before.score); assert.equal(s.ticks,before.ticks);
    assert.equal(JSON.stringify(s.stock),JSON.stringify(before.stock)); assert.equal(s.runId,before.runId);
    assert.equal(s.paused,true); assert.equal(s.revivalWait,true); assert.equal(s.revived,true); assert.equal(s.bestRevived,true);
    assert.equal(ctx.X.reviveRun(),false); assert.match(ctx.X.scoreLabel(s.score,true),/💎$/);
    ctx.remote={best:1000,rules:ctx.X.RULES_VERSION,revived:false,history:[]};ctx.saved=null;
    vm.runInContext('scoreStore={get:()=>globalThis.remote,set:value=>{globalThis.saved=value;return Promise.resolve();}};applyRemoteScore();',ctx);
    assert.equal(s.best,3000);assert.equal(ctx.saved.best,3000);assert.equal(ctx.saved.revived,true);
    ctx.remote={best:3000,rules:ctx.X.RULES_VERSION,revived:true,history:[{runId:randomUUID(),score:2222,revived:false,at:Date.now()+1,season:'Spring',rules:ctx.X.RULES_VERSION}]};
    ctx.X.applyRemoteScore();assert.equal(ctx.saved.history.length,2);assert.ok(ctx.saved.history.some(r=>r.revived));
    ctx.remote=ctx.saved;vm.runInContext('recordHistory=[];readScoreMetadata();',ctx);
    assert.equal(vm.runInContext('recordHistory.length',ctx),2);
    ctx.remote={best:4000,rules:ctx.X.RULES_VERSION,revived:false};ctx.X.applyRemoteScore();assert.equal(s.best,4000);assert.equal(s.bestRevived,false);
    ctx.remote.revived=true;ctx.X.applyRemoteScore();assert.equal(s.bestRevived,true);
  });
  await check('real AppSync initial pull and refresh merge records only for the same owner', async () => {
    const localMap=new Map(),key='appdata:ecosystem-puzzle:score';
    const ctx={console,window:{addEventListener(){}},navigator:{onLine:true},document:{body:null,addEventListener(){},querySelectorAll:()=>[]},setTimeout:()=>0,clearTimeout(){}};
    vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../script.js'),'utf8')+'\nglobalThis.mergeForTest=mergeScoreData;',ctx);
    const wrap=(d,t,o=ids.a)=>({v:1,av:2,t,o,d});
    const rules=20,l={best:9000,rules,revived:true,history:[{runId:randomUUID(),score:9000,rules,revived:true,at:1,season:'Winter'}]},r={best:100,rules,revived:false,history:[{runId:randomUUID(),score:100,rules,revived:false,at:2,season:'Spring'}]};
    localMap.set(key,JSON.stringify(wrap(l,1)));let remote=wrap(r,2),owner=ids.a;
    ctx.localStorage={getItem:k=>localMap.get(k)||null,setItem:(k,v)=>localMap.set(k,v),removeItem:k=>localMap.delete(k)};
    ctx.supabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:owner}}}})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{value:remote}}),upsert:async row=>{assert.equal(row.owner_id,owner);remote=row.value;return {error:null};}})};
    vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../shared/app-sync.js'),'utf8'),ctx);
    const store=await ctx.window.AppSync.store('ecosystem-puzzle','score',{version:2,merge:ctx.mergeForTest});
    assert.equal(store.get().best,9000);assert.equal(store.get().revived,true);assert.equal(store.get().history.length,2);assert.equal(remote.d.history.length,2);
    remote=wrap({...r,history:[...r.history,{runId:randomUUID(),score:10,rules,revived:true,at:3}]},Date.now()+1000);
    await store._refreshFromRemote(true);await store.flush();assert.equal(store.get().best,9000);assert.equal(remote.d.history.length,3);store.dispose();
    localMap.set(key,JSON.stringify(wrap(l,Date.now(),ids.b)));remote=wrap(r,2);
    const next=await ctx.window.AppSync.store('ecosystem-puzzle','score',{version:2,merge:ctx.mergeForTest});
    assert.equal(next.get().best,100);assert.equal(next.get().history.length,1);next.dispose();
  });
  console.log(`${passed} monetization checks passed (${process.argv.includes('--postgres')?'real PostgreSQL, independent connections':'PGlite, serialized transactions'}).`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
