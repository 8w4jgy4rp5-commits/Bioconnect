const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const output=path.join(root,'output/playwright/tiptoe-music');
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
 if(path.extname(file)==='.html'){return res.end(fs.readFileSync(file,'utf8').replace(/<script src="(?:https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^\"]*|shared\/supabase-config\.js[^\"]*|shared\/app-sync\.js[^\"]*)"><\/script>/g,''));}
 fs.createReadStream(file).pipe(res);
});
function wav(item){const pcm=Buffer.from(item.pcm,'base64'),head=Buffer.alloc(44);head.write('RIFF');head.writeUInt32LE(36+pcm.length,4);head.write('WAVEfmt ',8);head.writeUInt32LE(16,16);head.writeUInt16LE(1,20);head.writeUInt16LE(2,22);head.writeUInt32LE(item.sampleRate,24);head.writeUInt32LE(item.sampleRate*4,28);head.writeUInt16LE(4,32);head.writeUInt16LE(16,34);head.write('data',36);head.writeUInt32LE(pcm.length,40);return Buffer.concat([head,pcm]);}
async function main(){
 fs.mkdirSync(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});const origin='http://127.0.0.1:'+server.address().port;const errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>console.log(m.text()));
  await page.goto(origin+'/concepts/tiptoe-game-v1/index.html');
  const items=await page.evaluate(async()=>{
   const sr=22050,kinds=BioSound.instruments.map(i=>i.kind),result=[];
   const specs=[{name:'new-plants',n:0},{name:'new-wolf',n:6},{name:'new-full-band',n:10},{name:'new-title',n:0,theme:'title'},{name:'previous-plants',n:0,old:true},{name:'video-reference',reference:true},...Array.from({length:11},(_,n)=>({name:'stage-'+n,n,metricsOnly:true})),{name:'gameplay-mix',n:6,mix:true},{name:'stress',n:10,stress:true,metricsOnly:true}];
   for(const spec of specs){
    const api=spec.reference?PromoSound:spec.old?PreviousBioSound:BioSound,step=spec.reference?api.BEAT:api.beatLength(spec.theme||'game'),beats=spec.reference?api.LOOP_BEATS:api.BEATS,loop=beats*step;
    const duration=spec.mix||spec.stress?12:spec.metricsOnly?4:loop*2;console.log('Rendering '+spec.name+' ('+duration.toFixed(1)+'s)');
    const ctx=new OfflineAudioContext(2,Math.ceil(sr*duration),sr),synth=api.create(ctx);
    for(let b=0;b*step<duration;b++){if(spec.reference)synth.musicBeat(b,b*step);else synth.musicBeat(b,b*step,spec.theme||'game',kinds.slice(0,spec.n));}
    if(spec.mix||spec.stress)for(const at of [1,3,5,8]){synth.effect('place',1,at);synth.effect(spec.stress?'finish':'merge',spec.stress?11:5,at);}
    const buffer=await ctx.startRendering(),offset=spec.mix||spec.stress||spec.metricsOnly?0:Math.round(loop*sr),length=spec.mix||spec.stress||spec.metricsOnly?buffer.length:Math.round(loop*sr);
    const channels=[buffer.getChannelData(0),buffer.getChannelData(1)],pcm=new Int16Array(length*2);let peak=0,sum=0,finite=true;
    for(let i=0;i<length;i++)for(let c=0;c<2;c++){const v=channels[c][offset+i];finite=finite&&Number.isFinite(v);peak=Math.max(peak,Math.abs(v));sum+=v*v;pcm[i*2+c]=Math.round(Math.max(-1,Math.min(1,v))*32767);}
    const seam=offset?Math.abs(channels[0][offset]-channels[0][offset-1]):null;
    let binary='';if(!spec.metricsOnly){const bytes=new Uint8Array(pcm.buffer);for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));}
    result.push({name:spec.name,sampleRate:sr,duration:length/sr,finite,peak,rms:Math.sqrt(sum/(length*2)),seamJump:seam,pcm:spec.metricsOnly?null:btoa(binary)});console.log('Rendered '+spec.name+' peak='+peak.toFixed(4));
   }return result;
  });
  const stats=[];for(const item of items){assert.ok(item.finite&&item.peak>.01&&item.peak<.9,item.name+' bad level');if(item.seamJump!==null)assert.ok(item.seamJump<.025,item.name+' loop jump');if(item.pcm)fs.writeFileSync(path.join(output,item.name+'.wav'),wav(item));const{pcm,...metrics}=item;stats.push(metrics);}
  // Real-time preview controls and mobile layout.
  await page.setViewportSize({width:375,height:812});for(const id of ['newGame','title','previous','reference']){await page.locator('#'+id).click();await page.waitForTimeout(200);assert.match(await page.locator('#status').innerText(),/Playing/);await page.locator('#stop').click();}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'preview-mobile.png')});
  // Verify the real game's unlock, music state, animal layers, ad mute, and reset.
  await page.route('https://**/*',r=>r.abort());await page.goto(origin+'/index.html');await page.locator('#startBtn').focus();await page.locator('#startBtn').press('Enter');await page.locator('#countdown').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>BioAudio.band().theme),'game');
  await page.evaluate(()=>BioAudio.discover(['rabbit','wolf','elephant']));await page.waitForFunction(()=>BioAudio.band().playing.includes('elephant'),null,{timeout:4000});
  await page.evaluate(()=>BioAudio.ad(true));assert.equal(await page.evaluate(()=>BioAudio.band().adMuted),true);await page.evaluate(()=>{BioAudio.ad(false);BioAudio.reset();});assert.equal(await page.evaluate(()=>BioAudio.band().discovered.length),0);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'render-metrics.json'),JSON.stringify(stats,null,2)+'\n');console.log(JSON.stringify(stats,null,2));console.log('Preview controls, 375px layout, game audio lifecycle passed; page errors 0');
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
