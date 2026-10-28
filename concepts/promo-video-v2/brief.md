# Bioconnect — Short-form video brief (2026-10-28)

## 0. Game information (filled in from the repo, since the template was left blank)

| Field | Value (source in repo) |
|---|---|
| Game name | Bioconnect |
| Description | A cozy-but-slightly-eldritch food-chain merge puzzle on a 5×5 moonlit meadow. Free, plays in the browser, no login. |
| Core gameplay | Tap a square to place the tile in your hand (hand of 3, refilled at once). Two matching tiles that touch merge into the next rung: sprout → grass → rabbit → fox → deer → zebra → buffalo → wolf → bear → lion → tiger → **elephant**. The new animal lands where it can merge again, so one tap can cascade. (`script.js` LADDER, MERGE_AT = 2) |
| Main objective | Raise the elephant (two tigers) and set a high score. Elephant = 2,000,000 raw-point bonus + full-screen celebration. |
| Player actions | Place a tile; arrange merges so they chain; put food next to hungry animals. Touch/hover a square to preview the merge path (arrows), which animals will be merged (they pull **panic faces**), and which blockers will crack and **CLEAR**. |
| Failure | Animals eat only when their bar is red and **starve into bones** if nothing edible is beside them. Plants wither to scrub, stones drop in on a timer that speeds up by stage. The world clock runs independently of your taps (2.2 s per tick). **The run ends when every square is filled.** |
| Satisfying | Chains. 3–4 = GREAT!, 5–6 = AMAZING!, 7+ = INCREDIBLE! with board-edge glow. A 5+ chain also blasts every blocker within 2 squares. |
| Different | Merge game where the merged things are a **food chain that gets hungry**: you are juggling growth (merge) and survival (feeding) on the same 25 squares. |
| Visual identity | Dark moonlit green, gold-framed board, hand-painted animals with calm/hungry/panic faces, old-book serif type, "Cozy Eldritch" touches (googly-eye stickers, purple tentacle at the board edge). |
| Assets | Real gameplay capture (any device; 540×960 Chromium was used before). `index.html?watch` = real board replay of a **bot** raising an elephant (×1/×2/×4). `index.html?celebrate` = elephant celebration preview. Panic-face art for 9 animals. Original BGM "Tiptoe Hollow" (120 BPM, D minor, whistle/tuba/harpsichord/theremin) + title music box + in-game SFX. App Store screenshots in `output/appstore-screenshots/` (**older build: still shows seasons, removed 2026-10-22 — don't reuse in video**). |
| URL | https://bioconnectpazzle.com/ |

---

## 1. Game hook analysis

- **Psychological hook — "I set it up, the meadow did the rest."** One tap producing a 7-step cascade is *authorship*, not luck: the landing rule is deterministic, so a better player really can plan it. That is the bridge from watching to "I could do that."
- **Visual hook — the merge preview.** Hovering/touching a square draws the chain path, the animals about to be eaten-by-merge pull panic faces, rocks crack with "CLEAR". The game literally shows the future for a moment. Rare in merge games and instantly readable.
- **Gameplay hook — the cascade itself** (rabbit → fox → deer … with GREAT → AMAZING → INCREDIBLE).
- **Replay hook — the elephant.** Suika's watermelon: you almost never reach it, so every run is another attempt.

Core fantasy: *planning a domino run inside a living ecosystem.*
Strongest two traits: **(1) the one-tap cascade** and **(2) the preview that lets you see it coming**.

**Single strongest opportunity:** make the viewer *choose the square* before the tap. Prediction turns the cascade from something you watch into something you got right or wrong — and getting it wrong is exactly the itch the game scratches.

---

## 2. Six creative concepts

### C1 — "Where would you tap?"
- **Mechanism:** Prediction (dominant) → Satisfaction payoff
- **Hook:** Frozen board, glowing hand tile, three empty squares labelled A / B / C. "1 TAP. ONE OF THESE STARTS A 7-CHAIN."
- **Concept:** Viewer picks; the finger tours A and C (short preview arrows), then B (long arrow path, five panic faces, rocks crack). Tap. Full cascade to INCREDIBLE!
- **Viewer reaction:** "B… no wait, C." → "Oh, it SHOWS you?" → "I'd have missed that."
- **Gameplay moment:** real 7-chain from real play
- **CTA:** FIND A LONGER ONE · PLAY FREE
- **Format:** 9:16 screen capture, ~16 s, text on top

### C2 — "They know."
- **Mechanism:** Humor
- **Hook:** Extreme close-up of a calm lion. Finger hovers next door — its face snaps to the panic face.
- **Concept:** Rapid hover on/off over several animals: calm → PANIC → calm → PANIC. Then commit; they merge into a tiger.
- **Viewer reaction:** "lmao the face"
- **Gameplay moment:** merge preview panic faces
- **CTA:** WANT TO TRY? · PLAY FREE
- **Format:** close-up crops, 8–10 s, comedic timing

### C3 — "One square did all of that"
- **Mechanism:** Reverse / Curiosity
- **Hook:** Open on the end state: INCREDIBLE! 7 CHAIN, board glowing, rocks blasted away. "ONE TAP DID THIS."
- **Concept:** Hard rewind (real footage reversed, labelled REWIND) to the board before; then play it forward at normal speed.
- **Viewer reaction:** "How?" → watches the mechanism
- **Gameplay moment:** same 7-chain
- **CTA:** CAN YOU FIND ONE? · PLAY FREE
- **Format:** 12–15 s

### C4 — "The 1-in-100 animal"
- **Mechanism:** Discovery / Rarity
- **Hook:** Black screen, a silhouette elephant icon from the ladder strip, "OUR BEST TEST BOT SAW THIS ~1 RUN IN 100."
- **Concept:** Two tigers side by side → elephant → full-screen celebration.
- **Viewer reaction:** "I want to see it myself."
- **Gameplay moment:** elephant celebration
- **CTA:** WILL YOU SEE IT? · PLAY FREE
- **Format:** 10 s. Number must be the measured bot figure (sim.js: careful bot ~1%, casual 0%), worded as a bot stat, not a player stat.

### C5 — "Feed it in time"
- **Mechanism:** Tension
- **Hook:** Lion with a red hunger bar, stone just dropped beside it, hand shows a deer.
- **Concept:** Clock keeps ticking (2.2 s). Only one free square touches the lion. Place the deer… lion eats. Or it doesn't, and becomes bones.
- **Viewer reaction:** "Go go go"
- **Gameplay moment:** feeding / starvation
- **CTA:** KEEP THEM ALIVE · PLAY FREE
- **Format:** 8–12 s, tight crop on 2–3 squares

### C6 — "Sprout to Elephant"
- **Mechanism:** Progression
- **Hook:** A single sprout. "THIS BECOMES AN ELEPHANT."
- **Concept:** Ladder strip at the bottom lights up icon by icon as each animal is first raised, cut at ×4 from a long run, ending on the celebration.
- **Viewer reaction:** "12 steps?! how long does that take"
- **Gameplay moment:** ladder progress + elephant
- **CTA:** HOW FAR CAN YOU GET? · PLAY FREE
- **Format:** 15–20 s montage with a progress bar. The only ready-made elephant footage is the `?watch` **bot** replay; it must be labelled as such or replaced with a human run.

---

## 3. Evaluation (1 = weak, 5 = strong)

| Question | C1 Predict | C2 Panic | C3 Reverse | C4 Rarity | C5 Tension | C6 Progress |
|---|---|---|---|---|---|---|
| 1. First second | 4 | 5 | 4 | 3 | 3 | 3 |
| 2. Readable fast | 3 | 5 | 3 | 4 | 3 | 4 |
| 3. Mental participation | 5 | 2 | 3 | 2 | 4 | 2 |
| 4. Payoff | 5 | 3 | 4 | 4 | 3 | 4 |
| 5. Real strengths | 5 | 4 | 5 | 4 | 4 | 4 |
| 6. Game itself interesting | 5 | 3 | 4 | 3 | 4 | 3 |
| 7. Reason to play | 5 | 2 | 4 | 3 | 3 | 3 |
| 8. Low-cost production | 4 | 5 | 4 | 4 | 3 | 3 |
| 9. Distinctive | 4 | 4 | 3 | 3 | 2 | 2 |
| 10. CTA natural | 5 | 2 | 4 | 4 | 3 | 4 |
| **Total** | **45** | **35** | **38** | **34** | **32** | **32** |

### Top 2

**C1 — "Where would you tap?" (test first)**
- Why it works: the viewer makes a decision, so the payoff is *their* win or loss. It shows both strengths (preview + cascade). The CTA ("find a longer one") is the same act the viewer just did in their head.
- Main weakness: a 5×5 board with 12 animal types is a lot to read in 1 s. Without dimming the rest of the board, viewers bounce.
- Must be right: (a) a genuine 5+ chain recorded from real play — they are rare (~1 scoring move in 200), so record long sessions or keep playing until one appears; (b) heavy dimming so only the hand tile, A/B/C and the chain cluster are bright; (c) the "7" in the hook must match the chain counter in the footage.
- Drives play because: guessing wrong makes you want to see the board yourself.

**C3 — "One square did all of that"**
- Why it works: consequence-first hook; same footage as C1, so it's a free A/B test.
- Main weakness: passive — viewers watch rather than choose. Reversed footage can feel like an editing trick.
- Must be right: the REWIND must be clearly labelled so nobody thinks the reverse is gameplay.
- Drives play because: "how did one tap do that?" → curiosity about the rule.

**Produce C1 first; cut C3 from the same capture as variant B.**

---

## 4. Final storyboard — C1 "Where would you tap?" (≈16 s, 9:16)

Footage: one real capture of a board one tap before a 7-chain, with the finger/cursor touching squares A and C (preview only — touching without releasing / hovering does **not** place), then B, then the tap. Below the chain is called "7"; replace with the real count.

| # | Time | Dur | Gameplay | Camera / framing | Movement | Editing | Text | Sound | Transition | Viewer psychology | Purpose |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.0–1.0 | 1.0 | Frozen board, hand tile (e.g. grass) glowing in "Place now" | Board fills frame, hand tile visible at bottom; everything except hand + A/B/C + cluster dimmed to 35% | None (hard still) | Freeze frame, A/B/C badges pop in one by one (0.1 s apart) | **1 TAP.** / **ONE OF THESE STARTS A 7-CHAIN.** | Single harpsichord pluck from game SFX on each badge; no music | Cut | "A puzzle — I can solve this." | Stop the scroll with a question |
| 2 | 1.0–3.0 | 2.0 | Still frozen | Same | Slow 3% push-in | Badges pulse once | **A, B or C?** (replaces line 2) | Room-tone silence, faint clock tick | Cut | Viewer commits to a guess | Mental participation |
| 3 | 3.0–3.8 | 0.8 | Finger touches A: 1 short preview arrow | Punch-in 115% on A | Snap | Real speed | **A** label brightens | Soft "tok" | Cut | "Only one merge." | Teach that the game previews |
| 4 | 3.8–4.6 | 0.8 | Finger touches C: short arrow | Punch-in on C | Snap | Real speed | **C** | Soft "tok" | Cut | "Also small." | Eliminate options, raise stakes |
| 5 | 4.6–6.0 | 1.4 | Finger touches B: long arrow path, 4–5 animals switch to **panic faces**, rocks show **CLEAR** cracks | Pull back to 100% to show whole path | Quick pull-out | Hold; 0.85× speed | **B** | Music stops entirely for 0.3 s, then a rising theremin note | Cut | "OH. Look at their faces." | The reveal of the plan; humour beat |
| 6 | 6.0–6.4 | 0.4 | Tap B | Punch-in 120% on B | Slight 2-frame shake on contact | Real speed | — | Game placement SFX, loud | Cut on action | Commitment | Release the tension |
| 7 | 6.4–11.0 | 4.6 | The cascade: each merge lands, counter 2…3 GREAT…5 AMAZING…7 | Camera follows each landing square at 110% | Smooth pan square to square, 0.15 s easing | Real speed for steps 1–3, 1.15× after so it accelerates; no cuts inside the chain | none (game's own counter does the talking) | Game merge pops ascending in pitch; Tiptoe Hollow BGM enters on step 3 | Continuous | "It keeps going…" | Satisfaction escalation |
| 8 | 11.0–12.5 | 1.5 | **INCREDIBLE! 7 CHAIN**, edge glow, nearby blockers blasted | Pull out to full board | Pull-out 0.3 s then hold | Hold; 0.2 s freeze on banner | — | Game's chain finale sound, music swells one bar | Cut | "That was B." | Payoff |
| 9 | 12.5–13.5 | 1.0 | Same frame | Full board | None | Overlay | **IT WAS B.** / **Did you get it?** | Music continues | Cut | Win/lose moment; comment bait | Self-check → desire to try |
| 10 | 13.5–16.0 | 2.5 | Title screen (moon silhouette) or the board with a fresh hand | Full frame | Slow 2% push-in | Clean | **FIND A LONGER ONE.** / **BIOCONNECT — free in your browser** / **bioconnectpazzle.com** | Title music-box motif | End | "It's real and I can play it now." | CTA |

---

## 5. Exact on-screen text

1. `1 TAP.` (0.0–3.0, top)
2. `ONE OF THESE STARTS A 7-CHAIN.` (0.0–1.0)
3. `A, B or C?` (1.0–3.0)
4. Badges on squares: `A` `B` `C` (0.0–6.0)
5. `IT WAS B.` (12.5–13.5)
6. `Did you get it?` (12.5–13.5)
7. `FIND A LONGER ONE.` (13.5–16.0)
8. `BIOCONNECT — free in your browser` (13.5–16.0)
9. `bioconnectpazzle.com` (13.5–16.0)

(Swap "7" and "B" for whatever the footage really shows.)

## 6. Sound design

- **0–3 s:** no music. Harpsichord pluck per badge, then near-silence with a faint tick (tension = absence).
- **3–4.6 s:** soft "tok" per preview touch.
- **4.6–6 s:** 0.3 s of total silence when the panic faces appear, then a rising theremin note (from Tiptoe Hollow palette).
- **6.0 s:** real placement SFX, louder than anything before.
- **6.4–11 s:** real merge pops (they already rise in pitch with chain length); Tiptoe Hollow enters on chain step 3.
- **11–12.5 s:** game's finale chain sound; music swells for one bar.
- **13.5–16 s:** title music box motif. No voiceover, no trending track needed.

## 7. Editing directions

- Hard cuts only; no wipes. Every punch-in is 110–120% and lands on the square that matters.
- Dim layer (35%) on everything that is not hand tile / A-B-C / chain cluster during 0–6 s; remove the dim when the cascade starts.
- No speed-up before the tap; 0.85× on the B preview; 1.15× in the back half of the cascade only.
- One 2-frame shake on the tap. No other shake.
- Do not cut inside the cascade — continuity is the proof it's real.
- Keep the game's UI (score, hand) visible; it's evidence that this is a playable game.

## 8. CTA variants

1. `GOT IT RIGHT? PROVE IT.` / `PLAY FREE — bioconnectpazzle.com`
2. `YOUR TURN. NO DOWNLOAD.` / `BIOCONNECT`
3. `CAN YOU BEAT A 7-CHAIN?` / `PLAY IN YOUR BROWSER`
4. `THE MEADOW IS WAITING.` / `BIOCONNECT — PLAY FREE`

## 9. Platform versions

- **TikTok:** keep the pause at 1–3 s but add a pinned comment "A, B or C? answer before 0:06". Post a second cut that **never reveals** the answer (stop at the tap, "answer in comments") to farm replies. Optional face-cam reaction in the corner at the INCREDIBLE banner only. Link in bio.
- **YouTube Shorts:** shorten the pause to 1.2 s (Shorts viewers swipe less but expect a clean story), keep the full reveal, end on the URL for 2 s so loopers see it. Title: "One tap, 7-animal chain — would you find it?"
- **Instagram Reels:** add a 6% gold frame matching the board border, use the game's serif typeface for overlays, slightly slower cascade (no 1.15×). Lead with visual polish; cover frame = INCREDIBLE banner. "Link in bio / bioconnectpazzle.com".
- (Your X audience is Indian/US devs: also post the TikTok cut with "built this solo — A, B or C?" so it fits build-in-public.)

## 10. Production prompt

> Vertical 9:16, 16 seconds, real screen recording of the browser game Bioconnect (5×5 dark-green meadow board, painted animals). 0–3 s: freeze frame one move before a real 7-merge chain; dim everything except the hand tile and three empty squares badged A, B, C; text "1 TAP." and "ONE OF THESE STARTS A 7-CHAIN." then "A, B or C?"; no music, harpsichord pluck per badge. 3–6 s: finger previews A (short arrow), C (short arrow), then B (long arrow path, animals switch to panic faces, rocks show CLEAR cracks), 0.3 s silence then rising theremin. 6 s: tap B, 120% punch-in, 2-frame shake. 6.4–11 s: uncut real cascade with camera following each landing square, game merge sounds rising, BGM enters on step 3, slight 1.15× in second half. 11–12.5 s: hold on "INCREDIBLE! 7 CHAIN" banner. 12.5–13.5 s: text "IT WAS B." / "Did you get it?". 13.5–16 s: title screen, text "FIND A LONGER ONE." / "BIOCONNECT — free in your browser" / "bioconnectpazzle.com", music-box motif. Use only real gameplay; no fake UI, no added effects beyond dimming, punch-ins and one shake.

---

## Production notes / honesty checks

- The chain must come from a real human play session (not `?watch`, which is a bot). If you ever use `?watch` footage, label it "bot run".
- Hover preview works with mouse hover, keyboard focus and touch-and-hold. Easiest capture: desktop Chromium window at 540×960.
- Long chains are rare; capture many sessions, or play until one happens and keep the recording running.
- Don't reuse the App Store screenshots — they show seasons, removed on 2026-10-22.
