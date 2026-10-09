// Loopback preview with REAL sandbox Auth/DB. No simulated accounts or payments.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const sourceRoot=fs.realpathSync(root);
const project = require('../supabase/sandbox/project.json');
const expectedRef = 'jcbohkzjmgbpsaqkrirg';
if (project.projectRef !== expectedRef || project.url !== `https://${expectedRef}.supabase.co`
  || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(project.publishableKey)) throw Error('Sandbox project config rejected');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp',
  '.jpg':'image/jpeg','.wav':'audio/wav','.mp3':'audio/mpeg','.ico':'image/x-icon'};
async function createSandboxServer(port=8779, {testPayments=false,revivalTest=false,testAds=false}={}) {
  if (typeof revivalTest!=='boolean' || revivalTest && testPayments) throw Error('Revival verification requires explicit opt-in and payments OFF');
  if (typeof testPayments!=='boolean') throw Error('Explicit testPayments boolean required');
  if (typeof testAds!=='boolean' || testAds && (testPayments || revivalTest)) throw Error('Official TEST ads require payments and revival transport faults OFF');
  const server = http.createServer((req,res) => {
    const send = (status,data,type='text/plain; charset=utf-8') => {
      res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        // TEST creatives are inline frames. Block all live ad frames/beacons at the browser boundary.
        ...(testAds?{'Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com/pagead/js/ https://pagead2.googlesyndication.com/pagead/managed/js/; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://jcbohkzjmgbpsaqkrirg.supabase.co wss://jcbohkzjmgbpsaqkrirg.supabase.co; frame-src 'self'; object-src 'none'; base-uri 'self'"}:{})});res.end(data);
    };
    if (req.headers.host !== `127.0.0.1:${server.address().port}`) return send(403,'Loopback host required');
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405,'Read-only preview server');
    try {
      const url = new URL(req.url,'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      // Windows accepts backslashes and case aliases as filesystem paths.
      // Reject ambiguous separators and apply every protected route case-insensitively.
      if (pathname.includes('\\') || pathname.includes('//') || pathname.includes('\0') || pathname.includes('~')
        || pathname.split('/').some(p=>p==='.' || p==='..')) return send(403,'Noncanonical asset path');
      if (pathname === '/') pathname='/index.html';
      const lowerPath=pathname.toLowerCase();
      if (lowerPath === '/shared/supabase-config.js') return send(200,
        `const SUPABASE_URL=${JSON.stringify(project.url)};\nconst SUPABASE_ANON_KEY=${JSON.stringify(project.publishableKey)};\nconst supabaseClient=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{storageKey:'bioconnect-sandbox-${expectedRef}-auth'},${revivalTest?'global:{fetch:window.__BIOCONNECT_SANDBOX_FETCH__},':''}});\n`,types['.js']);
      if (lowerPath === '/shared/monetization-config.js') return send(200,
        `window.BioMonetizationConfig=Object.freeze({paymentsEnabled:${testPayments},adsEnabled:${testAds},adClient:${JSON.stringify(testAds?'ca-pub-123456789':'')},adTestMode:true});`,types['.js']);
      // The pinned local SDK avoids depending on the production CDN script.
      if (lowerPath === '/__sandbox/supabase.js') return send(200,
        fs.readFileSync(path.join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js')),types['.js']);
      if (lowerPath === '/__sandbox/ads-test.js') return testAds ? send(200,fs.readFileSync(path.join(root,'test/sandbox-ads-ui.js')),types['.js']) : send(403,'Verification disabled');
      if (lowerPath === '/__sandbox/revival-test.js') return revivalTest ? send(200,fs.readFileSync(path.join(root,'test/sandbox-revival-ui.js')),types['.js']) : send(403,'Verification disabled');
      if (lowerPath === '/index.html') pathname='/index.html';
      const file = path.resolve(root,'.'+pathname), relative=path.relative(root,file);
      const parts=relative.split(path.sep);
      if (relative.startsWith('..') || path.isAbsolute(relative) || parts.some(p=>p.startsWith('.'))
        || !types[path.extname(file)] || ['node_modules','supabase','test','docs','output'].includes(parts[0].toLowerCase())) return send(403,'Not a preview asset');
      // Resolve filesystem aliases/reparse points before reading any static source.
      const source=fs.realpathSync(file),sourceRelative=path.relative(sourceRoot,source),sourceParts=sourceRelative.split(path.sep);
      const protectedSources=['shared/supabase-config.js','shared/monetization-config.js','index.html'];
      if (sourceRelative.startsWith('..') || path.isAbsolute(sourceRelative)
        || sourceParts.some(p=>p.startsWith('.'))
        || ['node_modules','supabase','test','docs','output'].includes(sourceParts[0].toLowerCase())
        || (pathname!=='/index.html' && protectedSources.includes(sourceParts.join('/').toLowerCase()))) return send(403,'Not a preview source');
      let data=fs.readFileSync(source);
      if(pathname==='/index.html') {
        let html=data.toString();
        html=html.replace(/<script[^>]*src="https:\/\/static\.cloudflareinsights\.com\/[^>]*><\/script>/g,'');
        html=html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/g,'/__sandbox/supabase.js');
        if (testAds) html=html.replace('</head>', '<script defer src="/__sandbox/ads-test.js"></script></head>');
        if (revivalTest) html=html.replace('<script src="shared/supabase-config.js', '<script src="/__sandbox/revival-test.js"></script>\n<script src="shared/supabase-config.js');
        html=html.replace('</head>', '<style>body{padding-top:28px!important}#sandboxBanner{position:fixed;top:0;left:0;right:0;z-index:9000;background:#674493;color:white;text-align:center;font:12px/24px sans-serif;pointer-events:none}</style></head>');
        html=html.replace(/<body([^>]*)>/,`<body$1><div id="sandboxBanner">SANDBOX · Real test DB · ${testAds?'Official Google TEST ads · Guest verification · Payments OFF':revivalTest?'STAGED BOARD / TRANSPORT FAULT TEST · Payments/ads OFF':testPayments?'Stripe TEST payments · Ads OFF':'Payments/ads OFF'}</div>`);
        data=Buffer.from(html);
      }
      send(200,data,types[path.extname(file)]);
    } catch(e) { send(404,'Not found'); }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
module.exports={createSandboxServer};
if(require.main===module) {
  const args=process.argv.slice(2);
  if(args.some(a=>!['--payments-test','--revival-test','--ads-test'].includes(a))) throw Error('Only --payments-test, --revival-test or --ads-test is supported');
  const testPayments=args.includes('--payments-test');
  const testAds=args.includes('--ads-test');
  createSandboxServer(testAds?8780:8779,{testPayments,testAds,revivalTest:args.includes('--revival-test')}).then(s=>{
  console.log(s.url+' — REAL bioconnect-sandbox DB; '+(testAds?'official Google TEST ads; guest only; payments OFF':testPayments?'Stripe TEST payments; ads OFF':'payments/ads OFF'));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await s.close();process.exit();});
}).catch(e=>{console.error(e);process.exitCode=1;});

}
