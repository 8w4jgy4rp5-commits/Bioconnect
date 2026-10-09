// Dashboard deployment artifact: combine the reviewed shared source and handler.
// No business logic, credentials or environment settings are changed here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const shared = fs.readFileSync(path.join(root, 'supabase/functions/_shared/payment.ts'), 'utf8');
const destination = path.join(root, 'output/edge-deploy');
fs.mkdirSync(destination, { recursive: true });
for (const name of ['checkout', 'stripe-webhook']) {
  const original = fs.readFileSync(path.join(root, 'supabase/functions', name, 'index.ts'), 'utf8');
  const importLine = /^import \{[^\r\n]+\} from '\.\.\/_shared\/payment\.ts';\r?\n/;
  if (!importLine.test(original)) throw Error(`Unexpected handler import: ${name}`);
  const bundle = shared + '\n' + original.replace(importLine, '');
  fs.writeFileSync(path.join(destination, name + '.ts'), bundle);
  console.log(`${name}: ${crypto.createHash('sha256').update(bundle).digest('hex')}`);
}
