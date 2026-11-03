// Builds the iPhone app's copy of the game into app/www/.
// The website (repo root) stays the source; this only copies and trims it so
// the app starts with no network: fonts are bundled, and the sign-in service
// (Supabase), page statistics (Cloudflare) and remote scripts are left out.
//
//   node app/build-app.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'www');
const FONTS = path.join(__dirname, 'node_modules', '@fontsource');

// What the app ships. Folders are copied whole, minus SKIP.
const FILES = [
  'index.html', 'favicon.ico', 'apple-touch-icon.png',
  'style.css', 'pop.css', 'dusk.css', 'eldritch.css', 'feedback.css', 'onboarding.css',
  'script.js', 'audio-synth.js', 'audio.js', 'monetization.js', 'watch.js', 'skin.js',
  'shared/lang-detect.js', 'shared/monetization-config.js', 'shared/app-footer.css',
  'animals/index.html', 'animals/animal-rig.js',
  'guide/index.html', 'guide/guide.css',
  'legal/privacy.html', 'legal/terms.html', 'legal/legal.css'
];
const DIRS = ['img', 'audio', 'watch'];
// The app's own privacy policy and terms (also on the website, for the App
// Store listing) stand in for the website's, which describe Stripe and ads.
const SWAP = { 'legal/privacy.html': 'legal/app-privacy.html', 'legal/terms.html': 'legal/app-terms.html' };
const SKIP = new Set(['img/ref']);   // reference art for drawing, not used by the game

