---
name: mini-app-builder
description: Use when creating a new mini app or adding a significant feature to an existing one under apps/. Orchestrates the planning checklist and the before/after coding workflow (explain → approve → code → summarize). This is the entry point for mini app build work — also invoke platform-rules, ui-guidelines, and app-template alongside it.
---

# Mini App Builder

Entry point for building or extending a mini app. This skill owns the *workflow*; it delegates specifics to sibling skills:

- Project structure, security, storage keys → **platform-rules**
- Visual design, responsiveness, accessibility → **ui-guidelines**
- Starter file skeleton / boilerplate → **app-template** (new apps only)
- Fixing bugs found along the way → **debugging**
- Communication style with the user → **beginner-guide**
- Keeping output lean → **token-optimizer**

When a task clearly needs one of those, invoke it via the Skill tool alongside this one rather than re-deriving its rules here.

## Mini App Planning Checklist

Before creating a new mini app, define:

1. App name and app slug
2. Target users
3. Problem it solves (and which request it answers, if any — see platform-rules' request-to-app principle)
4. MVP features for this first version
5. Features intentionally not included yet
6. Files to create or modify — a new app always touches **four** places, not
   three: `apps/{slug}/index.html` / `style.css` / `script.js`, **and an icon
   entry in `app-icons.js`** (see "Every App Gets an Icon" below)
7. localStorage key name (see app-template's naming convention)
8. How to test it
9. Usage guide — a short in-app help/about section explaining what the app does and how to use it (see ui-guidelines' standard features checklist). Build this **with the first version**, not tacked on later.

Keep the first version small — resist adding features beyond the MVP list without the user asking.

## Choosing the Look — Show, Don't Assume

The look of a new app is the user's call, not yours. Reaching for the CobbleWorks
palette every time is what makes forty apps look like one app.

So for a **new app** (not a small change to an existing one), before writing the
real `style.css`:

1. Work out what the one screen needs — the fields, the list, the buttons.
2. Write one throwaway HTML file in the scratchpad that draws that same screen
   **three times, side by side**, one per visual direction. Use the app's real
   labels and sample rows, never lorem ipsum.
3. Make the three genuinely different. Vary the palette, the type (system
   stacks only — serif vs sans vs monospace; mini apps load no web fonts), the
   corner radius (sharp / soft / pill), the density (airy / compact), and what
   carries the structure (hairline borders / soft shadows / flat blocks of
   colour). Three shades of one idea is not a choice.
4. Name each one and say how it should feel in one line — e.g.
   「1. ノート — クリーム色の紙、セリフ体の見出し、手描きのチェック」.
5. **Render it and send the picture.** Screenshot it with Chromium/Playwright at
   a phone width and send it with `SendUserFile`, then ask which number.
   Describing the three in words is not enough — a beginner cannot picture the
   difference from prose. Say that 「2番、でも色は3番」 is a fine answer.
6. Write the real `style.css` only after the user has answered.

If the user says they do not mind, pick the direction that suits the problem —
a budget tracker and a bedtime reminder should not look alike — and say which
one you picked and why.

`ui-format` is one of the three options, not the automatic default. Keep the
site-wide rules from `ui-guidelines` (tap-target sizes, 16px form text,
contrast, empty states) in **all three** directions — those are usability, not
taste, and are never up for a vote.

## Every App Gets an Icon — No Exceptions

A mini app without an entry in `app-icons.js` falls back to a plain letter
badge on the CobbleWorks app list. That looks unfinished, and it is invisible
while you work — the app's own page looks perfect, so the omission is only
noticed weeks later by the user. It has been missed repeatedly. Treat the icon
as part of the app, not as an afterthought.

So, for every new app, before you call the build done:

1. Add one line to `app-icons.js`, keyed by the folder name (the slug):

   ```js
   'my-app': { c: 'c2', d: '<path d="…"/><circle cx="12" cy="12" r="3"/>' },
   ```

   `d` is the inside of a 24×24 `<svg>` — strokes only, no `fill`, no colour
   (the file's `SVG_OPEN` sets stroke width and the colour is white). `c` is
   the tile colour: `c0` terracotta (life, records) / `c1` green (money) /
   `c2` yellow (learning, health) / `c3` dark brown (tools). Keep the list in
   alphabetical order by slug.

2. **Render it and look at it at 40px**, the size the list actually uses — not
   just large. Detail that reads fine at 88px turns to mush at 40px; two small
   figures become one blob. Draw fewer, bigger shapes until it survives.

3. Make it distinct from the apps next to it. For a genuine pair (a Japan and
   a US edition, a personal and a team version), reuse the same drawing and
   change `c` — that is the house convention, not laziness.

4. Renaming an app's folder means renaming its icon key too. `grep -rn
   {old-slug}` finds every place a slug is written.

`test/app-icons.test.js` fails when an app under `apps/` has no icon, which is
why `node test/run.js` is in the Definition of Done below.

## Workflow Before Coding

Before making changes, briefly explain (in Japanese, per beginner-guide):

- The goal of the change
- Why the change is necessary
- Which files will be created or modified
- Any terminal commands needed

Then wait for the user's approval before editing files. Do not make large changes without confirmation.

## Workflow After Coding

After coding, briefly summarize (in Japanese):

- Files changed
- What was implemented
- How to run it
- How to test it
- What the next small step should be

## Submission Text — Always Output It After Building

A finished mini app is not on CobbleWorks until someone types it into the
"Submit a mini app" form by hand. Writing that text is your job, not the
user's, and it is in **English** because the form and the site are in English.

So the **last step of every mini app build** — a new app, or any change big
enough that the old description no longer describes it — is to print a
ready-to-paste block, one form field per heading, with no placeholders left in
it. Print it **without being asked**:

- **Mini app name**
- **Description** — 3–5 sentences. Say what the user actually does with it,
  in concrete nouns from the app itself ("the ice, the cups, the speaker"),
  not category words like "efficient" or "user-friendly". Match the length and
  tone of the descriptions already on the site.
- **App URL** — the live GitHub Pages URL, not a local path
- **Target users** — one sentence, usually "Anyone who …", naming the moment
  the problem bites
- **Category** — one of the seven in the form. If none of them really fit,
  say so and suggest the missing one (see the category-suggestions rule)
- **Built for request** — the request text the app answers, or "none"

Put each field in its own copyable code block so the user can copy them one at
a time. Then say anything the user has to decide (a category judgement call,
for example) in Japanese, below the block — never inside it.

## Definition of Done

A mini app task is done only when:

- The app opens in the browser with no console errors
- The main user flow works end-to-end
- Data persists after reload (if using localStorage)
- Empty state and basic validation both work (see ui-guidelines)
- For a new app, the visual direction was **chosen by the user from three
  rendered options** (see "Choosing the Look"), not defaulted to `ui-format`
- A usage guide is present (see Planning Checklist item 9)
- UI text is English
- The app's icon is registered in `app-icons.js` and has been **looked at,
  rendered, at 40px** (see "Every App Gets an Icon" above)
- `node test/run.js` passes with **0 failures**. If a test was already failing
  before your change, say so to the user and fix it anyway when it is this
  small — a red suite hides the next real breakage
- `node tools/seo.js` has been run, so the new app gets its search description,
  canonical URL, share card and CobbleWorks footer, and joins `apps.html` and
  `sitemap.xml`. The script reads the app's own `<title>` and its subtitle
  paragraph — if the app has no usable subtitle, add one to
  `DESCRIPTION_OVERRIDES` in that script instead of leaving it blank
- The submission text for the "Submit a mini app" form has been printed
  in English (see "Submission Text" above)
- The user knows how to test it, and what the next small step is

For localStorage apps, test at minimum: add item, display item, reload page, search/filter (if present), delete item (if present), empty state, and mobile width.
