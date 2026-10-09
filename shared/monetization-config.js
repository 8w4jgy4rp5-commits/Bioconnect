// Public switches only. Do not put Stripe keys or Supabase service_role keys here.
window.BioMonetizationConfig = Object.freeze({
  storeEnabled: false, // shows the store and revive buttons on the live site; localhost always shows them
  paymentsEnabled: false,
  adsEnabled: false,
  adClient: '', // assigned ca-pub ID AFTER H5 Games Ads approval
  adTestMode: true
});
