const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const Stripe=require('stripe'); const {randomUUID}=require('crypto'); const {createDB,ids}=require('./db.cjs');
const root=path.resolve(__dirname,'..');
async function main(){
  // Typecheck deployable code with the npm imports mapped to the SAME installed versions.
  const typeRoot=path.join(root,'output','edge-typecheck'); fs.mkdirSync(typeRoot,{recursive:true});
  const fileList=['_shared/payment.ts','checkout/index.ts','stripe-webhook/index.ts'];
  for(const f of fileList){const to=path.join(typeRoot,f);fs.mkdirSync(path.dirname(to),{recursive:true});
    fs.writeFileSync(to,fs.readFileSync(path.join(root,'supabase/functions',f),'utf8').replace('npm:stripe@18.5.0','stripe').replace('npm:@supabase/supabase-js@2.57.4','@supabase/supabase-js'));}
  const shim=path.join(typeRoot,'deno.d.ts');fs.writeFileSync(shim,'declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };');
  const program=ts.createProgram([...fileList.map(f=>path.join(typeRoot,f)),shim],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,strict:true,skipLibCheck:true,noEmit:true,allowImportingTsExtensions:true,esModuleInterop:true});
  const errors=ts.getPreEmitDiagnostics(program);if(errors.length)throw Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
  console.log('ok Edge Function TypeScript check');
  const db=await createDB(), secret='whsec_local_fixture',site='https://bioconnect.example.test/';
  const env={STRIPE_SECRET_KEY:'sk_test_local_fixture',STRIPE_WEBHOOK_SECRET:secret,BIOCONNECT_SITE_URL:site,PAYMENTS_LIVE:'false'};
  const stripe=new Stripe(env.STRIPE_SECRET_KEY), sessions=new Map();
  const admin={auth:{getUser:async jwt=>({data:{user:jwt==='valid-a'?{id:ids.a}:null},error:jwt==='valid-a'?null:Error('bad token')})},rpc:async(name,args)=>{
    const params=name==='bioconnect_order'?['p_owner','p_request','p_sku']:['p_order','p_owner','p_session','p_event','p_sku','p_amount','p_currency'];
    try{const rows=await db.as(null,'select public.'+name+'('+params.map((_,i)=>'$'+(i+1)).join(',')+') as result',params.map(p=>args[p]),'service_role');return {data:rows[0].result,error:null};}
    catch(error){return {data:null,error};}
  }};
  let capturedCreate=null;
  stripe.checkout.sessions.create=async(params,options)=>{capturedCreate={params,options};return {url:'https://checkout.stripe.com/c/pay/local-test',id:'cs_local'};};
  stripe.checkout.sessions.retrieve=async id=>{if(!sessions.has(id))throw Error('No fixture');return sessions.get(id);};
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
    load(path.join(root,'supabase/functions/stripe-webhook/index.ts'),()=>deps,deno);const webhook=handler;
    const base={id:'cs_fixture',mode:'payment',status:'complete',payment_status:'unpaid',livemode:false,currency:'usd',amount_total:100,client_reference_id:ids.a,metadata:{owner_id:ids.a,order_id:orderId,sku:'crystals5'}};
    sessions.set(base.id,base);
    async function notify(id='evt_local',live=false,bad=false,type='checkout.session.completed'){
      const payload=JSON.stringify({id,type,livemode:live,data:{object:{id:base.id}}});
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
  }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
