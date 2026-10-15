# Bioconnect opening screen concepts v2（2026-10-13）

標準の Cozy Eldritch 見た目のまま、構図だけを変えたオープニング10案。
`index.html` を開くと10案をスマホ枠で並べて見られる。各ファイルは単独でも開ける。
ゲーム本体（index.html / eldritch.css / pop.css）には未反映。ボタンは動かない見本。

残したもの: 苔色と月の配色、IM Fell の古書体ロゴと芽、ゲームの動物画（夜向けに彩度を落とす）、
苔色の PLAY、?・Ledger・Best・ショップ入口、タグライン、「草原に見られている」ちょっと間の抜けた一言。

| | 案 | ひとこと |
|---|---|---|
| A | Frontispiece | 古い博物誌の扉絵。アーチ窓の中に草原。今に一番近い |
| B | The Eye Opens | 丘が巨大な目。まばたき・きょろきょろ |
| C | Specimen Cabinet | ショップの標本箱を拡大。芽→ゾウ12区画、ゾウは影 |
| D | Chain Around the Moon | 食物連鎖が月の周りを一周し、だんだん大きく |
| E | Board of Eyes | 傾けた本物の盤面。空きマスで目がまばたき |
| F | Tentacle Curtain | 紫の触手がカーテンを開ける夜の劇場 |
| G | Field Journal | 博物学者のノート。唯一の明るい紙の案 |
| H | Moon Silhouette | 大きな月に動物の黒い影。ポスター向き |
| I | Underground | 地上の群れと、地中に眠る何か。ロゴは土に彫る |
| J | Tarot Card | XII（12種）「THE MEADOW」のカード |

共通部品は `common.css`（色・文字・ボタン）と `common.js`（上段・ロゴ・下段の挿入、固定文字列のみ）。
画像は `../../img/` を参照（コピーしていない）。動きは `prefers-reduced-motion` で止まる。
