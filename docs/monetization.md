# 収益化の設計・接続手順（2026-10-05）

## WebKit互換検証（2026-10-08）

`node node_modules/playwright/cli.js install webkit` で固定済みPlaywright版に対応する検証ブラウザーを追加し、`npm run test:webkit` で収益化35＋Auth23＋広告adapter12のfixtures70項目を実行する。`npm run test:webkit:ads:official` は実Google TEST SDKの完了・途中終了・next3ケース（375×812 mobile emulation、guest、実広告はCSP拒否）。Windows WebKit26.5で両コマンド成功、Chrome35項目も再確認。

[Playwright公式のWebKit説明](https://playwright.dev/docs/browsers#webkit)に従い、Safari実機と区別する。iPhoneのOS、実Google/OTPログイン、実Stripe Checkout、バックグラウンド復帰・通信・メディア再生は実機で別途確認する。WebKit証跡はoutput/playwright/{monetization,sandbox}/webkitへ保存（Git非保存）。模擬previewの本番analytics scriptを除去し、CORS pageerrorと実計測への送信を止めた。本番HTML・認証設定・本人資産は維持。


## Google公式TEST広告入口（2026-10-08）

`npm run sandbox:ads` でPCの http://127.0.0.1:8780/ を起動。通常8779とは別origin。ログインせず、下部の Official TEST ad controls → Stage an ended game を押す（準備成功後にパネルは自動で閉じる）。その後 Watch ad to revive／New Game を選ぶ。Googleの公式模擬広告だけを使用する。sample clientは事業者の割当IDではなく、実広告設定の有効性を確認するものではない。

公式SDK実確認: 報酬完了で復活・Resume待ち、途中終了確認のCLOSEで無報酬、New Game広告終了後の新run／countdown後の再開、時計停止／ミュートと終了後の解除。買い切り抑止・権利取得不能・no-fill／SDK失敗はローカルfixtures12チェック。CSPでSDKスクリプト以外の外部広告通信を拒否。`test:sandbox:ads:official` は新規guest Chromeのみ、既存アカウントの資産に触れない。通常入口・本番の広告／購入はOFFを維持。


## 状態と採用案

正本は `C:\Users\tians\Bioconnect`。通常プレイは未ログイン／オフラインのまま動く。
実広告・実課金・公開は無効。`shared/monetization-config.js` の2スイッチはfalse。
初回実装時は外部DBへの適用・Edge配備を行わなかった。その後、ユーザー指定のbioconnect-sandboxだけにDBを適用済み。本人メールOTP・初回3個、TEST EdgeとStripe公式Sandboxの5個／買い切り購入・署名通知・再送・拒否／キャンセルを実接続で確認済み。2026-10-07には実TESTの日次無料復活・別runのCrystal消費・記録GET／再読込・実RPC成功後の応答喪失からの同ID復旧も確認（盤面／通信faultのみ人工準備）。その時点では6個／owned／daily used。2026-10-08に元OTP ownerへのGoogle手動連携・実Google再ログインと、実Stripe Sandboxの30個／US$5の3DS失敗・成功を確認。成功付与6→36個、Refresh／reload後も36個／owned／Google連携／復活履歴3件／daily available。同日に同runの2タブCrystal復活を重なった実リクエストで確認し、36→35個の一度だけ消費。最終35個／owned／Google連携／履歴5件／daily available。遅れて取得した履歴の一覧更新も修正済み。今回のDashboard通知詳細は未確認。通常sandboxは購入・広告OFFへ戻した。同日にGoogle公式TEST SDKの完了・途中終了・New Gameもguest Chromeで確認。本人限定オンライン入口、広告事業者承認・実広告と本番設定は未完了。ドメイン作業は本人指示で保留。最新状態は [sandbox.md](sandbox.md)。実決済・実広告・本番公開・コミット／pushは行っていない。

採用実装はSupabase Auth（Google + メールコード）、Stripe Checkout、Google H5 Games Ads。
販売者の国・個人／法人は未回答のため、日本の販売者を仮定して比較した。これだけが追加の事業判断。
価格・無料配布・復活仕様は今回のユーザー指定を確定仕様とする。

| 決済候補 | 日本の標準料金／US$1の概算 | 少額・導入条件 | テスト／バックエンド |
|---|---|---|---|
| Stripe | カード3.6%。換算が必要なら+2%。US$1で約$0.036、換算時約$0.056相当 | 固定カード手数料なし。事業者本人確認・銀行口座・販売内容の審査。最低額は決済口座の通貨依存（USD $0.50、JPY ¥50）。USD売価を使用 | Sandbox／test keysとテストカード。Checkout作成と署名WebhookをEdge Functionsで処理 |
| PayPal | 国内商用3.6% + USD $0.30。US$1で約$0.336、国際／換算加算は別 | 固定額がUS$1商品に重い。Business登録。地域／カード決済種別で条件が違う | Sandbox。サーバーの注文・capture／Webhook確認が必要 |
| Paddle | 5% + $0.50。US$1で$0.55。$10未満は個別料金相談対象 | Merchant of Recordで税務等を担う。販売者／商品／ドメイン審査。ゲーム対応はあるが少額条件は要相談 | Sandbox。サーバーで署名通知と商品対応を管理 |

料金は登録国・契約条件・税・通貨換算で変わる。StripeはMerchant of Recordではないため、販売表示・返金・税務の運営設定は本人が確定する。

| 広告候補 | 既存のGitHub Pagesとの適合 | 導入／テスト条件 |
|---|---|---|
| Google H5 Games Ads（採用） | 静的HTMLにJSを組み込み、`next`と`reward`に対応。実広告供給とサイト承認は保証されない | AdSense／H5参加申請、サイト所有確認、publisher ID。Googleの `data-adbreak-test="on"` は公式模擬広告。2026-10-08に資料sample clientで公式TEST SDKの表示・完了・途中終了・New Gameを確認。承認・割当ID・実広告配信は未確認 |
| GameDistribution | SDKでrewarded／interstitial対応。配信基盤へのゲーム登録と公開承認が必要 | ゲームのアップロード、審査、収益分配契約。既存URLのみで独立運営する目的にはGoogle案が軽い。料金／分配は本人の契約で確認 |

Google SDKは必要時のみ読み込む。購入者またはログイン済みで権利確認できない人には広告を要求しない。
New Game広告のno-fill／SDK失敗は新規ゲームへ進む。報酬広告は`adViewed`と広告終了を確認して初めて復活する。
広告表示が始まる前にだけ待機タイムアウトで失敗へ戻せる。表示開始後は広告の終了通知までゲームを再開しない。
買い切りの広告抑止はサインインしてその権利を確認したアカウントに適用される。ログアウト後はゲスト。

## ファイルと安全性

- `monetization.js`: ログイン、店、残高再取得、復活操作、広告分岐。画面は英語。
- `shared/monetization-config.js`: 公開してよい有効化スイッチのみ。秘密情報なし。
- `supabase/migrations/202610050001_monetization.sql`: private schemaの残高・配布・権利・日次使用・復活領収・注文・通知履歴。
- `supabase/functions/checkout`: 検証したJWTの本人を注文所有者にする。価格はサーバー固定、カード単発Checkout、注文IDの冪等キー。
- `supabase/functions/stripe-webhook`: raw本文の署名、test/live、Stripe APIから取得した`payment_status=paid`、金額／通貨／所有者／商品を照合して付与。
- `test/`: 使い捨てDB、ローカル代替、実ブラウザ確認。実環境の権利を作るものではない。

privateテーブルへのブラウザのCRUDと、注文作成／付与RPCのブラウザ実行権限はない。
認証済みは自分のwallet、初回claim、revive、注文確認のみを呼べる。walletを既存`user_app_data`へ保存しない。
残高と日次使用はアカウント行のロックで直列化。初回配布は条件付きUPDATEで一度だけ。
`owner_id + run_id`の一意な復活領収により、同ゲームの同時操作／応答喪失リトライは消費一度。
買い切り商品は別端末からでも23時間以内の未払い注文を共用。
注文のpaidフラグとStripe sessionの一意制約により、違う通知IDを含む再送も付与一度。
支払戻り画面は商品を付与しない。再取得した残高だけを表示する。

消費前に盤面の復旧用スナップショットを端末へ保存する。保存できなければ消費しない。
通信結果が不明なら他手段とNew Gameを停止し、同じIDで再確認する。再読み込み後も元アカウントで復旧できる。
確定した残高不足／無料分使用済みエラーは消費せず、他の選択へ戻る。
アカウント切り替えは財布を即時破棄し、古い非同期応答を受け付けない。記録storeも破棄・再作成する。
未ログイン、SDK未読込、通信不通では通常プレイを止めず、支払・消費をローカルで代替付与しない。

復活はdeer以上（4マスelephant含む）を残し、そのclockを0（既存処理の満腹）にする。
その他は除去。score、ticks、stock、next、季節、発見／音楽編成を維持し、Resumeまでは進行停止。
全復活でスコア・ベスト・保存履歴（最大30件）に💎を付ける。保存データにrevivedを持たせ同期後も表示する。
通常のNew GameでゲームIDと復活状態を初期化。ルール版20とバランス定数は変更していない。

## 本人の外部設定手順（TESTの実施記録は非公開の private-notes/）

1. **販売者**: 登録国・個人／法人を決め、Stripeのテストアカウントを作る。販売内容（ゲーム内消耗品と広告非表示）、住所、連絡先、返金／利用規約・プライバシー表示と税の扱いを決める。本番登録や費用は今回有効化しない。
2. **Supabaseテストプロジェクト**: 本番と別のプロジェクトを用意する。既存`user_app_data`の定義・RLS・保存権限は既存プロジェクトのDashboardで確認する（リポジトリに元のmigrationなし）。今回のSQLをTESTのSQL EditorまたはCLI migrationで適用する。
3. **Auth**: 既存の公開Auth settingsを2026-10-05にGETで確認し、Google=true、email=true、signup有効、mailer_autoconfirm=false。秘密設定やSMTP実態は取得していない。TEST側で同じproviderを設定する。
4. **Google**: Google CloudでWeb OAuth clientを作り、callbackに `https://<TEST_PROJECT>.supabase.co/auth/v1/callback` を追加する。Client ID／secretはSupabase Google provider欄だけに保存。Supabase URL ConfigurationのSite URLとRedirect URLsへ実際のテストURL（`http://127.0.0.1:8779/`）と将来の本番URLを登録する。実際の本人のGoogleログインで往復確認する。
5. **メールコード**: SupabaseのMagic Link email templateをリンクではなく `{{ .Token }}` を含むコード本文にする。アプリはsignInWithOtp→verifyOtp(type=email)。本番一般利用者には独自SMTPを設定する。Supabase標準SMTPはチーム登録先だけ・現在2通/時・本番用途非推奨なので、それだけでは一般公開に足りない。SMTP送信ドメインと到達を本人のメールで確認する。
6. **Edge secrets**: `supabase/.env.example`を参考にTESTの`STRIPE_SECRET_KEY=sk_test_...`、`STRIPE_WEBHOOK_SECRET=whsec_...`、`BIOCONNECT_SITE_URL=<正しい末尾/付きURL>`、`PAYMENTS_LIVE=false`を登録する。SupabaseのURL／service_roleはEdge内のみ。フロントにはTESTのpublishable keyだけを入れる。
7. **Edge起動**: TESTへcheckoutとstripe-webhookを配備する。両方verify_jwt=falseだが、checkoutは`auth.getUser(jwt)`、WebhookはStripe署名を必須にしている。公開URLのOriginと一致するテストフロントを使う。CLI例: `supabase functions serve --env-file supabase/.env.test`、`supabase functions deploy checkout`、`supabase functions deploy stripe-webhook`（CLIは未実行、専用TESTへDashboard配備済み）。
8. **Stripe Sandbox**: webhook送信先をTESTの`/functions/v1/stripe-webhook`に登録し、checkout.session.completed／async_payment_succeededを受ける。テストカード4242 4242 4242 4242、拒否・3DS・通知再送・通信喪失で確認。CLIなら`stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook`から表示されるwhsecをTEST secretsへ。専用TESTへの実API／公式Sandbox接続は完了。5個と買い切りの成功、11個の拒否・キャンセル、通知再送を実確認。3DS／通信喪失E2Eは未実施。
9. **Google広告**: AdSense／H5 Games Ads参加申請、サイト審査、割当publisher ID、対象ドメインの確認をする。GitHub Pagesの `/Bioconnect/ads.txt` はホストの `/ads.txt` と別なので、必要ならユーザーサイトのルートリポジトリか独自ドメインで置く。独自ドメイン取得は費用があるため本人の判断。現URLの承認は未確認。承認後もまず`adTestMode=true`で公式模擬広告を検証する。
10. **広告同意**: 対象地域に応じたプライバシー表示とGoogle認証CMP／TCFの導入を行う。EEA／英国／スイス向けにはGoogle指定の認証CMPが必要。今回広告が無効なのでCMPも未接続。自動広告などゲーム外の広告を追加せず、購入者の全広告非表示を維持する。
11. **本番前**: TEST Auth実往復、別端末ログイン、公式Sandbox決済・再送、Google公式テスト、スマホ／Safari実機を確認する。返金・チャージバック時の権利取消と消費済みクリスタル対応は運営方針を決めて別途実装する（今回の付与・消費仕様にはない）。同意・販売表示も含めてレビュー後、本人の別依頼でのみlive鍵／スイッチ／公開を変更する。

## 再実行と検証の区別

正本で `npm ci`（検証用依存だけ）を実行する。ChromeかEdgeが必要。WindowsのPostgreSQLテストはASCIIパスから実行する。

```
node stamp.js
npm test
npm run test:postgres
npm run check:edge
npm run test:browser
node sim.js 30
```

`npm run test:server` → `http://127.0.0.1:8778/` は破棄されるTEST DBを使うローカル試遊。
紫の「LOCAL SIMULATION」表示、模擬Google、メールコード123456、模擬決済、模擬広告のみ。
これはGitHub Pagesの通常ページから起動しない。公開ホストではテストadapterを受け付けない。
ブラウザ確認の写真・result.jsonは `output/playwright/monetization/`。一時型検査は `output/edge-typecheck/`。
SQLのPGliteテストは直列実行。実PostgreSQLテストは独立したDB接続で競合を確認する。
Edge検証は実ハンドラーとStripe公式署名検証を使うが、StripeのAPI応答はローカルfixture。
このfixture検査だけでは外部アカウントの接続を証明しない。2026-10-06の実Stripe Sandbox接続検証はdocs/sandbox.mdの手動検査記録を参照。本番は未接続。

## 今回の検証・独立レビュー結果

- 既存ゲームルール257件成功。バランス定数・rules 20は維持し、複数速度のシミュレーション30試合ずつも完走。
- PGlite 20群と実PostgreSQLの独立接続20群成功。初回3個、残高不足、同ゲーム一度、別ゲーム同時消費、別所有者、paid確認、金額・通貨照合、全商品、通知重複、買い切り注文共有、日次枠競合、繰越なし、午前4時と夏時間境界を検証。
- 実Stripeライブラリの署名検証（改ざん拒否）、Edge型検査と実checkout／webhookハンドラー3群成功。このhandler検査のStripe API応答はfixture。2026-10-06に別途実Stripe Sandboxで購入・署名通知・再送を確認（sandbox.md）。
- 実Chrome 32項目成功。375×812／320×568、ゲーム終了、Crystal／reward／daily、2回目不可、New Game広告失敗、広告中の時計・音停止、ログイン／店、未払いと支払済みの模擬購入、応答喪失からの再読込復旧、所有者切替、Auth SDK不在／例外時の保存を確認。JavaScript例外0件。認証・決済・広告は模擬サービス。
- 実AppSyncの初回pull／refreshを使い、同じ所有者の高いbest・💎・両端末履歴を保存・書戻しし、他所有者を取り込まないことを検証。ブラウザの公開user_app_dataへの実書込は実施していない。
- ゲーム状態と課金安全性の2担当が独立レビュー。SDK不在時の保存、best退行、履歴の書戻し、広告読込中の権利切替、操作中の所有者切替を修正し、担当が再確認。初回同期の追加も再レビュー済み。未解決の重大な指摘なし。
- stamp --checkとgit diff --check成功。コミット／push・外部設定変更・公開なし。

## 公式資料（2026-10-05確認）

- [Stripe日本料金](https://stripe.com/jp/pricing)、[通貨・最低決済額](https://docs.stripe.com/currencies)、[Webhook](https://docs.stripe.com/webhooks)、[Fulfillment](https://docs.stripe.com/checkout/fulfillment)、[Sandbox](https://docs.stripe.com/testing)
- [PayPal日本料金](https://www.paypal.com/jp/business/paypal-business-fees)、[Paddle料金](https://www.paddle.com/pricing)
- [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google)、[メールOTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[SMTP制限](https://supabase.com/docs/guides/auth/auth-smtp)、[Edgeの認証](https://supabase.com/docs/guides/functions/auth)
- [Google H5参加条件](https://adsense.google.com/start/h5-games-ads/)、[APIとコールバック](https://developers.google.com/ad-placement/apis)、[公式テスト広告](https://developers.google.com/ad-placement/docs/test)、[サイト確認](https://support.google.com/adsense/answer/7584263)、[CMP要件](https://support.google.com/adsense/answer/13554020)
- [GameDistribution SDK](https://gamedistribution.com/developers/sdk/html5/)、[参加・審査](https://gamedistribution.com/developers/partnership/)
