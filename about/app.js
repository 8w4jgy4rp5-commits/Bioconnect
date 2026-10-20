'use strict';
const translations = {
  ja: {
    skip:'本文へスキップ',navStory:'どんなゲーム？',navMoments:'プレイ画面',navConnect:'つながる',eyebrow:'A CURIOUS LITTLE FOOD CHAIN',
    heroTitle:'つながる。\n育つ。\nあれ、きみは？',heroBody:'小さな芽から、まさかのゾウまで。\nかわいくて、ちょっとふしぎな食物連鎖パズル。',play:'ブラウザで遊ぶ',watch:'プレイ映像を見る',free:'インストール不要 · 基本プレイ無料 · PC / スマートフォン',sceneLabel:'小さな森の、とある出会い。',animationNote:'紹介アニメーション',pause:'一時停止 Ⅱ',resume:'再生 ▷',ribbon:'ひとつ置けば、森が変わる。',explore:'小さな生態系をのぞく ↓',
    storyTitle:'かわいいだけでは、\n生きていけない。',storyIntro:'同じものをつなげて育てる。\nでもここには、食べる・食べられる関係も。\n次の一手が、小さな森の運命を変えます。',step1Title:'出会ったら、次のいのち。',step1Body:'同じ植物や動物を隣り合わせて合体。ウサギがキツネに、キツネがシカに。連鎖がつながれば、森は一気ににぎやかに。',step2Title:'おなかがすくのは、お互いさま。',step2Body:'動物たちは食べて生きています。育てたい仲間と、近づく天敵。合体だけでは決まらない、食物連鎖のかけひき。',step3Title:'その先に、ゾウがいる。',step3Body:'小さな芽から始まる長い旅。季節が移る森で、どこまで育てられる？ めったに出会えないゾウを、あなたの手で。',
    momentsTitle:'小さな盤面。\n思いがけないドラマ。',momentsIntro:'ほんとのプレイは、こんな感じ。\n画像を押すと、大きく見られます。',shot1Title:'連鎖は、突然に。',shot1Body:'ひとつの配置から、次々と合体。',shot2Title:'ようこそ、オオカミ。',shot2Body:'新しい仲間で、生態系も変わる。',shot3Title:'もう一手、もう一回。',shot3Body:'大きく育った、その先が見たい。',captureNote:'実際のゲーム画面より。撮影時のバージョンのため、現在の表示と異なる場合があります。',
    connectTitle:'森の外でも、\nつながろう。',connectBody:'短い動画、開発のひとこま、\nそして、あなたの「できた！」。\nBioconnectのつづきは、ここから。',platformNote:'各媒体のアカウント・投稿先は、公開後に順次追加します。',comingSoon:'準備中',ctaTitle:'さて、何に育つかな。',ctaNote:'小さな芽から、はじめよう。',privacy:'プライバシーポリシー',preview:'LP DESIGN PREVIEW',mediaTitle:'Bioconnect / 実際のプレイ画面',close:'閉じる ×',sceneAlt:'紹介アニメ：2匹のウサギが合体してキツネになり、きょとんとする',description:'つなげて、育てて、ちょっとふしぎな食物連鎖。Bioconnectはブラウザで遊べる合体パズルです。',shotAlt:['5連鎖でバッファローが登場する実際のプレイ画面','6連鎖でオオカミが登場する実際のプレイ画面','7連鎖でクマが登場する実際のプレイ画面']
  },
  en: {
    skip:'Skip to content',navStory:'The game',navMoments:'In the meadow',navConnect:'Follow along',eyebrow:'A CURIOUS LITTLE FOOD CHAIN',
    heroTitle:'A little merge.\nA little magic.\nWait… who are you?',heroBody:'From a tiny sprout to a rather unexpected elephant.\nA cute, curious puzzle with a food chain of its own.',play:'Play in your browser',watch:'Watch gameplay',free:'No download · Free to play · Desktop & mobile',sceneLabel:'A chance encounter in the meadow.',animationNote:'Promotional animation',pause:'Pause Ⅱ',resume:'Play ▷',ribbon:'One little move. A whole new meadow.',explore:'Meet the ecosystem ↓',
    storyTitle:'Cute doesn’t mean\na quiet life.',storyIntro:'Connect matching plants and animals to help them grow.\nBut everyone needs to eat.\nYour next move could change everything.',step1Title:'A meeting. A whole new creature.',step1Body:'Place matching plants or animals next to each other to merge. Rabbits become a fox; foxes become a deer. Set off a chain and watch the meadow grow.',step2Title:'Everyone gets a little hungry.',step2Body:'Your animals need food to survive. A growing friend, a hungry predator. Find your way through a food chain that keeps you thinking.',step3Title:'Somewhere, there’s an elephant.',step3Body:'A long journey from a tiny sprout. As the seasons turn, how far can you grow? Raise the rarest animal in the meadow yourself.',
    momentsTitle:'A little board.\nUnexpected stories.',momentsIntro:'A peek at the real game.\nTap any screenshot for a closer look.',shot1Title:'And then it all connects.',shot1Body:'One placement. A whole chain of surprises.',shot2Title:'Welcome to the meadow, wolf.',shot2Body:'A new arrival changes the food chain.',shot3Title:'One more move. One more try.',shot3Body:'There’s always something bigger to discover.',captureNote:'Actual gameplay captures. Recorded on an earlier version; the current interface may differ.',
    connectTitle:'Beyond the meadow.\nStay connected.',connectBody:'Little videos, notes from development,\nand your “I finally did it!” moments.\nFind more Bioconnect here.',platformNote:'Account and post links will be added as each channel becomes available.',comingSoon:'Coming soon',ctaTitle:'What will you grow?',ctaNote:'It all starts with a little sprout.',privacy:'Privacy policy',preview:'LP DESIGN PREVIEW',mediaTitle:'Bioconnect / Actual gameplay',close:'Close ×',sceneAlt:'Promotional animation: two rabbits merge into a fox, which pauses in surprise.',description:'Merge, grow, and discover a curious little food chain. Play Bioconnect, a free browser merge puzzle.',shotAlt:['Actual gameplay: a five-step chain introduces a buffalo','Actual gameplay: a six-step chain introduces a wolf','Actual gameplay: a seven-step chain introduces a bear']
  }
};
const config = window.BIOCONNECT_LP_CONFIG;
const scene = document.getElementById('scene');
const motion = document.getElementById('motion');
const dialog = document.getElementById('media-dialog');
const mediaContent = document.getElementById('dialog-content');
let language = 'ja';
let lastTrigger = null;
function safeUrl(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : null; } catch { return null; }
}
function renderPlatforms() {
  const list = document.getElementById('platforms');
  list.replaceChildren();
  const ready = config.platforms.filter(platform => safeUrl(platform.url));
  // Channels without a URL are left out; with none, the whole section and its nav link stay hidden.
  document.getElementById('connect').hidden = !ready.length;
  document.querySelector('nav a[href="#connect"]').hidden = !ready.length;
  for (const platform of ready) {
    const url = safeUrl(platform.url);
    const row = document.createElement(url ? 'a' : 'div');
    row.className = 'platform';
    if (url) { row.href=url; row.target='_blank'; row.rel='noopener noreferrer'; row.setAttribute('aria-label', `${platform.name} — ${platform[language]}`); }
    const mark = document.createElement('span'); mark.className='platform-mark'; mark.setAttribute('aria-hidden','true');
    const icon = document.createElement('img'); icon.src=platform.icon; icon.alt=''; icon.width=25; icon.height=25; mark.append(icon);
    const text = document.createElement('div');text.className='platform-text';
    const title = document.createElement('h3');title.textContent=platform.name;
    const detail = document.createElement('p');detail.textContent=platform[language];text.append(title,detail);
    const status = document.createElement('span');status.className=url?'platform-arrow':'platform-status';status.textContent=url?'↗':translations[language].comingSoon;
    row.append(mark,text,status);list.append(row);
  }
}
const multiline = new Set(['heroTitle','heroBody','storyTitle','storyIntro','momentsTitle','momentsIntro','connectTitle','connectBody']);
function setLanguage(next) {
  language=next==='en'?'en':'ja';
  document.documentElement.lang=language;document.body.classList.toggle('en',language==='en');
  document.querySelectorAll('[data-i18n]').forEach(element=>{
    const key=element.dataset.i18n;const value=translations[language][key];if(typeof value!=='string')return;
    if(multiline.has(key)){
      const lines=value.split('\n');element.replaceChildren();
      lines.forEach((line,index)=>{if(index)element.append(document.createElement('br'));if(element.matches('h1,h2')&&index===lines.length-1){const emphasis=document.createElement('em');emphasis.textContent=line;element.append(emphasis);}else element.append(document.createTextNode(line));});
    }else element.textContent=value;
  });
  document.querySelectorAll('[data-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===language)));
  scene.setAttribute('aria-label',translations[language].sceneAlt);
  document.querySelector('meta[name="description"]').content=translations[language].description;
  document.querySelectorAll('.screenshot').forEach((button,index)=>{button.setAttribute('aria-label',language==='en'?`Enlarge gameplay screenshot ${index+1}`:`プレイ画面${index+1}を拡大`);button.querySelector('img').alt=translations[language].shotAlt[index];});
  document.querySelector('nav').setAttribute('aria-label',language==='en'?'Main navigation':'メインナビゲーション');
  document.querySelector('.animal-parade').setAttribute('aria-label',language==='en'?'Animals you can discover':'成長して出会う動物たち');
  motion.textContent=translations[language][scene.classList.contains('paused')?'resume':'pause'];
  renderPlatforms();try{localStorage.setItem('bioconnect-lp-language',language);}catch{}
}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.lang)));
document.querySelectorAll('.play-link').forEach(link=>{const url=safeUrl(config.gameUrl);if(url)link.href=url;});
motion.addEventListener('click',()=>{const paused=scene.classList.toggle('paused');motion.setAttribute('aria-pressed',String(paused));motion.textContent=translations[language][paused?'resume':'pause'];});
function showMedia(element, trigger){lastTrigger=trigger;mediaContent.replaceChildren(element);dialog.showModal();}
document.querySelectorAll('.screenshot').forEach(button=>button.addEventListener('click',()=>{const img=document.createElement('img');img.src=button.dataset.image;img.alt=button.querySelector('img').alt;showMedia(img,button);}));
document.getElementById('watch').addEventListener('click',event=>{const video=document.createElement('video');video.src='assets/bioconnect-applause.mp4';video.controls=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label',language==='en'?'Actual gameplay video':'実際のプレイ映像');showMedia(video,event.currentTarget);video.play().catch(()=>{});});
document.getElementById('close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{const video=mediaContent.querySelector('video');if(video)video.pause();mediaContent.replaceChildren();if(lastTrigger)lastTrigger.focus();});
let initialLanguage = navigator.language.toLowerCase().startsWith('ja')?'ja':'en';
try{const stored=localStorage.getItem('bioconnect-lp-language');if(stored==='ja'||stored==='en')initialLanguage=stored;}catch{}
setLanguage(initialLanguage);
