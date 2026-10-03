// Planner bot — how high can a player who lays the board out like a 2048
// player climb? Not part of the game. Added 2026-10-03 (rules 17).
//
//   node planner.js                 20 runs, 3 placements per tick, 2-ply
//   RUNS=40 P=2 node planner.js     fewer placements per tick = slower hands
//   OVER='{"BIG_STAMINA_PCT":100}' node planner.js   sweep a knob
//
// It keeps a strictly descending chain along a snake path (row 0 left to
// right, row 1 right to left, ...) and searches the current tile and the
// next one in hand against the real growFrom. It is a stronger player than
// the bots in sim.js, and still a lower bound for a person who plans.
// Slow: about 20-30 seconds per run with D2 (the default here).
// Experiment: how far can a planning bot climb when it may place P tiles per tick?
const fs=require('fs'),vm=require('vm');
const SRC=process.env.SRC||require('path').join(__dirname,'script.js');
function load(over){let code=fs.readFileSync(SRC,'utf8');
 for(const[k,v]of Object.entries(over||{})){const re=new RegExp('const '+k+' = [0-9]+;');if(!re.test(code))throw new Error('no '+k);code=code.replace(re,'const '+k+' = '+v+';');}
 const ctx={console,Math,Number,Set,Array,JSON,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame(){},document:{addEventListener(){},querySelectorAll:()=>[],getElementById:()=>null},window:{}};
 ctx.globalThis=ctx;vm.createContext(ctx);
 vm.runInContext(code+'\n;globalThis.__x={state,el,CELLS,SIZE,MERGE_AT,ANIMALS,PLANTS,GROWS_INTO,LADDER};',ctx);
 ctx.render=()=>{};ctx.setTicker=()=>{};ctx.syncClock=()=>{};ctx.replayChain=()=>{};ctx.announceFirsts=()=>{};
 const x=ctx.__x;for(const k of['gameover','goTitle','goScore','goLevel','goNote'])x.el[k]={};x.el.goAgain={focus(){}};x.ctx=ctx;return x;}
const X=load(JSON.parse(process.env.OVER||'{}'));const {ctx,state,CELLS,SIZE,ANIMALS,LADDER}=X;
const R=k=>LADDER.indexOf(k);
// snake weights: row0 L->R, row1 R->L ... highest at index 0
const W=[];{let o=[];for(let y=0;y<SIZE;y++){const r=[];for(let x=0;x<SIZE;x++)r.push(y*SIZE+x);if(y%2)r.reverse();o=o.concat(r);}o.forEach((c,n)=>W[c]=Math.pow(0.6,n));}
const SN=[],ORD=[];{let o=[];for(let y=0;y<SIZE;y++){const r=[];for(let x=0;x<SIZE;x++)r.push(y*SIZE+x);if(y%2)r.reverse();o=o.concat(r);}o.forEach((c,n)=>{SN[c]=n;ORD[n]=c;});}
const K=+(process.env.K||1);
function evalCells(cells){
 // chain = strictly decreasing ranks along the snake from position 0
 let s=0,prev=99,n=0,chainEnd=0;
 for(;n<CELLS;n++){const c=cells[ORD[n]];if(!c)break;if(c.big!=null){continue;}const r=R(c.kind);if(r<0||r>=prev)break;s+=Math.pow(2,r)*10;prev=r;}
 chainEnd=n;
 let empty=0;
 for(let m=0;m<CELLS;m++){const i=ORD[m];const c=cells[i];if(!c){empty++;continue;}if(m<chainEnd||c.big!=null)continue;const r=R(c.kind);
   if(r<0)s-=30; else s-=Math.pow(2,r)*K*(1+ (m-chainEnd)*0.1);}
 // the cell right after the chain should be empty
 if(chainEnd<CELLS&&!cells[ORD[chainEnd]])s+=20;
 return s+empty*4;}
function sim(cells,i,h){const c2=cells.map(c=>c?Object.assign({},c):null);c2[i]=ctx.makeTile(h);try{ctx.growFrom(i,c2,true);}catch(e){}return c2;}
function choose(hand){let best=null,bs=-Infinity;const h2=state.stock[1];
 for(let i=0;i<CELLS;i++){if(state.cells[i])continue;
  const c1=sim(state.cells,i,hand);let s=evalCells(c1);
  if(h2&&(process.env.D2!=='0')){let b2=-Infinity;for(let j=0;j<CELLS;j++){if(c1[j])continue;const v=evalCells(sim(c1,j,h2));if(v>b2)b2=v;}if(b2>-Infinity)s=b2;}
  for(const n of ctx.neighbours(i)){const c=state.cells[n];if(c&&ANIMALS[c.kind]){const cfg=ANIMALS[c.kind];if(cfg.diet.indexOf(hand)>=0&&c.clock>=cfg.eatAt-1&&!ctx.pickMeal(n,cfg))s+=Math.pow(2,R(c.kind))*3;}}
  s+=Math.random()*0.01;if(s>bs){bs=s;best=i;}}
 return best;}
const P=+process.env.P||3, RUNS=+process.env.RUNS||20, RES=+(process.env.RES||3);
let tops=new Array(LADDER.length).fill(0),tk=[],eleT=[];
for(let r=0;r<RUNS;r++){ctx.newGame();let top=0,eAt=0;
 const spend=()=>{let n=0;while(n<P&&!state.over&&state.stock.length){const open=state.cells.filter(c=>!c).length;if(!open)break;
   const h=state.stock[0];const i=choose(h);if(i==null)break;
   // reserve: only place non-merging tiles if room
   const cells=state.cells.map(c=>c?Object.assign({},c):null);cells[i]=ctx.makeTile(h);const ev=ctx.growFrom(i,cells,true);
   if(!ev.length&&open<=RES&&n>0)break;
   ctx.placeTile(i);n++;}};
 spend();let g=0;
 while(!state.over&&g++<5000){ctx.worldTick();if(state.over)break;spend();top=Math.max(top,R(state.topKind));if(!eAt&&state.topKind==='elephant')eAt=state.ticks;}
 top=Math.max(top,R(state.topKind));tops[top]++;tk.push(state.ticks);if(eAt)eleT.push(eAt);}
const avg=a=>a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length):0;
let cum=0;const reach=[];for(let k=LADDER.length-1;k>=0;k--){cum+=tops[k];reach[k]=Math.round(100*cum/RUNS);}
console.log(`P=${P} RES=${RES} runs=${RUNS} ticks=${avg(tk)} | `+LADDER.slice(5).map((k,j)=>k+' '+reach[j+5]+'%').join(' ')+(eleT.length?` | elephant@${avg(eleT)}`:''));
