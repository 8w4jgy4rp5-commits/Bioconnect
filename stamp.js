// Stamps each local stylesheet and script in index.html with a short
// hash of its contents (pop.css?v=1a2b3c4d), so a phone or the in-app
// browser of X fetches the new file the moment it changes instead of
// reusing a cached copy for up to ten minutes.
//
//   node stamp.js          rewrite index.html with fresh stamps
//   node stamp.js --check  exit 1 if any stamp is out of date
//
// rules.test.js runs the check, so a forgotten stamp fails the tests.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAGE = path.join(__dirname, 'index.html');
const ASSET = /((?:href|src)=")((?!https?:|data:|\/\/)[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]*)?(")/g;

function stamped(html) {
  return html.replace(ASSET, (_, open, file, close) => {
    const body = fs.readFileSync(path.join(__dirname, file));
    const v = crypto.createHash('sha1').update(body).digest('hex').slice(0, 8);
    return open + file + '?v=' + v + close;
  });
}

function stale() {
  const html = fs.readFileSync(PAGE, 'utf8');
  return html !== stamped(html);
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    if (stale()) { console.error('index.html stamps are out of date: run `node stamp.js`'); process.exit(1); }
    console.log('stamps are current');
  } else {
    fs.writeFileSync(PAGE, stamped(fs.readFileSync(PAGE, 'utf8')));
    console.log('index.html stamped');
  }
}

module.exports = { stale };
