/* TEST SIMULATION ONLY: no Google login, email delivery, real ads or Stripe calls. */
(() => {
  if (!['127.0.0.1','localhost','[::1]'].includes(location.hostname)) return;
  const ids = { a:'00000000-0000-4000-8000-000000000001', b:'00000000-0000-4000-8000-000000000002' };
  let session = JSON.parse(sessionStorage.getItem('bioconnect:test-session') || 'null');
  const listeners = [];
  const request = async (route, body) => {
    const response = await fetch('/__test/' + route, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const value = await response.json(); if (!response.ok) throw Error(value.error || 'Test service unavailable'); return value;
  };
  const change = next => { session=next; sessionStorage.setItem('bioconnect:test-session',JSON.stringify(next)); listeners.forEach(fn=>fn(next)); };
  window.__BIOCONNECT_TEST_ADAPTER__ = {
    rpc: (name,args,owner) => request('rpc',{name,args,owner}),
    checkout: (args,owner) => request('checkout',{...args,owner}),
    getSession: async () => session,
    onAuth: fn => listeners.push(fn),
    signIn: async () => change({ user:{id:ids.a,email:'a@example.test'} }),
    sendCode: async () => {},
    verifyCode: async (email,token) => { if (token !== '123456') throw Error('Invalid local test code'); change({user:{id:email.startsWith('b')?ids.b:ids.a,email}}); },
    signOut: async () => change(null)
  };
  document.addEventListener('DOMContentLoaded', () => {
    const banner=document.createElement('div'); banner.id='localTestBanner';
    banner.style.cssText='position:relative;z-index:1100;pointer-events:none;background:#4a235a;color:white;padding:6px;text-align:center;font:12px sans-serif';
    banner.textContent='LOCAL SIMULATION · Fake login / email code 123456 / fake payment / fake ads';
    document.body.prepend(banner);
  });
})();
