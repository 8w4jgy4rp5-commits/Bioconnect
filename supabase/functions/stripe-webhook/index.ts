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
      session.amount_total !== catalog[m.sku].amount || session.livemode !== event.livemode)
      return new Response('Payment mismatch', { status: 400 });
    const { error } = await admin().rpc('bioconnect_fulfill', { p_order: m.order_id,
      p_owner: m.owner_id, p_session: session.id, p_event: event.id, p_sku: m.sku,
      p_amount: session.amount_total, p_currency: session.currency });
    if (error) throw error;
    return new Response('Confirmed', { status: 200 });
  } catch { return new Response('Confirmation failed; retry webhook', { status: 500 }); }
});
