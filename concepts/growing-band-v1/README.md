# Growing meadow band — 2026-10-04

ユーザー選択「動物の種類が増えるたびに、音の種類も増える。トランペットからピアノまで」を実装。
ゲームは芽/草の木琴風旋律と小さなリズムで始まり、その試合の初登場1種類につき楽器が1つ加わる。

| 動物 | 追加する楽器 | 役割 |
|---|---|---|
| Rabbit | Piano | 拍の裏で和音 |
| Fox | Pizzicato strings | 弦のつま弾き |
| Deer | Flute | 高音の返事 |
| Zebra | Clarinet | 中音の短いフレーズ |
| Buffalo | Double bass | 根音と5度の低音 |
| Wolf | Trumpet | 明るい短い合いの手 |
| Bear | Cello | なだらかに伸びる低音 |
| Lion | French horn | 柔らかい金管の支え |
| Tiger | Glockenspiel | 高い金属音の彩り |
| Elephant | Timpani | 控えめで丸い打楽器 |

10音色はWeb Audioで合成した楽器風の音。録音サンプルや外部サービスは使わない。
鍵盤は打撃音と早く消える倍音、管/弦は異なる倍音配列・保持する包絡・フィルターで作る。
主旋律を10回重ねず、音域と入る拍を分けて合奏させる。音量は編成に合わせて調整。

## 発見と曲の継続

script.jsのplaceTileから配置した種類とgrowFromの全段をBioAudio.discoverに渡す。
連鎖の途中で消えた動物、手札から配置した動物、過去に別の試合で発見済みの動物もこの試合で数える。
同じ種類はSetで重複させない。盤面から消えても加入済みの楽器は残す。
新規ゲームのresetで0種類へ戻す。ゲーム保存・点数・手札の乱数には影響しない。
新加入は次の小節頭（最大約2.5秒）から0.55秒でフェードイン。曲の拍/旋律を頭へ戻さない。
タイトルのオルゴール、Ready/Go、終了のrest、非表示時の停止/復帰は維持する。
レイヤーの音声ノードもmusicグループとしてキャンセルされるので、停止時に楽器だけ鳴り残らない。

## 試聴

- index.html: Play music、Add an animal、0〜10種類の切替、各音色のSolo。
- growing-meadow.wav: 28秒。2.5秒ごとに1種類を追加する試聴用の短縮デモ。
- plants-only.wav / wolf-band.wav / elephant-band.wav: 0・6・10種類の14秒比較。
- WAVは同じ合成エンジンで書き出す確認用。ゲームはWAVを読み込まない。

## 確認

構文検査、ルール255件、キャッシュ識別子、git diff --check成功。
実ChromeのOfflineAudioContextで0〜10種類、10種類のソロ、4種類の試聴、ストレス音、停止を検査。
すべての追加段階で異なる音声信号（差分RMS最低0.0059）。10楽器BGMピーク0.3132、
連鎖/お祝いとのストレス混合0.3168（上限1）、NaN/音割れなし。musicキャンセル後の出力0。
生の音色ソロは0.015〜0.084 RMS。詳しい数値はrender-metrics.json。
実操作で試聴の1→10楽器、Trumpet Solo、375pxで横はみ出しなしを確認。
ゲームで草×2→ウサギ→ピアノの参加、3段連鎖→rabbit/fox/deer全種の登録、同種の再登場、
全動物が消えても維持、非表示で保持/復帰、メニューからNew gameでリセット、手札のFoxを確認。
ゲームJavaScriptの例外0件。検証スクリプトと画面はoutput/playwright/growing-band-v1/。
スマホ実機/Safariと本人の聴感は未確認。コミット・push・公開はしていない。
