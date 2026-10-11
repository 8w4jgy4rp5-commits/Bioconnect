# 本番で売り始めるまでの手順（2026-10-11）

TEST（bioconnect-sandbox ＋ Stripeサンドボックス）では、Managed Payments での購入と全額返金の取り消しまで確認済み。
本番は同じものを「本番のSupabase」と「本番のStripe」にもう一度作る。上から順に行う。

秘密の値（`sk_live_...`、`whsec_...`、service_role）は、チャット・リポジトリ・フロントに貼らない。Supabase の Secrets 画面にだけ入れる。

## A. Stripe（本番。画面上部に「サンドボックス」と出ていないこと）

1. Managed Payments が本番アカウントで使えるか確認する。使えるかどうかは、Stripe が事業の種類と国を見て判断する（審査がある）。手数料は通常の手数料に加えて 1件あたり 3.5%。
2. 商品カタログで、サンドボックスと同じ商品を5つ作る。すべて「一回限り」「USD」「外税」「商品税コード：ダウンロード可能なソフトウェア: 個人用（txcd_10202000）」。

   | 商品名 | 価格 | Secret 名 |
   |---|---|---|
   | Bioconnect — 5 Crystals | 1.00 | `STRIPE_PRICE_CRYSTALS5` |
   | Bioconnect — 11 Crystals | 2.00 | `STRIPE_PRICE_CRYSTALS11` |
   | Bioconnect — 30 Crystals | 5.00 | `STRIPE_PRICE_CRYSTALS30` |
   | Bioconnect — 65 Crystals | 10.00 | `STRIPE_PRICE_CRYSTALS65` |
   | Bioconnect — No Ads | 3.00 | `STRIPE_PRICE_NO_ADS` |

   各価格の `price_...` ID を控える（秘密ではない）。
3. 開発者 → API キーで、本番のシークレットキー（`sk_live_...`）を確認する。
4. Webhooks に送信先を追加する。URL は `https://xyumhzecqhpzzzzylbwn.supabase.co/functions/v1/stripe-webhook`。イベントは4つ：
   `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`charge.refunded`、`charge.dispute.created`。
   作成後に表示される署名シークレット（`whsec_...`）を控える。

## B. 本番の Supabase（URL が `xyumhzecqhpzzzzylbwn` のプロジェクト）

1. SQL Editor で、次の2つを **この順番で** 1つずつ実行する。
   - `supabase/migrations/202610050001_monetization.sql`
   - `supabase/migrations/202610110001_reversals.sql`
2. Edge Functions に `checkout` と `stripe-webhook` を作る。中身は `node supabase/sandbox/bundle-functions.cjs` で作られる
   `output/edge-deploy/checkout.ts` と `output/edge-deploy/stripe-webhook.ts`。どちらも **Verify JWT はオフ**。
3. Edge Functions → Secrets に次を入れる。

   | 名前 | 値 |
   |---|---|
   | `STRIPE_SECRET_KEY` | 本番の `sk_live_...` |
   | `STRIPE_WEBHOOK_SECRET` | A-4 の `whsec_...` |
   | `BIOCONNECT_SITE_URL` | `https://8w4jgy4rp5-commits.github.io/Bioconnect/`（最後の `/` まで） |
   | `PAYMENTS_LIVE` | `true` |
   | `MANAGED_PAYMENTS` | `true` |
   | `STRIPE_PRICE_...` の5つ | A-2 の `price_...` |
   | `CHECKOUT_ENABLED` | 売り始める瞬間まで **入れない**（入れなければ購入は受け付けない） |

4. Authentication → メール送信を独自の SMTP にする。標準のメール送信は1時間に数通しか送れず、一般公開には足りない。SMTP サービスは本人が選ぶ（無料枠のあるサービスが多いが、費用は要確認）。

## C. 売り始める日

1. `CHECKOUT_ENABLED` = `true` を Secrets に追加する。
2. AI に「本番で購入を有効にして」と依頼する。AI が `shared/monetization-config.js` の `storeEnabled` と `paymentsEnabled` を true にして公開する。
3. スマホで実際に 5 Crystals（US$1）を自分で買い、付与を確認したら、Stripe で全額返金して取り消しも確認する。

## 止めたいとき

Secrets から `CHECKOUT_ENABLED` を消すと、新しい購入はすぐ止まる。支払い済みの付与（webhook）は動き続ける。

## 注意

- Managed Payments では、購入者には「Sold through Link」と表示され、領収書・返金・支払いの問い合わせは Link（Stripe）が受け持つ。
- 日本国内の購入者の消費税は Managed Payments の対象外。最初は米国向けだが、日本の人が買うこともあり得るので、税の扱いは必要に応じて専門家に確認する。
