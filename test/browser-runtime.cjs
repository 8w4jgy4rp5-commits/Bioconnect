// Repo-owned isolated browser tests. This WebKit build is not Safari on an Apple device.
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const engine=process.argv.includes('--webkit')?'webkit':'chromium';
async function launchTestBrowser() {
  return engine==='webkit'
    ? webkit.launch({headless:true})
    : chromium.launch({headless:true,channel:process.env.BIOCONNECT_BROWSER_CHANNEL||'chrome'});
}
function evidenceDir(group) {
  const base=path.join(__dirname,'../output/playwright',group);
  return engine==='webkit'?path.join(base,'webkit'):base;
}
module.exports={engine,launchTestBrowser,evidenceDir};
