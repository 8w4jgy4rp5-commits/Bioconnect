import { Stripe, catalog, payments, admin } from '../_shared/payment.ts';
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
  // Live credentials may be staged before launch. Frontend switches are not an API gate.
  // Leave webhook confirmation running so already-paid purchases can still be fulfilled.
  if (Deno.env.get('PAYMENTS_LIVE') === 'true' && Deno.env.get('CHECKOUT_ENABLED') !== 'true')
    return reply({ error: 'Purchases are not enabled yet.' }, 503);
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
    const managed = Deno.env.get('MANAGED_PAYMENTS') === 'true';
    // Do not fall back to direct payments when the live Managed configuration is missing.
    if (Deno.env.get('PAYMENTS_LIVE') === 'true' && !managed)
      throw new Error('Managed Payments not configured');
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    let priceId = '';
    if (managed) {
      priceId = Deno.env.get('STRIPE_PRICE_' + sku.toUpperCase()) || '';
      if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw new Error('Product price not configured');
      const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
      const configuredProduct = price.product;
      if (!price.active || price.type !== 'one_time' || price.recurring ||
        price.currency !== 'usd' || price.unit_amount !== product.amount ||
        price.tax_behavior !== 'exclusive' || price.livemode !== (Deno.env.get('PAYMENTS_LIVE') === 'true') ||
        typeof configuredProduct === 'string' || configuredProduct.deleted ||
        !configuredProduct.active || !configuredProduct.tax_code)
        throw new Error('Product price configuration mismatch');
      lineItems = [{ quantity: 1, price: priceId }];
    } else {
      lineItems = [{ quantity: 1, price_data: { currency: 'usd', unit_amount: product.amount,
        product_data: { name: product.label } } }];
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', currency: 'usd',
      // Managed Payments rejects custom_text; the store's review step shows the refund terms either way.
      ...(managed ? { managed_payments: { enabled: true } } : { payment_method_types: ['card'],
        custom_text: { submit: { message: 'Purchases are non-refundable, except where required by applicable law.' } } }),
      client_reference_id: user.id,
      metadata: { order_id: order.id, owner_id: user.id, sku,
        ...(managed ? { payment_mode: 'managed', price_id: priceId } : {}) },
      line_items: lineItems,
      success_url: site + '?payment=returned', cancel_url: site + '?payment=cancelled',
    }, { idempotencyKey: 'bioconnect-order-' + order.id });
    return reply({ url: session.url, order_id: order.id });
  } catch (err) {
    // A failed earlier attempt with different settings (e.g. before a redeploy) poisons this order's
    // idempotency key. No session was made for it, so let the store start a fresh order.
    if (err instanceof Stripe.errors.StripeIdempotencyError)
      return reply({ error: 'Order expired. Start a new purchase.', code: 'order_expired' }, 409);
    console.error('Checkout error', err instanceof Error ? err.message : 'unknown');
    return reply({ error: 'Checkout unavailable. No product has been granted.' }, 503);
  }
});