// Scripts and tags the app must not load (they need the network or an account).
const DROP = [
  /<script[^>]*src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase[^"]*"[^>]*><\/script>\s*/g,
  /<script[^>]*src="shared\/supabase-config\.js[^"]*"[^>]*><\/script>\s*/g,
  /<script[^>]*src="shared\/app-sync\.js[^"]*"[^>]*><\/script>\s*/g,
  /<script[^>]*static\.cloudflareinsights\.com[^>]*><\/script>\s*/g,
  /<link[^>]*rel="preconnect"[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g,
  /<link[^>]*rel="manifest"[^>]*>\s*/g,
  /<meta name="google-adsense-account"[^>]*>\s*/g
];
const GOOGLE_FONTS = /<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2[^"]*"[^>]*>/g;

const FACES = [
  ['Fredoka', 'fredoka', '500', 'normal'], ['Fredoka', 'fredoka', '600', 'normal'], ['Fredoka', 'fredoka', '700', 'normal'],
  ['IM Fell English', 'im-fell-english', '400', 'normal'], ['IM Fell English', 'im-fell-english', '400', 'italic'],
  ['IM Fell English SC', 'im-fell-english-sc', '400', 'normal'],
  ['Special Elite', 'special-elite', '400', 'normal']
];

function copy(rel) {
  const from = path.join(ROOT, SWAP[rel.split(path.sep).join('/')] || rel), to = path.join(OUT, rel);
  if (SKIP.has(rel.replace(/\\/g, '/'))) return;
  if (fs.statSync(from).isDirectory()) {
    for (const name of fs.readdirSync(from)) copy(path.join(rel, name));
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function fonts() {
  const dir = path.join(OUT, 'fonts');
  fs.mkdirSync(dir, { recursive: true });
  const css = FACES.map(([family, pkg, weight, style]) => {
    const file = `${pkg}-latin-${weight}-${style}.woff2`;
    fs.copyFileSync(path.join(FONTS, pkg, 'files', file), path.join(dir, file));
    return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(${file}) format('woff2')}`;
  });
  fs.writeFileSync(path.join(dir, 'fonts.css'), css.join('\n') + '\n');
}

// Every page: local fonts in place of Google Fonts, no network-only tags,
// and window.BIO_APP so the game can tell it is running inside the app.
function page(rel) {
  const file = path.join(OUT, rel);
  const up = '../'.repeat(rel.split('/').length - 1);
  let html = fs.readFileSync(file, 'utf8');
  for (const re of DROP) html = html.replace(re, '');
  html = html.replace(GOOGLE_FONTS, `<link rel="stylesheet" href="${up}fonts/fonts.css" />`);
  // The night skin adds its fonts from a script; point that at the bundle too.
  html = html.replace(/'https:\/\/fonts\.googleapis\.com\/css2[^']*'/g, `'${up}fonts/fonts.css'`);
  html = html.replace(/<head>/, '<head>\n<script>window.BIO_APP = true;</script>');

  // Pages the app does not ship (the web landing page, the Stripe seller page):
  // drop their links, with the " · " that joined them to a neighbour.
  html = html.replace(/\s*·\s*<a href="(\.\.\/)?about\/">[^<]*<\/a>/g, '')
    .replace(/<a href="(\.\.\/)?about\/">[^<]*<\/a>\s*·\s*/g, '')
    .replace(/\s*·\s*<a href="(legal\/)?commerce\.html"[^>]*>[^<]*<\/a>/g, '')
    .replace(/<a href="(legal\/)?commerce\.html"[^>]*>[^<]*<\/a>\s*·\s*/g, '');
  // Inside the app, a path ending in "/" opens the game's front page, not the
  // folder's page, so every link names its index.html.
  html = html.replace(/href="((?:\.\.\/)*(?:[a-z-]+\/)*)(#[^"]*)?"/g, (m, dir, hash) =>
    dir === '' && hash ? m : `href="${dir}index.html${hash || ''}"`);
  // The app has no browser tabs: local pages open in place.
  html = html.replace(/(<a href="(?!https?:|mailto:)[^"]*")\s+target="_blank"\s+rel="noopener noreferrer"/g, '$1');
  // The swapped-in legal pages link to each other by their app names.
  html = html.replace(/href="app-(privacy|terms)\.html"/g, 'href="$1.html"')
    .replace(/\s*The website version has <a href="privacy\.html">its own privacy policy<\/a>\./, '');
  // Words written for a browser.
  html = html.replace(/saved in this browser \(and synced when you are logged in\)/g, 'saved on this device')
    .replace(/saved in this browser/g, 'saved on this device')
    .replace(/Play Bioconnect — free in your browser/g, 'Play Bioconnect');
  if (/https:\/\/(cdn\.jsdelivr|fonts\.googleapis|static\.cloudflareinsights)/.test(html)) {
    throw new Error(rel + ' still loads something from the network');
  }
  fs.writeFileSync(file, html);
}

// The app has no sign-in, store or ads yet: purchases arrive through Apple
// later. With the store off, the shop, wallet and revive buttons stay hidden.
const APP_CONFIG = `// App build (app/build-app.cjs): no sign-in, no Stripe, no ads.
window.BioMonetizationConfig = Object.freeze({
  storeEnabled: false,
  paymentsEnabled: false,
  adsEnabled: false,
  adClient: '',
  adTestMode: false
});
`;

// Every local link and file reference must land on a file that ships, and
// no link may end in "/" (see page()).
function checkLinks(htmlFiles) {
  const broken = [];
  for (const rel of htmlFiles) {
    const html = fs.readFileSync(path.join(OUT, rel), 'utf8');
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
      if (/^(https?:|mailto:|data:|#|\/\/)/.test(url) || url === '') continue;
      const clean = url.split('#')[0].split('?')[0];
      if (clean.endsWith('/') || !fs.existsSync(path.join(OUT, path.dirname(rel), clean))) broken.push(`${rel}: ${url}`);
    }
  }
  if (broken.length) throw new Error('broken links in the app build:\n  ' + broken.join('\n  '));
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const rel of [...FILES, ...DIRS]) copy(rel);
fonts();
fs.writeFileSync(path.join(OUT, 'shared', 'monetization-config.js'), APP_CONFIG);
const pages = FILES.filter(f => f.endsWith('.html'));
for (const rel of pages) page(rel);
checkLinks(pages);
console.log('app/www built');
