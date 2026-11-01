# 撮影用の盤面仕込み（dev/）

TikTok / Shorts の撮影専用。**公開サイトには入りません**：本番の `index.html` にはこのフォルダを読むタグがなく、
`npm run stage` で起動したローカルサーバーだけが `dev/stage-core.js` と `dev/stage.js` を差し込みます。
公開URLに `?stage=` を付けても何も起きません。itch 用ビルド（tools/build-itch.cjs）にも入りません。

## 使い方

```
npm run stage
```
ブラウザで `http://127.0.0.1:8778/?stage=fail-01` を開いて PLAY。

| キー | 動き |
|---|---|
| R | 仕込んだ盤面からやり直す |
| T | 世界の時計を1回だけ進める（食事・飢え・石） |
| H | 左上の STAGE 表示を出す／隠す（3秒で自動で消えます） |

撮影中のプレイは、ベストスコア・実績・試合記録・訪問数に記録されません。紫の「LOCAL SIMULATION」帯も隠れます。

## プリセットの書き方（dev/stages/名前.json）

```json
{
  "name": "fail-01",
  "board": [
    ".       sprout  grass   rabbit  fox",
    "rabbit  stone   bones   .       deer",
    "rabbit  fox~    .       scrub   zebra",
    ".       zebra   .       grass   buffalo",
    "tiger!  lion*   bear    grass   wolf"
  ],
  "hand": ["sprout", "fox", "grass"],
  "then": ["rabbit", "sprout", "grass"],
  "clockAfterMoves": 2,
  "firstTickMs": 900,
  "fatalSound": "dev/sfx/fatal.mp3"
}
```

- `board`：5行×5マスを、見た目どおりに書く。`.` は空きマス。名前は sprout grass rabbit fox deer zebra buffalo wolf bear lion tiger elephant / stone bones scrub
  - `lion*` … **大事な動物**。これが食べられた瞬間に `fatalSound` が鳴る
  - `tiger!` … **腹ぺこ**。時計が動いた最初の1回で食事をする
  - `fox~` … 手札から置いた扱い（野生）。動物は書かなければ「育てた」扱い。腹ぺこの動物は野生のほうを先に食べるので、守りのおとりに使える
  - elephant は 2×2 なので左上のマスに書く
- `hand`：手札3枚（左から順に置かれる）。`then`：その後に来る札の順番。尽きたら普段どおりランダム
- `clockAfterMoves`：何手置いたら時計を動かすか。`0` なら最初から普通に動く。書かなければずっと止まったまま（T で1回ずつ進める）
- `firstTickMs`：時計が動き出してから最初の1回までのミリ秒（ふだんは2.2秒）。「食べられる」瞬間の間合いを決める
- `board` の代わりに `"pieces": [{ "animal": "tiger", "row": 5, "col": 1, "hungry": true }]` のように1つずつ書いてもよい（行・列は上・左から1〜5）
- URL に JSON を直接書くこともできる：`?stage={"board":[...],"hand":[...]}`（URLエンコードして）

## 盤面の確認（ブラウザなし）

```
npm run check:stages          全部
node dev/check-stages.cjs fail-01
```
本物のルールで `script`（失敗の手順）と `rescue`（正しい手順）を試し、1手目の連鎖数・食べられたものを表示します。
1手目が5連鎖未満、または失敗の手順で大事な動物が食べられないと ✗ になります。

```
fail-01 — 20/25 squares filled (80%)
 script:
  place sprout at r1c1: 8-chain (sprout > grass > rabbit > fox > deer > zebra > buffalo > wolf > bear)
  place fox at r3c3: 1-chain (fox > deer)
  tick: tiger ate lion (PRECIOUS!)
 rescue:
  ...
  place fox at r4c1: 0-chain
  tick: tiger ate fox
```

## fail-01 の撮り方

1. 上の段の左はし（r1c1）に芽を置く → 8連鎖
2. 手札のキツネを、トラの上（r4c1・守りのマス）ではなく、まん中の段のキツネの右（r3c3）に置く → 小さく合体
3. 約0.9秒後、腹ぺこのトラがライオンを食べる → 声

## 声（dev/sfx/）

`fatalSound` に書いたファイルが鳴ります（mp3 / wav）。ファイルがなければ鳴らないだけで、ゲームは止まりません。
`make-fatal-voice.py` は、ミツバチ動画で使った Kokoro（PC内の無料音声AI）で男性の「Nooo!」候補を作るスクリプトです
（Visual C++ ランタイムがPCに無いため、venv の Scripts にある DLL を onnxruntime/capi にコピーして動かした）。読み上げ声は「きれいすぎる」と却下。いまの声は make-fatal-growl.py で一から合成したゴロゴロ声（fatal-g1〜g4、約20回/秒の震え＋くり返し）、fail-01 は g1。
