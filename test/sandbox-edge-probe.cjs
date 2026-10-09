// Rejection-only probes of the designated TEST Edge deployment. No login/payment.
const assert = require('node:assert/strict');
const p = require('../supabase/sandbox/project.json');
assert.equal(p.projectRef, 'jcbohkzjmgbpsaqkrirg');
assert.equal(p.url, 'https://jcbohkzjmgbpsaqkrirg.supabase.co');
(async () => {
  const endpoint = p.url + '/functions/v1/';
  async function probe(name, method, origin, expected, token) {
    const headers = { apikey: p.publishableKey, 'Content-Type': 'application/json' };
    if (origin) headers.Origin = origin;
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = await fetch(endpoint + name, { method, headers,
      ...(method === 'POST' ? { body: '{}' } : {}) });
    const body = await r.text();
    assert.equal(r.status, expected, `${name} ${method}: ${body}`);
    console.log(`${name} ${method} ${expected}: ${body}`);
    return r;
  }
  const preflight = await probe('checkout', 'OPTIONS', 'http://127.0.0.1:8779', 200);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:8779');
  await probe('checkout', 'POST', 'https://untrusted.example', 403);
  await probe('checkout', 'GET', 'http://127.0.0.1:8779', 405);
  await probe('checkout', 'POST', 'http://127.0.0.1:8779', 401);
  await probe('checkout', 'POST', 'http://127.0.0.1:8779', 401, 'invalid-test-jwt');
  await probe('stripe-webhook', 'GET', null, 405);
  await probe('stripe-webhook', 'POST', null, 400);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
