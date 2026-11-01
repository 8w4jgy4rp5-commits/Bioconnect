# 性格のキメ顔 — ChatGPTへの依頼文

焦り顔（../panic-faces/）と同じやり方で、**絵を編集して顔だけ**変える。
しぐさの一番いいところで、この顔に切り替える（ゲーム盤面と動物ページの両方）。
表情はコードで描き足さない（2026-10-17 に却下済み）。

## やり方（1匹ずつ）

1. ChatGPT で新しいチャットを開く。
2. このフォルダの `<動物>-source.png` を添付する。
3. 下の「共通の依頼文」を貼り、最後の1行を、その動物の1行に差し替える。
4. 返ってきた画像を、このフォルダに `<動物>-pose-src.png` という名前で保存する
   （例: `buffalo-pose-src.png`）。
5. Claude に「キメ顔の絵を置いた」と伝える。大きさ・位置合わせ・切り替えは Claude がやる。

体や輪郭がずれて返ってきたら、もう一度生成し直してもらうのが早い。

## 共通の依頼文

```
Edit this image. Change ONLY the face. Everything else must stay exactly
where it is: same pose, same body, same legs, same outline, same colours,
same canvas size, transparent background.

Keep the exact same art style: same line thickness and line colour, same
flat colours and soft shading. Side profile facing right. No text, no
background, no frame, no shadow, no added objects. Output a PNG with alpha
at the same size as the input.

<動物ごとの1行をここに>
```

## 動物ごとの1行

| 動物 | 添付する絵 | 最後に足す1行 |
|---|---|---|
| バッファロー | buffalo-source.png | `New expression: "Am I cute or what?" — admiring itself in a mirror. Eyes half-closed and coy with the long lashes fluttering, one eye in a playful wink, a small pleased pursed-lip smile (lipstick kept), cheeks blushing a little more. Keep the horns, the make-up and the pink cheek exactly as they are.` |
| シマウマ | zebra-source.png | `New expression: a confident fashion-model "camera's on me" look. Eyes half-closed and smouldering, one eyebrow slightly raised, a small knowing smirk. Keep every stripe, the mane and the yellow scarf exactly as they are.` |
| オオカミ | wolf-source.png | `New expression: a brave, defiant growl at a much bigger animal. Brows pulled down and eyes narrowed, staring straight ahead, the muzzle wrinkled, lips pulled back to show the teeth and fangs in a snarl, mouth only slightly open. Fierce but still cute and cartoonish, not scary. Keep the ears, the grey coat and the cream chest exactly as they are.` |

オオカミは顔だけでなく体・尻尾も少し描き直して返ってきた（下半身の重なり 0.96）。同じ枠に合わせて `img/wolf-growl.png` にし、顔の重ね塗りではなく絵ごと切り替えている。
