import { catalog, payments, admin } from '../_shared/payment.ts';
// No client-supplied amount, customer, owner, redirect, or secret is accepted.
Deno.serve(async req => {
  const site = Deno.env.get('BIOCONNECT_SITE_URL') || '';
  const origin = (() => { try { return new URL(site).origin; } catch { return ''; } })();
  const cors = { 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value),
    { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (!origin || req.headers.get('origin') !== origin) return reply({ error: 'Origin denied' }, 403);
  if (req.method === 'OPTIONS') return new Response('', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  const db = admin();
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const { data: { user }, error: authError } = await db.auth.getUser(jwt);
  if (authError || !user) return reply({ error: 'Sign in required' }, 401);
  try {
    const { sku, request_id } = await req.json();
    if (!Object.hasOwn(catalog, sku) || typeof request_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request_id))
      return reply({ error: 'Invalid product or request' }, 400);
    const { data: order, error } = await db.rpc('bioconnect_order',
      { p_owner: user.id, p_request: request_id, p_sku: sku });
    if (error) return reply({ error: error.message }, 409);
    if (order.paid) return reply({ error: 'Already confirmed. Refresh your balance.' }, 409);
    // A single durable order maps to a single Stripe idempotency key.
    // Refuse old unknown requests rather than recreating after Stripe's 24h cache expiry.
    if (Date.now() - Date.parse(order.created_at) > 23 * 3600000)
      return reply({ error: 'Order expired. Start a new purchase.', code: 'order_expired' }, 409);
    const product = catalog[sku];
    const stripe = payments();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', payment_method_types: ['card'],
      client_reference_id: user.id,
      metadata: { order_id: order.id, owner_id: user.id, sku },
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: product.amount,
        product_data: { name: product.label } } }],
      success_url: site + '?payment=returned', cancel_url: site + '?payment=cancelled',
    }, { idempotencyKey: 'bioconnect-order-' + order.id });
    return reply({ url: session.url, order_id: order.id });
  } catch (err) {
    console.error('Checkout error', err instanceof Error ? err.message : 'unknown');
    return reply({ error: 'Checkout unavailable. No product has been granted.' }, 503);
  }
});
