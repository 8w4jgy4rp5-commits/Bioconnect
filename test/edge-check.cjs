const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const Stripe=require('stripe'); const {randomUUID}=require('crypto'); const {createDB,ids}=require('./db.cjs');
const root=path.resolve(__dirname,'..');
async function main(){
  // Typecheck deployable code with the npm imports mapped to the SAME installed versions.
  const typeRoot=path.join(root,'output','edge-typecheck'); fs.mkdirSync(typeRoot,{recursive:true});
  const fileList=['_shared/payment.ts','checkout/index.ts','stripe-webhook/index.ts'];
  for(const f of fileList){const to=path.join(typeRoot,f);fs.mkdirSync(path.dirname(to),{recursive:true});
    fs.writeFileSync(to,fs.readFileSync(path.join(root,'supabase/functions',f),'utf8').replace('npm:stripe@23.0.0','stripe').replace('npm:@supabase/supabase-js@2.57.4','@supabase/supabase-js'));}
  const shim=path.join(typeRoot,'deno.d.ts');fs.writeFileSync(shim,'declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };');
  const program=ts.createProgram([...fileList.map(f=>path.join(typeRoot,f)),shim],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,strict:true,skipLibCheck:true,noEmit:true,allowImportingTsExtensions:true,esModuleInterop:true});
  const errors=ts.getPreEmitDiagnostics(program);if(errors.length)throw Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
  console.log('ok Edge Function TypeScript check');
  const db=await createDB(), secret='whsec_local_fixture',site='https://bioconnect.example.test/';
  const env={STRIPE_SECRET_KEY:'sk_test_local_fixture',STRIPE_WEBHOOK_SECRET:secret,BIOCONNECT_SITE_URL:site,PAYMENTS_LIVE:'false'};
  const stripe=new Stripe(env.STRIPE_SECRET_KEY), sessions=new Map();
  const admin={auth:{getUser:async jwt=>({data:{user:jwt==='valid-a'?{id:ids.a}:null},error:jwt==='valid-a'?null:Error('bad token')})},rpc:async(name,args)=>{
    const params=name==='bioconnect_order'?['p_owner','p_request','p_sku']:name==='bioconnect_reverse'?['p_order','p_owner','p_session','p_event','p_reason']:['p_order','p_owner','p_session','p_event','p_sku','p_amount','p_currency'];
    try{const rows=await db.as(null,'select public.'+name+'('+params.map((_,i)=>'$'+(i+1)).join(',')+') as result',params.map(p=>args[p]),'service_role');return {data:rows[0].result,error:null};}
    catch(error){return {data:null,error};}
  }};
  let capturedCreate=null;
  const prices=new Map(), lineItems=new Map();
  stripe.prices.retrieve=async id=>{if(!prices.has(id))throw Error('No price fixture');return prices.get(id);};
  stripe.checkout.sessions.listLineItems=async id=>{if(!lineItems.has(id))throw Error('No line fixture');return lineItems.get(id);};
  const fixturePrice=(sku,live=false)=>({id:'price_'+sku.replace(/_/g,''),active:true,type:'one_time',recurring:null,
    currency:'usd',unit_amount:({crystals5:100,crystals11:200,crystals30:500,crystals65:1000,no_ads:300})[sku],
    tax_behavior:'exclusive',livemode:live,currency_options:{eur:{unit_amount:90}},product:{id:'prod_fixture',active:true,tax_code:'txcd_fixture'}});
  stripe.checkout.sessions.create=async(params,options)=>{capturedCreate={params,options};return {url:'https://checkout.stripe.com/c/pay/local-test',id:'cs_local'};};
  stripe.checkout.sessions.retrieve=async id=>{if(!sessions.has(id))throw Error('No fixture');return sessions.get(id);};
  const charges=new Map(),disputes=new Map();
  stripe.charges.retrieve=async id=>{if(!charges.has(id))throw Error('No fixture');return charges.get(id);};
  stripe.disputes.retrieve=async id=>{if(!disputes.has(id))throw Error('No fixture');return disputes.get(id);};
  stripe.checkout.sessions.list=async({payment_intent})=>({data:[...sessions.values()].filter(x=>x.payment_intent===payment_intent)});
  function load(f,requireFn,deno){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    new Function('require','exports','module','Deno',code)(requireFn,module.exports,module,deno);return module.exports;}
  let handler;const deno={env:{get:k=>env[k]},serve:fn=>handler=fn};
  const shared=load(path.join(root,'supabase/functions/_shared/payment.ts'),name=>name.startsWith('npm:stripe')?Stripe:{createClient:()=>admin},deno);
  const deps={...shared,payments:()=>stripe,admin:()=>admin};
  load(path.join(root,'supabase/functions/checkout/index.ts'),()=>deps,deno);const checkout=handler;
  function checkoutReq(body,token='valid-a',origin='https://bioconnect.example.test'){return new Request('https://edge.test/checkout',{method:'POST',headers:{origin,authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});}
  try{
    assert.equal((await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID()},'bad'))).status,401);
    assert.equal((await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID()},'valid-a','https://bad.test'))).status,403);
    assert.equal((await checkout(checkoutReq({sku:'toString',request_id:randomUUID()}))).status,400);
    const response=await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID(),owner_id:ids.b,amount:1}));
    assert.equal(response.status,200);const orderId=(await response.json()).order_id;
    assert.equal(capturedCreate.params.metadata.owner_id,ids.a);assert.equal(capturedCreate.params.line_items[0].price_data.unit_amount,100);
    assert.equal(capturedCreate.options.idempotencyKey,'bioconnect-order-'+orderId);
    assert.equal(capturedCreate.params.payment_method_types[0],'card');
    console.log('ok real checkout handler: auth, origin, product, server price, owner and idempotency');
    const policy=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<p id="crystalRefundPolicy">([^<]+)<\/p>/)?.[1];
    assert.equal(policy,'Purchases are non-refundable, except where required by applicable law.');
    assert.equal(capturedCreate.params.custom_text.submit.message,policy,'Store and direct Checkout must show the same refund policy');
    for(const sku of ['crystals11','crystals30','crystals65','no_ads']) {
      const r=await checkout(checkoutReq({sku,request_id:randomUUID(),custom_text:{submit:{message:'Refunds allowed'}}}));
      assert.equal(r.status,200);assert.equal(capturedCreate.params.custom_text.submit.message,policy);
    }
    const realCreate=stripe.checkout.sessions.create;
    stripe.checkout.sessions.create=async()=>{throw new Stripe.errors.StripeIdempotencyError({message:'Keys for idempotent requests can only be used with the same parameters'});};
    const poisoned=await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID()}));
    assert.equal(poisoned.status,409);assert.equal((await poisoned.json()).code,'order_expired');
    stripe.checkout.sessions.create=realCreate;
    console.log('ok Checkout refund notice: all products, server-owned text, store consistency; reused key starts a fresh order');
    env.PAYMENTS_LIVE='true';
    for(const enabled of [undefined,'false','TRUE','']) {
      if(enabled===undefined) delete env.CHECKOUT_ENABLED; else env.CHECKOUT_ENABLED=enabled;
      capturedCreate=null;
      const gated=await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID()}));
      assert.equal(gated.status,503);assert.equal(capturedCreate,null);
    }
    env.CHECKOUT_ENABLED='true';
    assert.equal((await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID()}))).status,503);
    env.MANAGED_PAYMENTS='true';env.STRIPE_PRICE_CRYSTALS5='price_crystals5';
    prices.set('price_crystals5',fixturePrice('crystals5',true));
    assert.equal((await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID()}))).status,200);
    env.PAYMENTS_LIVE='false';delete env.MANAGED_PAYMENTS;delete env.CHECKOUT_ENABLED;
    assert.equal((await checkout(checkoutReq({sku:'crystals11',request_id:randomUUID()}))).status,200);
    console.log('ok live Checkout gate: closed by default, exact opt-in, TEST behavior preserved');
    env.MANAGED_PAYMENTS='true';
    for(const sku of Object.keys(shared.catalog)) {
      const price=fixturePrice(sku);prices.set(price.id,price);env['STRIPE_PRICE_'+sku.toUpperCase()]=price.id;
      const request_id=randomUUID();
      assert.equal((await checkout(checkoutReq({sku,request_id,price:'price_client',managed_payments:{enabled:false}}))).status,200);
      assert.deepEqual(capturedCreate.params.managed_payments,{enabled:true});
      assert.equal(capturedCreate.params.currency,'usd');
      assert.deepEqual(capturedCreate.params.line_items,[{quantity:1,price:price.id}]);
      // Managed Payments rejects these Checkout fields (custom_text failed in the TEST project on 2026-10-11).
      for(const unsupported of ['payment_method_types','automatic_tax','adaptive_pricing','tax_id_collection','custom_text'])
        assert.equal(Object.hasOwn(capturedCreate.params,unsupported),false,unsupported);
      assert.equal(capturedCreate.params.metadata.price_id,price.id);
      assert.equal(capturedCreate.params.metadata.payment_mode,'managed');
      const key=capturedCreate.options.idempotencyKey;
      assert.equal((await checkout(checkoutReq({sku,request_id}))).status,200);
      assert.equal(capturedCreate.options.idempotencyKey,key);
    }
    delete env.STRIPE_PRICE_CRYSTALS5;capturedCreate=null;
    assert.equal((await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID()}))).status,503);
    assert.equal(capturedCreate,null);env.STRIPE_PRICE_CRYSTALS5='price_crystals5';
    const validPrice=fixturePrice('crystals5');
    for(const changed of [{active:false},{type:'recurring'},{recurring:{}},{currency:'inr'},
      {unit_amount:99},{tax_behavior:'inclusive'},{livemode:true},
      {product:'prod_unexpanded'},{product:{deleted:true}},{product:{active:false,tax_code:'txcd_fixture'}},
      {product:{active:true,tax_code:null}}]) {
      prices.set(validPrice.id,{...validPrice,...changed});capturedCreate=null;
      assert.equal((await checkout(checkoutReq({sku:'crystals5',request_id:randomUUID()}))).status,503);
      assert.equal(capturedCreate,null);
    }
    prices.set(validPrice.id,validPrice);delete env.MANAGED_PAYMENTS;
    console.log('ok Managed checkout: all 5 prices, exact opt-in, unsupported fields absent, retries and fail-closed configuration');
    load(path.join(root,'supabase/functions/stripe-webhook/index.ts'),()=>deps,deno);const webhook=handler;
    const base={id:'cs_fixture',mode:'payment',status:'complete',payment_status:'unpaid',livemode:false,currency:'usd',amount_total:100,client_reference_id:ids.a,metadata:{owner_id:ids.a,order_id:orderId,sku:'crystals5'}};
    sessions.set(base.id,base);let targetId=base.id;
    async function notify(id='evt_local',live=false,bad=false,type='checkout.session.completed'){
      const payload=JSON.stringify({id,type,livemode:live,data:{object:{id:targetId}}});
      const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
      return webhook(new Request('https://edge.test/webhook',{method:'POST',headers:{'stripe-signature':signature},body:bad?payload+' ':payload}));
    }
    assert.equal((await notify()).status,200);
    let account=await db.query('select crystals from bioconnect_private.accounts where owner_id=$1',[ids.a]);assert.equal(account.rows[0].crystals,0);
    assert.equal((await notify('evt_bad',false,true)).status,400);assert.equal((await notify('evt_live',true)).status,400);
    base.payment_status='paid';base.amount_total=1;assert.equal((await notify()).status,400);
    base.amount_total=100;base.metadata.owner_id=ids.b;assert.equal((await notify()).status,400);
    base.metadata.owner_id=ids.a;
    assert.equal((await notify()).status,200);assert.equal((await notify()).status,200);
    assert.equal((await notify('evt_different')).status,200);
    account=await db.query('select crystals from bioconnect_private.accounts where owner_id=$1',[ids.a]);assert.equal(account.rows[0].crystals,5);
    console.log('ok real webhook handler: raw signature, environment, unpaid/paid, mismatch and duplicate delivery');
    const managedOrder=await admin.rpc('bioconnect_order',{p_owner:ids.a,p_request:randomUUID(),p_sku:'crystals5'});
    const managedBase={...base,id:'cs_managed',amount_subtotal:100,amount_total:110,
      managed_payments:{enabled:true},total_details:{amount_tax:10,amount_discount:0,amount_shipping:0},
      metadata:{...base.metadata,order_id:managedOrder.data.id,payment_mode:'managed',price_id:'price_crystals5'},
      presentment_details:{presentment_currency:'inr',presentment_amount:9200}};
    const item={quantity:1,currency:'usd',amount_subtotal:100,amount_discount:0,amount_tax:10,
      amount_total:110,price:fixturePrice('crystals5')};
    targetId=managedBase.id;
    sessions.set(targetId,managedBase);lineItems.set(managedBase.id,{data:[item],has_more:false});
    for(const changed of [{amount_subtotal:99},{amount_total:109},{currency:'inr'},
      {managed_payments:{enabled:false}},{total_details:{amount_tax:-1,amount_discount:0,amount_shipping:0}},
      {total_details:{amount_tax:10.5,amount_discount:0,amount_shipping:0}},
      {total_details:{amount_tax:10,amount_discount:1,amount_shipping:0}},
      {total_details:{amount_tax:10,amount_discount:0,amount_shipping:1}},
      {metadata:{...managedBase.metadata,price_id:'price_other'}},
      {metadata:{...managedBase.metadata,payment_mode:'direct'}}]) {
      sessions.set(targetId,{...managedBase,...changed});
      assert.equal((await notify('evt_managed')).status,400);
    }
    sessions.set(targetId,managedBase);
    for(const changed of [{quantity:2},{currency:'inr'},{amount_subtotal:99},{amount_total:111},
      {amount_tax:9},{amount_discount:1},{price:{...item.price,unit_amount:99}},
      {price:{...item.price,tax_behavior:'inclusive'}},{price:{...item.price,livemode:true}},
      {price:{...item.price,currency:'inr'}},{price:{...item.price,type:'recurring'}}]) {
      lineItems.set(managedBase.id,{data:[{...item,...changed}],has_more:false});
      assert.equal((await notify('evt_managed')).status,400);
    }
    for(const invalidList of [{data:[],has_more:false},{data:[item,item],has_more:false},{data:[item],has_more:true}]) {
      lineItems.set(managedBase.id,invalidList);assert.equal((await notify('evt_managed')).status,400);
    }
    account=await db.query('select crystals from bioconnect_private.accounts where owner_id=$1',[ids.a]);
    assert.equal(account.rows[0].crystals,5,'Rejected taxed sessions must not grant');
    lineItems.set(managedBase.id,{data:[item],has_more:false});
    // Current creation switch may be OFF: already paid sessions must still be honored.
    env.MANAGED_PAYMENTS='false';env.CHECKOUT_ENABLED='false';
    assert.equal((await notify('evt_managed')).status,200);
    assert.equal((await notify('evt_managed')).status,200);
    assert.equal((await notify('evt_managed_async',false,false,'checkout.session.async_payment_succeeded')).status,200);
    account=await db.query('select crystals from bioconnect_private.accounts where owner_id=$1',[ids.a]);
    assert.equal(account.rows[0].crystals,10,'Tax and local presentment do not change the 5 Crystal grant');
    console.log('ok Managed webhook: tax decomposition, price/quantity/currency, local presentment, duplicate/async delivery and switch OFF');
    let expectedCrystals=10;
    for(const [sku,product] of Object.entries(shared.catalog)) {
      const order=await admin.rpc('bioconnect_order',{p_owner:ids.a,p_request:randomUUID(),p_sku:sku});
      const price=fixturePrice(sku),tax=sku==='crystals5'?0:Math.round(product.amount*0.1);
      const paid={...managedBase,id:'cs_managed_'+sku,amount_subtotal:product.amount,amount_total:product.amount+tax,
        total_details:{amount_tax:tax,amount_discount:0,amount_shipping:0},
        metadata:{...managedBase.metadata,sku,order_id:order.data.id,price_id:price.id}};
      targetId=paid.id;sessions.set(targetId,{...paid,payment_status:'unpaid'});
      lineItems.set(targetId,{has_more:false,data:[{...item,price,amount_subtotal:product.amount,
        amount_tax:tax,amount_total:product.amount+tax}]});
      assert.equal((await notify('evt_all_'+sku,false,false,'checkout.session.async_payment_succeeded')).status,200);
      const before=await db.query('select crystals from bioconnect_private.accounts where owner_id=$1',[ids.a]);
      assert.equal(before.rows[0].crystals,expectedCrystals,'Unpaid async session grants nothing');
      sessions.set(targetId,paid);
      // A transient Stripe read failure must request a retry, not consume the event.
      const validItems=lineItems.get(targetId);lineItems.delete(targetId);
      assert.equal((await notify('evt_all_'+sku)).status,500);
      lineItems.set(targetId,validItems);
      assert.equal((await notify('evt_all_'+sku)).status,200);
      assert.equal((await notify('evt_all_'+sku+'_again')).status,200);
      expectedCrystals+=sku==='no_ads'?0:Number(sku.replace('crystals',''));
      const actual=await db.query('select crystals,no_ads from bioconnect_private.accounts where owner_id=$1',[ids.a]);
      assert.equal(actual.rows[0].crystals,expectedCrystals);
      if(sku==='no_ads')assert.equal(actual.rows[0].no_ads,true);
    }
    console.log('ok all Managed grants: zero/positive tax, exact Crystal packs/No Ads, unpaid async and transient API retry');
    targetId=base.id;
    async function notice(id,type,objectId,live=false){
      const payload=JSON.stringify({id,type,livemode:live,data:{object:{id:objectId}}});
      return webhook(new Request('https://edge.test/webhook',{method:'POST',headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret})},body:payload}));
    }
    const crystals=async()=>(await db.query('select crystals from bioconnect_private.accounts where owner_id=$1',[ids.a])).rows[0].crystals;
    const start=await crystals();base.payment_intent='pi_fixture';
    charges.set('ch_partial',{id:'ch_partial',refunded:false,payment_intent:'pi_fixture'});
    assert.equal((await notice('evt_partial','charge.refunded','ch_partial')).status,200);assert.equal(await crystals(),start);
    charges.set('ch_other',{id:'ch_other',refunded:true,payment_intent:'pi_not_ours'});
    assert.equal((await notice('evt_other','charge.refunded','ch_other')).status,200);assert.equal(await crystals(),start);
    assert.equal((await notice('evt_refund_live','charge.refunded','ch_partial',true)).status,400);
    base.metadata.owner_id=ids.b;charges.set('ch_full',{id:'ch_full',refunded:true,payment_intent:'pi_fixture'});
    assert.equal((await notice('evt_refund','charge.refunded','ch_full')).status,400);assert.equal(await crystals(),start);
    base.metadata.owner_id=ids.a;
    assert.equal((await notice('evt_refund','charge.refunded','ch_full')).status,200);assert.equal(await crystals(),start-5);
    disputes.set('dp_fixture',{id:'dp_fixture',payment_intent:'pi_fixture'});
    assert.equal((await notice('evt_dispute','charge.dispute.created','dp_fixture')).status,200);
    assert.equal((await notice('evt_refund','charge.refunded','ch_full')).status,200);assert.equal(await crystals(),start-5);
    assert.equal((await notice('evt_missing','charge.dispute.created','dp_missing')).status,500);
    const managed30=sessions.get('cs_managed_crystals30');sessions.set(managed30.id,{...managed30,payment_intent:'pi_managed30'});
    charges.set('ch_managed30',{id:'ch_managed30',refunded:true,payment_intent:'pi_managed30'});
    assert.equal((await notice('evt_refund_managed','charge.refunded','ch_managed30')).status,200);assert.equal(await crystals(),start-35);
    console.log('ok real webhook handler: full refund and dispute take back once (direct and Managed); partial refunds and other payments ignored');
  }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
