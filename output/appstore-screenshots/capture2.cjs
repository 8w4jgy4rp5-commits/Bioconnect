const R='C:/Users/tians/Bioconnect/';
const {createLocalServer}=require(R+'test/local-server.cjs');
const {chromium}=require(R+'node_modules/playwright');
const OUT=__dirname+'/shots/';
(async()=>{
  const server=await createLocalServer();
  const b=await chromium.launch({headless:true,channel:'chrome'});
  const ctx=await b.newContext({viewport:{width:393,height:800},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto(server.url);await p.waitForTimeout(600);
  await p.addStyleTag({content:'#localTestBanner,#pauseNote{display:none!important}'});
  await p.waitForTimeout(400);await p.screenshot({path:OUT+'title.png'});
  await p.locator('#startBtn').focus();await p.locator('#startBtn').press('Enter');
  if(await p.locator('#lessonBar').isVisible()) await p.locator('#lessonSkip').click();
  await p.locator('#countdown').waitFor({state:'hidden'});
  const set=async(cells,extra)=>p.evaluate(([cells,extra])=>{
    setPaused(true);state.cells.fill(null);
    cells.forEach((c,i)=>{if(c){const [k,cl]=c.split(':');state.cells[i]={kind:k,clock:+(cl||0),born:'raised'};}});
    Object.assign(state,extra);render();
  },[cells,extra]);
  const shot=async(n,ms=700)=>{await p.waitForTimeout(ms);await p.screenshot({path:OUT+n+'.png'});};
  // meadow
  await set(['bear','grass','rabbit','sprout','fox', 'deer','','wolf','grass','zebra', 'grass','rabbit','sprout','buffalo','', 'fox','','grass','deer','lion', 'sprout','zebra','','rabbit','grass'],
    {score:4820,ticks:60,stock:['rabbit','grass','sprout'],topKind:'lion'});
  await p.evaluate(()=>setTicker('Two of a kind grow into the next animal.'));await shot('meadow');
  // chain
  await set(['','sprout','grass','rabbit','fox', 'wolf','tiger','lion','tiger','deer', 'grass','bear','lion','zebra','zebra', 'rabbit','tiger','fox','buffalo','lion', 'sprout','grass','tiger','rabbit','grass'],
    {score:2400,ticks:40,stock:['sprout','grass','rabbit'],topKind:'tiger',seen:{sprout:1,grass:1,rabbit:1,fox:1,deer:1,zebra:1,buffalo:1,wolf:1,bear:1,lion:1,tiger:1}});
  await p.evaluate(()=>placeTile(0));
  for(let t=1;t<=10;t++) await shot('chain-'+t,110);
  // hungry
  await set(['grass','wolf:30','','rabbit:14','sprout', 'fox:16','rabbit','deer:20','grass','', 'grass','','lion:40','zebra','fox', 'bear:30','deer','','buffalo:18','grass', 'sprout','rabbit:10','grass','wolf','sprout'],
    {score:3100,ticks:80,stock:['rabbit','deer','grass'],topKind:'lion'});
  await p.evaluate(()=>setTicker('The lion is starving. Feed it before winter bites.'));await shot('hungry');
  // winter
  await set(['stone','grass','tiger','','bones', 'lion','rabbit','','stone','deer', 'scrub','bear','zebra','grass','wolf', '','buffalo','stone','fox','grass', 'deer','','sprout','lion','stone'],
    {score:7400,ticks:150,stock:['deer','fox','grass'],topKind:'tiger'});
  await p.evaluate(()=>setTicker('Winter. Stones rise, points ×7. Hold the line.'));await shot('winter');
  // elephant
  await set(['tiger','lion','grass','bear','wolf', 'deer','elephant','','zebra','grass', 'buffalo','','fox','tiger','', 'grass','rabbit','lion','','deer', 'sprout','','zebra','bear','grass'],
    {score:9100,ticks:140,stock:['deer','fox','grass'],topKind:'elephant',elephants:1});
  await shot('board-elephant',400);
  await p.evaluate(()=>celebrate(2000000,false));
  await shot('elephant',2500);
  await p.evaluate(()=>closeCelebration(true));
  await p.evaluate(()=>openLedger());await shot('ledger',900);
  await b.close();await server.close();
})();
