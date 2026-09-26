---
name: ui-guidelines
description: Visual design and UX rules for mini app UIs — modern/minimal styling, responsive and mobile-first layout, accessibility, and the standard feature checklist (empty state, validation, error handling, keyboard support). Apply when writing or reviewing HTML/CSS for any apps/{app-slug}/ page.
---

# UI Guidelines

Design and UX rules for every mini app screen. Pairs with app-template (which provides the starter markup/CSS these rules apply to).

## UI Language

All user-facing text is English, regardless of the conversation language:

- Page titles, headings, buttons, labels, placeholders
- Validation and error messages, empty states, help text
- Dialogs, notifications, sample/demo data shown on screen
- `aria-label` and other accessibility strings

Use concise, natural English suitable for an international audience.

## Visual Design Principles

- Modern, clean, minimal — avoid visual clutter.
- Responsive and mobile-first: design the small-screen layout first, then enhance for wider viewports.
- Consistent spacing scale, rounded corners, soft shadows, clear typography.
- Simple, obvious navigation — no deep menus for a single-purpose mini app.
- Animations subtle and short (~200ms), never required to understand the UI.

## Standard Features Checklist

Unless genuinely not applicable, every mini app screen should have:

- Responsive layout that works down to mobile widths
- An empty state (what to show when there's no data yet)
- Basic input validation (required fields, sensible input types, reject whitespace-only input)
- Error handling for bad/missing localStorage data (see platform-rules)
- Keyboard-friendly controls (native `<button>`/`<input>`, visible focus states)
- Accessible labels (`<label for>`, `aria-label` where there's no visible label)
- A short in-app usage guide (使い方) — a brief help/about section (or a "?"/"How to use" button opening one) explaining what the app does and how to use its main features. Write this **in the first version**, alongside the initial build, not as a later add-on.

Only add a loading state when there is a real async operation — plain localStorage reads don't need one.

## Definition of Done (UI)

A screen is done when: it renders correctly at mobile width, the empty state shows with no data, validation blocks obviously-bad input, no console errors appear, and all visible text is English.
