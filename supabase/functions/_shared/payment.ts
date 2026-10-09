import Stripe from 'npm:stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
export { Stripe, createClient };
export const catalog: Record<string, { amount: number; label: string }> = {
  crystals5: { amount: 100, label: '5 Crystals' },
  crystals11: { amount: 200, label: '11 Crystals' },
  crystals30: { amount: 500, label: '30 Crystals' },
  crystals65: { amount: 1000, label: '65 Crystals' },
  no_ads: { amount: 300, label: 'Bioconnect: No Ads + Daily Revival' },
};
export function payments() {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const live = Deno.env.get('PAYMENTS_LIVE') === 'true';
  if (!key.startsWith(live ? 'sk_live_' : 'sk_test_')) throw new Error('Payments not configured');
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}
export function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });
}
