# 動物・画面素材の案内

移行時点で存在した画像は、Gitに未登録・除外されているものも含めて保存。
ゲームで使用中の画像は script.js の SPRITE_FILES と RIG が正本。
実コードではウサギ・キツネ・オオカミ・クマ・バッファロー・シカ・ゾウの画像を使用。クマは親子の絵。その他の候補は採用・組込みを個別に確認する。
シカは `concepts/imported-from-chatgpt/animal-illustrations/deer-timid-20260923.png`（おびえた描き直し）が採用版。
`concepts/animal-art-v1/deer.png` は穏やかな初版で不採用。元画像には目に見えない薄い画素（alpha 1〜7）が散っており、
`make-game-asset.py` はそれを避けて切り抜くようになった。詳しくは concepts/animal-art-v1/README.md。
バッファローは平塗りの `buffalo-makeup-v1.png` が採用版。ファイル名に game とある `buffalo-game-transparent-v4.png` は毛並み版で、輪郭線が無く44pxでつぶれるため不採用。
`buffalo.png` は脚が欠けており使えない。`buffalo-long-lashes-v3.png` は背景が黒のまま透過されていない。
オオカミは全身1枚。空腹顔がないため無理にパーツ分割しない。
ゾウは満腹（ニヤリ顔）と空腹（湯気の怒り顔）の2枚で、一枚絵で初めて顔が切り替わる。共通の枠で切り抜いてあるので差し替えても体がずれない。
手描きのトラ案は以前に却下・削除済みで、残っている生成画像の候補とは別。
imported-from-chatgpt のシマウマは元ファイル名に selected とあるが、ゲームへの組込みは別途確認が必要。
img/ref が移行元に存在すればコピー済み。元に存在しない原画はこの移行では復元できない。
詳しい画風・書き出し方法は concepts/animal-art-v1/README.md を読む。

## 画像一覧（最終照合時点）

- `concepts/animal-art-v1/all-8-at-44px.png`
- `concepts/animal-art-v1/all-8-review.png`
- `concepts/animal-art-v1/bear-brave-parent-cub-v2.png`
- `concepts/animal-art-v1/bear-crop-check.png`
- `concepts/animal-art-v1/bear-rig-preview.png`
- `concepts/animal-art-v1/bear-size-check.png`
- `concepts/animal-art-v1/bear.png`
- `concepts/animal-art-v1/buffalo-game-transparent-v4.png`
- `concepts/animal-art-v1/buffalo-long-lashes-v3.png`
- `concepts/animal-art-v1/buffalo-makeup-fur-v2.png`
- `concepts/animal-art-v1/buffalo-makeup-v1.png`
- `concepts/animal-art-v1/buffalo.png`
- `concepts/animal-art-v1/deer-size-check.png`
- `concepts/animal-art-v1/deer.png`
- `concepts/animal-art-v1/elephant-latest.png`
- `concepts/animal-art-v1/elephant-muscle.png`
- `concepts/animal-art-v1/elephant-ultra-muscle.png`
- `concepts/animal-art-v1/elephant.png`
- `concepts/animal-art-v1/lion-crown-yawn-gemini-v1.jpg`
- `concepts/animal-art-v1/lion.png`
- `concepts/animal-art-v1/tiger-bold-face-v1.png`
- `concepts/animal-art-v1/tiger-face-aura-v4.png`
- `concepts/animal-art-v1/tiger-gekiga-face-v2.png`
- `concepts/animal-art-v1/tiger-shakiin-aura-v3.png`
- `concepts/animal-art-v1/tiger.png`
- `concepts/animal-art-v1/wolf.png`
- `concepts/animal-art-v1/zebra.png`
- `concepts/imported-from-chatgpt/animal-illustrations/deer-timid-20260923.png`
- `concepts/imported-from-chatgpt/bear-concepts-v1/01-guardian.png`
- `concepts/imported-from-chatgpt/bear-concepts-v1/02-brave-leader-v2-shy-cub.png`
- `concepts/imported-from-chatgpt/bear-concepts-v1/02-brave-leader.png`
- `concepts/imported-from-chatgpt/bear-concepts-v1/03-warm-parent.png`
- `concepts/imported-from-chatgpt/zebra-yellow-scarf-selected.png`
- `img/bear-whole.png`
- `img/buffalo-whole.png`
- `img/deer-whole.png`
- `img/elephant-calm.png`
- `img/elephant-hungry.png`
- `img/fox-body.png`
- `img/fox-head-calm.png`
- `img/fox-head-hunt.png`
- `img/fox-head-sulk.png`
- `img/fox-leg-front.png`
- `img/fox-leg-hind.png`
- `img/fox-tail.png`
- `img/rabbit-body.png`
- `img/rabbit-ear.png`
- `img/rabbit-head-calm.png`
- `img/rabbit-head-eat.png`
- `img/rabbit-head-happy.png`
- `img/rabbit-head-panic.png`
- `img/rabbit-leg-front.png`
- `img/rabbit-leg-hind.png`
- `img/rabbit-tail.png`
- `img/ref/fox-ear-unused.png`
- `img/ref/fox-reference.jpg`
- `img/ref/parts-sheet.jpg`
- `img/ref/rabbit-reference.jpg`
- `img/wolf-whole.png`
