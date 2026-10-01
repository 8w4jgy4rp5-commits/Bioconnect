# 動物・画面素材の案内

移行時点で存在した画像は、Gitに未登録・除外されているものも含めて保存。
ゲームで使用中の画像は script.js の SPRITE_FILES と RIG が正本。
実コードではラダー10種すべての画像を使用（ウサギ・キツネ・シカ・シマウマ・バッファロー・オオカミ・クマ・ライオン・トラ・ゾウ）。クマは親子の絵。残る候補は不採用の記録として保管する。
シカは満腹 `img/deer-calm.png` と空腹 `img/deer-hungry.png` の2枚組（2026-10-01）。元絵は
`concepts/imported-from-chatgpt/animal-illustrations/deer-timid-20260923.png`（おびえた描き直し）で、
空腹版はそれを生成AIに編集させた `hungry-faces/deer-try2-a.png`。首が落ちて頭が背中の線より下にくる、
角が前へ傾いて最高点から降りる、耳が伏せる、尻尾が垂れる——クマと同じ姿勢型。脚・ひづめ・腹・震え線は
動いていない（足元のずれ0.0px）。**盤面でいちばん大きいシルエット変化で、44pxで画素の51%が変わる。**
1回目の生成は画布が横長（1313x1198）で返り体ごと描き直されていたので不採用、記録は
`hungry-faces/deer-try1-a-redrawn.png` / `-b-redrawn.png`。指示文と測った数値は `hungry-faces/deer-prompt.txt`。
**リグは測り直した**（`w` 20 → 22.96、`oy` 0.58 → 0.62）。下がった角が鼻先より106px右へ出て共通枠が
719→825pxに広がったぶんを払い戻したもので、高さ88.2%・幅52.7%・足元95.7%は変更前と同じ値に戻してある。
`img/deer-whole.png` は差し替え前の1枚版で、コードは参照していない。
`concepts/animal-art-v1/deer.png` は穏やかな初版で不採用。元画像には目に見えない薄い画素（alpha 1〜7）が散っており、
`make-game-asset.py` はそれを避けて切り抜くようになった。詳しくは concepts/animal-art-v1/README.md。
バッファローは平塗りの `buffalo-makeup-v1.png` が採用版。ファイル名に game とある `buffalo-game-transparent-v4.png` は毛並み版で、輪郭線が無く44pxでつぶれるため不採用。
`buffalo.png` は脚が欠けており使えない。`buffalo-long-lashes-v3.png` は背景が黒のまま透過されていない。
バッファローも満腹 `img/buffalo-calm.png` と空腹 `img/buffalo-hungry.png` の2枚組になった（2026-10-01）。
空腹版は `buffalo-makeup-v1.png` を生成AIに編集させた `hungry-faces/buffalo-hungry-src.png`。頭が落ちて角が
背中の線より下がり、こぶが最高点になって背中がくぼむ、耳が垂れる、笑った口が平らな線になる——クマ・シカと同じ姿勢型。
脚・ひづめ・腹・尻尾は動いていない（足元のずれ0.0px、シルエットの77.8%が共通）。**リグは測り直した**
（`w` 50 → 46.95、`oy` 6.7 → 5.09、`ox` 2.5 → 1.88）。下がった角が鼻先より36px右へ出て共通枠が
1319→1355pxに広がったぶんの払い戻しで、高さ64.6%・足元95.7%・上端31.1%は変更前と同じ値に戻してある
（幅だけ119.6→120.7%。古い切り抜きとの差）。`img/buffalo-whole.png` は差し替え前の1枚版で、コードは参照していない。
オオカミは満腹 `img/wolf-calm.png` と空腹 `img/wolf-hungry.png` の2枚組（2026-09-30）。空腹版は
`concepts/animal-art-v1/wolf-starving.png`（原画 `wolf.png` を生成AIに編集させたもの。使った指示は
`wolf-starving-prompt.txt` に保存）。尻尾が垂れ、頭が肩より下がり、背中の毛が逆立ち、耳が後ろへ伏せる。
口は閉じたまま——牙を剥くと「飢え」ではなく「怒り」になる。脚・足先・腹は1画素も動いていない（シルエットの71%が共通）。
**頭のパーツ分割はしなかった。** 2枚とも全身1枚で足りる（ゾウ・シマウマと同じ）。
`img/wolf-whole.png` は差し替え前の1枚版で、古い緩い切り抜き。記録として残すがコードは参照していない。
**リグは測り直した**（`oy` 4.2 → 3.71）。古い切り抜きは220x184の中に余白があり、新方式の共通枠は220x162。
絵は同じなので高さ71.7%・足元95.6%・上端23.9%・空腹時98.5%は変更前と同じ値に戻してある。
クマは満腹 `img/bear-calm.png` と空腹 `img/bear-hungry.png` の2枚組（2026-10-01）。オオカミと同じ姿勢型で、
親の頭が肩より下がり、肩のこぶが最高点に入れ替わり、両耳が後ろへ伏せ、子グマは頭と首だけを親の前脚へ向けて
クリーム色の鼻づらを隠す。**この絵の強みは、頭を下げるとシルエットの最高点といちばん明るい点が同時に下がること。**
全身が一色の黒で抜ける色が無いので、44pxで読めるのはシルエットとクリーム色の3点だけ。牙は出さない。
指示文は `hungry-faces/bear-prompt.txt`、戻ってきた絵は `hungry-faces/bear-hungry-src.png`。
**戻ってきた絵は画布が違った**（1536x1024 対 元絵1490x1056）ので、脚だけを手がかりに倍率と位置を総当たりで探し
（0.985倍・下に28px、脚の一致率99.0%）、元の画布に貼り直してから共通枠で切った。脚・足先・腹の線は1画素も動いていない。
`img/bear-whole.png` は差し替え前の1枚版で、古い緩い切り抜き。記録として残すがコードは参照していない。
**リグは測り直した**（`w` 47 → 44.48、`ox` 5.2 → 4.79、`oy` 0.8 → -0.48）。古い切り抜きは220x153の中に205x141、
新方式の共通枠は220x149の中に217x149。絵は同じなので高さ79.3%・足元88.4%・上端9.1%・空腹時91.3%は変更前と同じ値に戻してある。
**足元88.4%は盤面で唯一95.7%でない値だが、これは意図されたものなのでそのまま戻した。**
ゾウは満腹（ニヤリ顔）と空腹（湯気の怒り顔）の2枚で、一枚絵で初めて顔が切り替わる。共通の枠で切り抜いてあるので差し替えても体がずれない。
シマウマは満腹 `img/zebra-calm.png` と空腹 `img/zebra-hungry.png` の2枚組（2026-09-30）。ゾウに次いで2種目の空腹差分で、
顔ではなく小物で空腹を伝える最初の例。空腹版はスカーフがほどけて膝まで垂れ、金がくすむ。
形は `hungry-faces/zebra-yellow-scarf-long-limp.png`（生成AIの編集）、色は `hungry-faces/fade-zebra-scarf.py` で計算。
2枚は `make-face-pair.py` が共通の枠で切るので入れ替えても体が動かない。
`img/zebra-whole.png` は差し替え前の1枚版で、`zebra-calm.png` とバイト単位で同一。記録として残す（コードは参照していない）。
元絵は `concepts/imported-from-chatgpt/zebra-yellow-scarf-selected.png` の左から3体目（黄色いスカーフ）が採用版。
4体が横に重なっていて空の列が1本もないため、矩形では切り出せない。連結したピクセルだけを塗りつぶしで拾って
`zebra-yellow-scarf-single.png` として保存し、そこから書き出した。`concepts/animal-art-v1/zebra.png`（平塗り・輪郭線あり）は不採用。
44pxでシカと見分けられるかが最大の懸念だったが、縞ではなく黄色いスカーフが識別点になって成立した。
ライオンは `concepts/animal-art-v1/lion-crown-yawn-gemini-v1.jpg`（王冠＋あくび）が採用版。
透過のないJPGだったので `cutout-bg.py` で背景を落としてから書き出した（`lion-crown-yawn-cutout.png` が中間ファイル）。
しっぽの輪の内側に取り残された紙の穴も同時に除去している。`lion.png`（横向きの立ち姿）は不採用。
満腹 `img/lion-calm.png` と空腹 `img/lion-hungry.png` の2枚組（2026-10-01）。**盤面で唯一、満腹版で口が開いている動物**なので、
空腹を**引き算**で伝えられる1種。あくびが閉じ、たてがみがしぼんで輪郭が内側へ寄り、王冠が前へずり落ちて最高点でなくなり、あくびの涙が消える。
王冠はシルエットの最高点だった（最上段7行は王冠の玉だけ）が、金は左右の端から361px/413px内側なので、下ろしても枠は横に広がらない。
指示文は `hungry-faces/lion-prompt.txt`、戻ってきた絵は `hungry-faces/lion-hungry-src.png`（画布が1490x1056で違ったので、
脚だけを手がかりに0.815倍で元の画布へ貼り直した。脚の一致率99.3%）。体・脚・尻尾・背中は1画素も動いていない。
**リグは1つも触っていない。** 4つの変更がどれも輪郭を内側へ動かすので共通枠が既存の切り抜きと一致し、
`img/lion-calm.png` は旧 `img/lion-whole.png` と**バイト単位で同一**。シマウマに次いで2例目。
`img/lion-whole.png` は差し替え前の1枚版で、記録として残すがコードは参照していない。
トラは `concepts/animal-art-v1/tiger-face-aura-v4.png` が採用版。広い soft glow は透過だったので切り抜きで消え、
44pxで残るのはスパイクだけ。v1〜v3 と `tiger.png` は不採用。
満腹 `img/tiger-calm.png` と空腹 `img/tiger-hungry.png` の2枚組（2026-10-01）。**画像生成AIを使っていない唯一の組**で、
`hungry-faces/flare-tiger-aura.py` が原画から金を色相で抜き、中身を塗りつぶし、1.50倍まで0.06刻みで重ねた層を
**体の下に**敷く。顔は1画素も変えていない（牙を剥かせると別人になる）。体は完全に同一で、増えたのはオーラだけ。
横には伸ばさない（タイル幅134.2%で既に両端が切れており、横に伸ばすと絵全体が縮む）。枠は縦に131画素だけ伸び、
`RIG.tiger.fit.oy` を 1.7 → -0.6 に測り直した。足元95.7%・幅134.2%は変更前と同じ。
伸ばす量は `hungry-faces/tiger-spread-choice.png` に44pxで4段階並べてある。
`img/tiger-whole.png` は差し替え前の1枚版で、記録として残すがコードは参照していない。
手描きのトラ案は以前に却下・削除済みで、残っている生成画像の候補とは別。
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
- `concepts/animal-art-v1/all-10-at-44px.png`
- `concepts/animal-art-v1/lion-crown-yawn-cutout.png`
- `concepts/animal-art-v1/lion-crown-yawn-gemini-v1.jpg`
- `concepts/animal-art-v1/lion-size-check.png`
- `concepts/animal-art-v1/lion.png`
- `concepts/animal-art-v1/tiger-bold-face-v1.png`
- `concepts/animal-art-v1/tiger-face-aura-v4.png`
- `concepts/animal-art-v1/tiger-gekiga-face-v2.png`
- `concepts/animal-art-v1/tiger-shakiin-aura-v3.png`
- `concepts/animal-art-v1/tiger.png`
- `concepts/animal-art-v1/wolf.png`
- `concepts/animal-art-v1/zebra-size-check.png`
- `concepts/animal-art-v1/zebra.png`
- `concepts/imported-from-chatgpt/animal-illustrations/deer-timid-20260923.png`
- `concepts/imported-from-chatgpt/bear-concepts-v1/01-guardian.png`
- `concepts/imported-from-chatgpt/bear-concepts-v1/02-brave-leader-v2-shy-cub.png`
- `concepts/imported-from-chatgpt/bear-concepts-v1/02-brave-leader.png`
- `concepts/imported-from-chatgpt/bear-concepts-v1/03-warm-parent.png`
- `concepts/imported-from-chatgpt/zebra-yellow-scarf-selected.png`
- `concepts/imported-from-chatgpt/zebra-yellow-scarf-single.png`
- `concepts/animal-art-v1/hungry-faces/zebra-yellow-scarf-undone-candidate.png`（1回目・ほどいただけ。短くて不採用）
- `concepts/animal-art-v1/hungry-faces/zebra-yellow-scarf-long-limp.png`（2回目・膝まで垂らした。採用版の形）
- `concepts/animal-art-v1/hungry-faces/zebra-hungry-final.png`（色をくすませた出荷版の元絵）
- `concepts/animal-art-v1/hungry-faces/zebra-scarf-mask.png`（色を変えた範囲の確認用）
- `img/zebra-calm.png`
- `img/zebra-hungry.png`
- `img/bear-calm.png`
- `img/bear-hungry.png`
- `concepts/animal-art-v1/hungry-faces/bear-prompt.txt`（通った指示の記録）
- `concepts/animal-art-v1/hungry-faces/bear-hungry-src.png`（戻ってきた絵を元の画布へ貼り直したもの）
- `concepts/animal-art-v1/hungry-faces/bear-overlay.png`（脚が動いていないことの確認図）
- `img/bear-whole.png`（差し替え前の1枚版・古い切り抜き）
- `img/buffalo-calm.png`
- `img/buffalo-hungry.png`
- `concepts/animal-art-v1/hungry-faces/buffalo-prompt.txt`（方針の差し替えと測った数値、通った指示）
- `concepts/animal-art-v1/hungry-faces/buffalo-attempts.txt`（生成側で回した3回の指示）
- `concepts/animal-art-v1/hungry-faces/buffalo-hungry-src.png`（採用。戻ってきた1枚）
- `concepts/animal-art-v1/hungry-faces/buffalo-window.png`（生成側に渡した切り出し）
- `concepts/animal-art-v1/hungry-faces/buffalo-overlay.png`（脚が動いていないことの確認図）
- `concepts/animal-art-v1/hungry-faces/buffalo-ox-check.png`（横位置AとCを44pxで並べた比較）
- `concepts/animal-art-v1/hungry-faces/buffalo-44px-choice.png`（満腹と空腹を実寸44pxと6倍で並べた確認図）
- `concepts/animal-art-v1/hungry-faces/buffalo-pair-sheet.png`（満腹と空腹をオオカミと並べた確認図）
- `img/buffalo-whole.png`（差し替え前の1枚版・古い切り抜き）
- `img/deer-calm.png`
- `img/deer-hungry.png`
- `concepts/animal-art-v1/hungry-faces/deer-prompt.txt`（1回目の失敗と2回目の通った指示、測った数値）
- `concepts/animal-art-v1/hungry-faces/deer-try2-a.png`（採用。2回目の戻り6枚のうち脚の一致率94.2%）
- `concepts/animal-art-v1/hungry-faces/deer-try2-b.png`（首は深いが角が縮んだ。不採用）
- `concepts/animal-art-v1/hungry-faces/deer-try2-c.png`（脚が動いた。不採用）
- `concepts/animal-art-v1/hungry-faces/deer-try1-a-redrawn.png`（1回目・横長で描き直された。不採用）
- `concepts/animal-art-v1/hungry-faces/deer-try1-b-redrawn.png`（同上）
- `concepts/animal-art-v1/hungry-faces/deer-overlay.png`（脚が動いていないことの確認図）
- `concepts/animal-art-v1/hungry-faces/deer-44px-choice.png`（A/Bを44pxと132pxで並べた比較）
- `concepts/animal-art-v1/hungry-faces/deer-pair-sheet.png`（満腹と空腹をタイル上に並べた確認図）
- `concepts/imported-from-chatgpt/animal-illustrations/deer-starving-generation-prompts.txt`（生成側で回した5回の指示）
- `concepts/imported-from-chatgpt/animal-illustrations/deer-starving-candidate.png`（生成側で選んだ1枚。`deer-try2-c.png` とバイト単位で同一）
- `img/deer-whole.png`（差し替え前の1枚版）
- `img/elephant-calm.png`
- `img/elephant-hungry.png`
- `img/fox-body.png`
- `img/fox-head-calm.png`
- `img/fox-head-hunt.png`
- `img/fox-head-sulk.png`
- `img/fox-leg-front.png`
- `img/fox-leg-hind.png`
- `img/fox-tail.png`
- `img/lion-calm.png`
- `img/lion-hungry.png`
- `concepts/animal-art-v1/hungry-faces/lion-prompt.txt`（通った指示の記録）
- `concepts/animal-art-v1/hungry-faces/lion-hungry-src.png`（戻ってきた絵を元の画布へ貼り直したもの）
- `concepts/animal-art-v1/hungry-faces/lion-overlay.png`（体が動いていないことの確認図）
- `img/lion-whole.png`（差し替え前の1枚版・新方式の切り抜きと同一）
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
- `img/tiger-calm.png`
- `img/tiger-hungry.png`
- `concepts/animal-art-v1/hungry-faces/flare-tiger-aura.py`（オーラを伸ばす計算。再実行で同じ絵）
- `concepts/animal-art-v1/hungry-faces/tiger-spread-choice.png`（44pxで4段階を並べた選定表）
- `concepts/animal-art-v1/hungry-faces/tiger-aura-mask.png`（金として拾った範囲の確認用）
- `concepts/animal-art-v1/hungry-faces/tiger-overlay.png`（体が動いていないことの確認図）
- `concepts/animal-art-v1/hungry-faces/tiger-calm-padded.png` / `tiger-hungry-flare.png`
  （切り抜き前の1536px中間ファイル。`flare-tiger-aura.py` を実行すれば同じものが出るので、
  容量が気になれば消してよい）
- `img/tiger-whole.png`（差し替え前の1枚版）
- `img/wolf-whole.png`（差し替え前の1枚版・古い切り抜き）
- `img/wolf-calm.png`
- `img/wolf-hungry.png`
- `concepts/animal-art-v1/wolf-starving.png`（空腹版の原画）
- `concepts/animal-art-v1/wolf-starving-prompt.txt`（通った指示の記録）
- `concepts/animal-art-v1/hungry-faces/wolf-overlay.png`（脚が動いていないことの確認図）
- `img/zebra-whole.png`
