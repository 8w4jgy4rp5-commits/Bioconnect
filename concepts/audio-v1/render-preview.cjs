// Run with Playwright available through NODE_PATH. Uses the game's real synth.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const output = __dirname;
fs.mkdirSync(output, { recursive: true });
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.BIOCONNECT_PREVIEW_URL || 'http://127.0.0.1:8770/');
    const rendered = await page.evaluate(async () => {
      const sampleRate = 44100;
      const specs = [
        { name:'meadow-steps', duration:80, music:true, trimLoop:true },
        { name:'grass-plant', duration:1, effects:[['place',1,.15]] },
        { name:'animal-chain', duration:2, effects:[['place',1,.15],['merge',5,.15]] },
        { name:'gameplay-mix', duration:12, music:true, effects:[['place',1,2],['place',1,4],['merge',3,4],['place',1,7],['merge',5,7],['place',1,10]] },
        { name:'stress', duration:5, music:true, effects:[['place',1,.05],['finish',11,.05],['place',1,.35],['merge',8,.35],['eat',10,.4]] }
      ];
      const results = [];
      for (const spec of specs) {
        const ctx = new OfflineAudioContext(2, Math.round(sampleRate * spec.duration), sampleRate);
        const synth = BioSound.create(ctx);
        if (spec.music) for (let n = 0; n * BioSound.BEAT < spec.duration; n++) synth.musicBeat(n, n * BioSound.BEAT);
        for (const [kind,count,t] of spec.effects || []) synth.effect(kind,count,t);
        const buffer = await ctx.startRendering();
        const offset = spec.trimLoop ? sampleRate * 40 : 0;
        const length = buffer.length - offset;
        const pcm = new Int16Array(length * 2);
        let peak=0, sum=0, finite=true;
        const channels = [buffer.getChannelData(0),buffer.getChannelData(1)];
        for (let i=0;i<length;i++) for (let c=0;c<2;c++) {
          const v=channels[c][i+offset];
          finite = finite && Number.isFinite(v); peak=Math.max(peak,Math.abs(v)); sum+=v*v;
          pcm[i*2+c] = Math.round(Math.max(-1,Math.min(1,v))*32767);
        }
        const bytes=new Uint8Array(pcm.buffer);
        let binary=''; for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
        results.push({name:spec.name, length, sampleRate, finite, peak, rms:Math.sqrt(sum/(length*2)), seamJump:spec.trimLoop?Math.abs(channels[0][offset]-channels[0][buffer.length-1]):null, pcm:btoa(binary)});
      }
      return results;
    });
    const stats=[];
    for(const item of rendered) {
      const pcm=Buffer.from(item.pcm,'base64');
      assert(item.finite && item.peak>.01 && item.peak<.9, item.name+' invalid audio');
      if(item.seamJump!==null) assert(item.seamJump<.025,'loop seam discontinuity');
      const header=Buffer.alloc(44);
      header.write('RIFF'); header.writeUInt32LE(36+pcm.length,4); header.write('WAVEfmt ',8);
      header.writeUInt32LE(16,16); header.writeUInt16LE(1,20); header.writeUInt16LE(2,22);
      header.writeUInt32LE(item.sampleRate,24); header.writeUInt32LE(item.sampleRate*4,28);
      header.writeUInt16LE(4,32); header.writeUInt16LE(16,34); header.write('data',36); header.writeUInt32LE(pcm.length,40);
      if(item.name!=='stress') fs.writeFileSync(path.join(output,item.name+'.wav'),Buffer.concat([header,pcm]));
      const {pcm:unused,...metrics}=item; stats.push(metrics);
    }
    fs.writeFileSync(path.join(output,'render-metrics.json'),JSON.stringify(stats,null,2)+'\n');
    console.log(JSON.stringify(stats,null,2));
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });
