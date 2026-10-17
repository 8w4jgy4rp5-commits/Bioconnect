# 焦り顔（ぷよぷよの「あっ、やられる」）— ChatGPTへの依頼文

ウサギの `img/rabbit-head-panic.png` と同じ考え方で、**絵を編集して顔だけ**焦らせる。
2026-10-17、コードで目を描き足す案は「どう見ても不自然」で却下（PROGRESS参照）。

## やり方（1匹ずつ）

1. ChatGPT で新しいチャットを開く。
2. このフォルダの `<動物>-source.png` を添付する。
3. 下の「共通の依頼文」を貼り、最後の1行を、その動物の「動物ごとの1行」に差し替える。
4. 返ってきた画像を保存して、このフォルダに `<動物>-panic-src.png` という名前で置く
   （例: `fox-panic-src.png`）。
5. Claude に「焦り顔の絵を置いた」と伝える。ゲーム用の大きさ・位置合わせは Claude がやる。

体や輪郭がずれて返ってきたら、もう一度生成し直してもらうのが早い。

## 共通の依頼文

```
Edit this image. Change ONLY the face. Everything else must stay exactly
where it is: same pose, same body, same legs, same outline, same colours,
same canvas size, transparent background.

New expression: sudden panic, like a Puyo Puyo blob the instant before it
gets merged — "oh no, here it comes!". Funny and cute, not scary.
- Eyes: wide open, round, lots of white, small pupils (shocked).
- Eyebrows: raised and worried (inner ends pushed up).
- Mouth: open in a small "ah!" gasp. No teeth, no anger.
- Optionally one small sweat drop on the side of the head.

Keep the exact same art style: same line thickness and line colour, same
flat colours and soft shading. Side profile facing right. No text, no
background, no frame, no shadow. Output a PNG with alpha at the same size
as the input.

<動物ごとの1行をここに>
```

## 動物ごとの1行

| 動物 | 添付する絵 | 最後に足す1行 |
|---|---|---|
| キツネ | fox-source.png | `This is only the fox's head; keep the ears and the cheek fur exactly as they are.` |
| シカ | deer-source.png | `Keep the antlers, the ears and the little shake lines exactly as they are.` |
| シマウマ | zebra-source.png | `Keep every stripe, the mane and the yellow scarf exactly as they are.` |
| バッファロー | buffalo-source.png | `Keep the horns and the pink cheek exactly as they are.` |
| オオカミ | wolf-source.png | `Keep the ears up and the mouth closed except for the small gasp.` |
| クマ | bear-source.png | `Both the mother bear and the cub panic: change both faces, keep both bodies.` |
| ライオン | lion-source.png | `The mouth is already wide open: keep the open mouth and the crown, but open the closed eye wide in shock and remove the tear.` |
| トラ | tiger-source.png | `Keep the gold spiky aura around the head exactly as it is.` |
| ゾウ | elephant-source.png | `Keep the tusks, the trunk and the muscles exactly as they are.` |

おすすめの順番: 盤面でよく見る順に キツネ → シカ → シマウマ → バッファロー → オオカミ → 残り。
まず1匹（キツネ）で出来を見てから、残りを進めるのが安全。
