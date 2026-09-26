# Bioconnect opening screen concepts v1

Three staged versions of the start screen, for review before any of them
goes into `apps/ecosystem-puzzle/index.html`. Open `index.html` in this
folder to see all three side by side in phone frames.

## Files

- `index.html` — comparison page (three phone frames + notes)
- `a-meadow-poster.html` — A. Meadow poster
- `b-nightfall.html` — B. Nightfall
- `c-living-board.html` — C. Living board
- `_sprites.part` — the `<symbol>` block copied out of the game's
  `index.html`, used to build the three samples. Re-copy it if the
  animal art changes.

Each sample is one standalone file with the sprite block inlined, so it
can be opened directly without the game's `style.css` or `script.js`.
The palette, fonts and animal art are the game's own — nothing new was
introduced.

## The three directions

| | A. Meadow poster | B. Nightfall | C. Living board |
|---|---|---|---|
| Mood | cute, casual, free | calm, premium, indie | honest, product-like |
| Background | painted meadow scene | dark meadow + fireflies | the real board, playing |
| Wordmark | chunky cream, green outline | light/bold split, warm glow | game type + a tile as the "o" |
| Teaches the goal | no | yes (the lit chain arc) | yes (chain strip + live board) |
| New art needed | hills and sky only | treeline only | none |
| Risk | least like the in-game UI | breaks the light theme | least "storefront" of the three |

All three carry the same content: title, one line of promise, best
score, Play, How to play, Sound. Only the staging differs, so the
choice is purely visual — the wiring into `script.js` is identical.

## Notes

- Nothing here is wired up yet; the buttons are inert.
- Every animation is guarded by `prefers-reduced-motion`.
- B is the only one that leaves the game's light palette, and it is the
  only one that uses the warm accent for something other than an
  animal — worth deciding deliberately.
