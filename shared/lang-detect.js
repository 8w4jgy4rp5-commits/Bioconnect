/* =====================================================================
   CobbleWorks — 初回訪問時の言語自動判定
   ---------------------------------------------------------------------
   ブラウザは「この人が読める言語」を navigator.languages で教えてくれる。
   初めて来た人にはそれを使って母国語で表示する。
   一度でも自分で言語を選んだ人の設定は絶対に上書きしない。
   他のスクリプトより先に走る必要があるので <head> の先頭に置くこと。
   ===================================================================== */
(function () {
  var KEY = 'cobbleworks:lang:v1'; // script.js / auth.js / 各ミニアプリと共通のキー
  var SUPPORTED = ['en', 'ja', 'es', 'zh', 'hi'];

  try {
    // すでに選択済みなら何もしない（ユーザーの選択が最優先）
    if (localStorage.getItem(KEY)) return;

    var list = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      // 'es-MX' や 'zh-TW' のような形で来るので、前half（言語コード）だけ見る
      var code = String(list[i]).toLowerCase().split('-')[0];
      if (SUPPORTED.indexOf(code) !== -1) {
        localStorage.setItem(KEY, code);
        return;
      }
    }
    // 対応言語がひとつも無ければ何も保存しない（既定の英語のまま）
  } catch (e) {
    // プライベートモード等で localStorage が使えないときは黙って諦める
  }
})();
