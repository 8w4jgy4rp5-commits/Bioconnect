import { Stripe, catalog, payments, admin } from '../_shared/payment.ts';
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('POST required', { status: 405 });
  let event: Stripe.Event;
  let stripe: Stripe;
  try {
    stripe = payments();
    event = await stripe.webhooks.constructEventAsync(await req.text(),
      req.headers.get('stripe-signature') || '', Deno.env.get('STRIPE_WEBHOOK_SECRET') || '',
      undefined, Stripe.createSubtleCryptoProvider());
  } catch { return new Response('Invalid signature or configuration', { status: 400 }); }
  if (event.livemode !== (Deno.env.get('PAYMENTS_LIVE') === 'true'))
    return new Response('Wrong payment environment', { status: 400 });
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    try {
      // Re-read from Stripe; never trust the notice body. Partial refunds change nothing.
      let paymentIntent: string;
      if (event.type === 'charge.refunded') {
        const charge = await stripe.charges.retrieve((event.data.object as Stripe.Charge).id);
        if (!charge.refunded) return new Response('Partial refund; no change', { status: 200 });
        paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id || '';
      } else {
        const dispute = await stripe.disputes.retrieve((event.data.object as Stripe.Dispute).id);
        paymentIntent = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id || '';
      }
      if (!paymentIntent) return new Response('Not a Bioconnect payment', { status: 200 });
      const session = (await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 })).data[0];
      const m = session?.metadata;
      if (!session || !m || !m.order_id || !Object.hasOwn(catalog, m.sku))
        return new Response('Not a Bioconnect payment', { status: 200 });
      if (m.owner_id !== session.client_reference_id || session.livemode !== event.livemode)
        return new Response('Payment mismatch', { status: 400 });
      const { error } = await admin().rpc('bioconnect_reverse', { p_order: m.order_id, p_owner: m.owner_id,
        p_session: session.id, p_event: event.id, p_reason: event.type === 'charge.refunded' ? 'refund' : 'dispute' });
      if (error) throw error;
      return new Response('Reversed', { status: 200 });
    } catch { return new Response('Reversal failed; retry webhook', { status: 500 }); }
  }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type))
    return new Response('Ignored', { status: 200 });
  try {
    const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
    if (session.payment_status !== 'paid') return new Response('Not paid; no grant', { status: 200 });
    const m = session.metadata;
    if (session.mode !== 'payment' || session.status !== 'complete' || !m || !Object.hasOwn(catalog, m.sku) ||
      m.owner_id !== session.client_reference_id || session.currency !== 'usd' ||
      session.livemode !== event.livemode)
      return new Response('Payment mismatch', { status: 400 });
    const amount = catalog[m.sku].amount;
    // Inspect the retrieved session, not the redirect or current launch switch.
    // Older direct-payment sessions remain fulfillable after switching modes.
    if (session.managed_payments?.enabled === true) {
      // Managed Payments adds tax on top of the price: check price + tax, grant by price.
      const tax = session.total_details?.amount_tax;
      if (m.payment_mode !== 'managed' || !/^price_[A-Za-z0-9]+$/.test(m.price_id || '') ||
        session.amount_subtotal !== amount || typeof tax !== 'number' || !Number.isSafeInteger(tax) || tax < 0 ||
        session.total_details?.amount_discount !== 0 || session.total_details?.amount_shipping !== 0 ||
        !Number.isSafeInteger(session.amount_total) || session.amount_total !== amount + tax)
        return new Response('Payment mismatch', { status: 400 });
      const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
      const item = items.data[0];
      if (items.has_more || items.data.length !== 1 || !item || item.quantity !== 1 ||
        item.currency !== 'usd' || item.amount_subtotal !== amount || item.amount_discount !== 0 ||
        item.amount_tax !== tax || item.amount_total !== session.amount_total ||
        item.price?.id !== m.price_id || item.price.currency !== 'usd' ||
        item.price.unit_amount !== amount || item.price.type !== 'one_time' ||
        item.price.recurring || item.price.tax_behavior !== 'exclusive' ||
        item.price.livemode !== event.livemode)
        return new Response('Payment mismatch', { status: 400 });
    } else if (m.payment_mode === 'managed' || session.amount_total !== amount) {
      return new Response('Payment mismatch', { status: 400 });
    }
    const { error } = await admin().rpc('bioconnect_fulfill', { p_order: m.order_id,
      p_owner: m.owner_id, p_session: session.id, p_event: event.id, p_sku: m.sku,
      p_amount: amount, p_currency: session.currency });
    if (error) throw error;
    return new Response('Confirmed', { status: 200 });
  } catch { return new Response('Confirmation failed; retry webhook', { status: 500 }); }
});
