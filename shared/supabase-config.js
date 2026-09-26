// Supabase接続設定
// ここに置いてよいのは anon / publishable key だけ。
// service_role key は絶対にここへ書かない（データ保護はSupabase側のRLSで行う）。

const SUPABASE_URL = "https://xyumhzecqhpzzzzylbwn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zWAIlNtVc1h8KZL5ExhrFg_86AN1IN4";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 疎通確認用（コンソールで見えるログ。Phase 1以降で削除予定）
supabaseClient.auth.getSession().then(({ error }) => {
  if (error) {
    console.error("Supabase接続エラー:", error.message);
  } else {
    console.log("Supabase接続OK");
  }
});
