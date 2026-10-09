// A loopback-only, disposable database and simulated external services.
const http=require('http'), fs=require('fs'), path=require('path');
const {randomUUID}=require('crypto');
const {createDB,ids}=require('./db.cjs');
const products={crystals5:100,crystals11:200,crystals30:500,crystals65:1000,no_ads:300};
async function createLocalServer(port=0) {
  const db=await createDB(); const root=path.resolve(__dirname,'..'), orders=new Map();
  let dropNextRevival=false;
  const server=http.createServer(async (req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    try {
      if (req.method==='POST' && url.pathname.startsWith('/__test/')) {
        let raw=''; for await(const chunk of req) {raw+=chunk; if(raw.length>10000) throw Error('Too large');}
        const b=JSON.parse(raw), route=url.pathname.slice(8);
        if (!Object.values(ids).includes(b.owner) && route!=='pay' && route!=='drop-next' && route!=='drop-reset') throw Error('Unknown test account');
        if(route==='rpc') {
          const allowed={bioconnect_wallet:[],bioconnect_claim_welcome:[],bioconnect_revive:['p_run_id','p_source'],bioconnect_order_status:['p_order']};
          const params=allowed[b.name]; if(!params) throw Error('Unknown RPC');
          const args=params.map(k=>b.args[k]);
          const sql='select public.'+b.name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as result';
          const rows=await db.as(b.owner,sql,args);
          if(b.name==='bioconnect_revive' && dropNextRevival) {req.socket.destroy();return;}
          return send(rows[0].result);
        }
        if(route==='checkout') {
          if(!Object.hasOwn(products,b.sku)) throw Error('Unknown product');
          const rows=await db.as(null,'select public.bioconnect_order($1,$2,$3) as result',[b.owner,b.request_id,b.sku],'service_role');
          const order=rows[0].result; orders.set(order.id,order);
          return send({url:'/__test/checkout-page?order='+order.id,order_id:order.id});
        }
        if(route==='pay') {
          const o=orders.get(b.order);if(!o) throw Error('Unknown order');
          await db.as(null,'select public.bioconnect_fulfill($1,$2,$3,$4,$5,$6,$7)',[o.id,o.owner_id,'cs_test_'+o.id,'evt_test_'+o.id,o.sku,products[o.sku],'usd'],'service_role');
          return send({ok:true});
        }
        if(route==='drop-next') {dropNextRevival=true;return send({ok:true});}
        if(route==='drop-reset') {dropNextRevival=false;return send({ok:true});}
        throw Error('Unknown test route');
      }
      if(url.pathname==='/__test/checkout-page') {
        const order=orders.get(url.searchParams.get('order')); if(!order) throw Error('Unknown order');
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
        res.end(`<!doctype html><meta name="viewport" content="width=device-width"><h1>Local simulated checkout</h1><p>No Stripe connection. No money moves.</p><button id="pay">Confirm simulated payment</button><button id="unpaid">Return without payment confirmation</button><button id="cancel">Cancel</button><script>
          document.getElementById('pay').onclick=async()=>{await fetch('/__test/pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:'${order.id}'})});location.href='/?payment=returned'};
          document.getElementById('unpaid').onclick=()=>location.href='/?payment=returned';
          document.getElementById('cancel').onclick=()=>location.href='/?payment=cancelled';</script>`);return;
      }
      let pathname=decodeURIComponent(url.pathname);if(pathname==='/' || pathname==='/plain.html') pathname='/index.html';
      const file=path.resolve(root,'.'+pathname);
      if(!file.startsWith(root+path.sep) || pathname.includes('node_modules') || pathname.includes('.git')) {res.writeHead(403);res.end();return;}
      let data=fs.readFileSync(file);
      if(pathname==='/index.html') {
        let html=data.toString().replace(/<script src="(?:https:\/\/cdn.jsdelivr.net\/npm\/@supabase[^\"]*|shared\/supabase-config[^\"]*|shared\/app-sync[^\"]*)"><\/script>/g,'');
        // Simulated previews never send real production analytics.
        html=html.replace(/<script[^>]*src="https:\/\/static\.cloudflareinsights\.com\/[^>]*><\/script>/g,'');
        if(url.pathname!=='/plain.html') html=html.replace('<script src="monetization.js','<script src="/__test/adapter.js"></script>\n<script src="monetization.js'); data=Buffer.from(html);
      }
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.wav':'audio/wav'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
    } catch(e) { if(req.method==='POST') send({error:e.message},400);else {res.writeHead(404);res.end('Not found');} }
  });
  // Adapter URL is deliberately outside the normal game assets.
  server.prependListener('request',(req,res)=>{
    if(req.url==='/__test/adapter.js') {req.url='/test/local-adapter.js';}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {url:'http://127.0.0.1:'+server.address().port,db,
    close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();}};
}
module.exports={createLocalServer};
if(require.main===module) createLocalServer(8778).then(s=>{
  console.log(s.url+' — LOCAL SIMULATION only');
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await s.close();process.exit();});
}).catch(e=>{console.error(e);process.exitCode=1});
