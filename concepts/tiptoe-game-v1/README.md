# Tiptoe Hollow — Meadow Band

2026-10-12。動画ブランチ origin/claude/festive-brahmagupta-r7zj7r の concepts/promo-video-v1/promo-audio.js にある、このプロジェクトのオリジナル曲をゲーム向けに編曲。

120 BPM・D minor・16小節32秒。最初の8小節は動画のモチーフ、後半は応答。口笛・チューバ風低音・チェンバロ・控えめなテルミン。動物ごとに増える10パートは維持。タイトルは84 BPMのオルゴール。効果音は変更なし。

index.html は新旧BGM・動画の原曲・段階別合奏を同じ音量条件で試聴。previous-audio-synth.js は変更直前の保存、reference-promo-audio.js は参考ブランチから保存。ゲームが読み込むのはルートの audio-synth.js だけ。

render.cjs でChromeのOfflineAudioContextを使い音源と測定値を output/playwright/tiptoe-music/ に生成する。
