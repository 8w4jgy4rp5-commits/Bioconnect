const {chromium}=require('C:/Users/tians/Bioconnect/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:2400,height:2000},deviceScaleFactor:+(process.argv[2]||1)});
await p.goto(require('url').pathToFileURL(__dirname+'/compose.html').href);await p.waitForLoadState('networkidle');await p.waitForTimeout(500);
if(process.argv[2]){fs.mkdirSync(__dirname+'/final',{recursive:true});
 for(const id of ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5']) await p.locator('#'+id).screenshot({path:__dirname+'/final/'+id+'.jpg',type:'jpeg',quality:88});}
else await p.screenshot({path:__dirname+'/preview.png'});
await b.close();})();
