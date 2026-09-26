---
name: ui-format
description: Concrete visual design tokens (colors, spacing, shadows, typography) and component patterns (card, form, button, badge, star rating) behind CobbleWorks's warm "Terracotta & Cream" UI. Backed by tokens.css at the project root. This is the required look for the platform pages themselves (index/requests/matching/profile/apps). For a mini app it is one option the user may pick, never the automatic default — see mini-app-builder's "Choosing the Look". Pairs with ui-guidelines (abstract principles) and app-template (starter markup).
---

# UI Format

The concrete style tokens and component patterns behind CobbleWorks's UI. `ui-guidelines` says *what* qualities a screen should have (responsive, accessible, minimal); this skill gives the *actual values* to reuse so new screens look like they belong to the same app.

**Scope.** These values are required for the platform pages themselves
(`index.html` / `requests.html` / `matching.html` / `profile.html` / `apps.html`),
so the shell stays one product. A **mini app** under `apps/` is a different case:
its look is the user's choice, offered as one of three rendered options (see
mini-app-builder's "Choosing the Look"). Use this palette for a mini app when the
user picks it — not because it is written down here.

The source of truth is `tokens.css` at the project root — a `:root` block of `--map-*` CSS variables plus optional ready-made `.map-*` component classes. Every mini app should link `tokens.css` (in addition to its own `style.css`) and reference `var(--map-*)` rather than hard-coding hex values.

## Color Palette (`--map-*` in tokens.css)

| Token | Hex | Use |
|---|---|---|
| `--map-bg` | `#FAF4EC` | Page background (warm off-white) |
| `--map-card` | `#FFFFFF` | Card / surface background |
| `--map-border` | `#EDE2D4` | Borders / hairlines / input borders |
| `--map-divider` | `#F4EBDF` | Thin in-card divider line |
| `--map-ink` | `#3D3229` | Headings & body text |
| `--map-text-2` | `#6B5F51` | Secondary text |
| `--map-muted` | `#8C7F70` | Muted labels / captions |
| `--map-faint` | `#B5A794` | Faintest text (dates, meta) |
| `--map-accent` | `#D9704C` | Primary accent (terracotta) — one content type's primary actions/links |
| `--map-accent-hover` | `#C25B39` | Accent hover state / chip text on tint |
| `--map-accent-tint` | `#F8E4DA` | Chip / soft tint background for accent elements |
| `--map-accent-line` | `#E8C9BB` | Outline-button border |
| `--map-success` | `#2E9E54` | A second, distinct content type (e.g. mini apps vs. requests) |
| `--map-success-tint` | `#F0FAF3` | Success background |
| `--map-success-hover` | `#DDF4E4` | Success hover background |
| `--map-star` | `#F5A623` | Rating stars only |
| `--map-error` | `#C0392B` | Destructive actions / validation errors only — never decorative |
| `--map-toast-bg` / `--map-toast-text` | `#3D3229` / `#FAF4EC` | Toast background/text (reserve for future toast component) |

Overlays & shadows: modal scrim `rgba(61,50,41,0.40)`, card shadow `--map-shadow-card` (`0 2px 10px rgba(60,40,20,0.06)`), modal shadow `--map-shadow-modal` (`0 24px 60px rgba(60,40,20,0.30)`), focus ring `--map-focus-ring` (`0 0 0 3px rgba(217,112,76,0.15)`).

Pattern: pick one accent color per distinct "kind of thing" on the page (e.g. requests = terracotta `--map-accent`, apps = green `--map-success`) and reuse it consistently for that kind's links, badges, and left-border accents.

## Typography

- `font-family: var(--map-font)` → `"Nunito", sans-serif`, weights 400/600/700/800. Load via Google Fonts `<link>` in `<head>`:
  `https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap`
- Page title (`h1`): `--map-size-title` 26px, weight 800.
- Card title (e.g. `.card-users`, `.app-name`): `--map-size-card` 17px, weight 800, line-height 1.4.
- Body/card text: `--map-size-body` 14px, line-height 1.5, color `--map-text-2` for secondary body copy.
- Micro-label (`.card-label`): `--map-size-label` 11px, weight 800, uppercase, `letter-spacing: var(--map-label-spacing)` (0.06em), color `--map-muted`.
- Helper text under form labels (`small`): 13px, color `--map-muted`.
- Faint metadata (dates): 12px, color `--map-faint`.

## Spacing Scale

Use these increments consistently instead of arbitrary values: **4, 8, 12, 16, 20, 24, 40px** — with one named exception: card internal padding is **22px** (`.map-card`), matching tokens.css exactly.

- Tight gaps (icon+text, inline groups): 4-8px
- Element-to-element inside a component (label→input, card internal spacing): 12-16px
- Section-to-section gaps (margin-bottom on major sections): 40px
- Page margin: `40px 20px`, content max-width `680px`, centered (`margin: 0 auto`)

## Shape & Elevation

- Card/panel radius: `--map-radius-card` 20px. Modal radius (future): `--map-radius-modal` 24px.
- Button / chip / search input / tabs radius: **pill**, `--map-radius-pill` (999px).
- Regular text input / textarea / select radius: 12px.
- Logo radius: `--map-radius-logo` 12px. App icon radius: `--map-radius-icon` 14px (once the platform introduces icons).
- Card/panel shadow: `var(--map-shadow-card)` — one soft, low shadow, never stacked or darker.
- No borders on cards — separation comes from the shadow + white-on-warm-cream contrast against `--map-bg`.

## Component Patterns

**Form group** — repeatable unit for every input:
```
<div class="form-group">
  <label for="id">Label</label>
  <small>One-line hint about what to enter</small>
  <input id="id" placeholder="e.g. concrete example" required />
</div>
```
Inputs/textareas/selects: full width, `padding: 12px 16px`, 1.5px `var(--map-border)` border, 12px radius, accent-colored border + `var(--map-focus-ring)` on focus.

**Card** — repeatable unit for a list item:
- White background, 20px radius, 22px padding, soft shadow, 16px margin-bottom.
- Optional 4px colored left border (`border-left`) to mark which "kind" of card it is.
- Internal structure: title/accent line → repeated (label → text) pairs → thin `var(--map-divider)` top-border before footer areas (metadata, actions, linked items).

**Primary button**: filled `--map-accent`, white text, no border, pill radius, darker (`--map-accent-hover`) on hover, `cursor: pointer` (e.g. `.map-btn--primary`).

**Secondary/outline button**: `--map-card` background, `--map-accent-hover`-colored text, 1.5px `--map-accent-line` border, `--map-accent-tint` background on hover, pill radius (e.g. `.want-btn`, `.map-btn--secondary`).

**Badge / pill chip**: small tinted-background chip, pill radius, 12px font, bold text, `padding: 4px 12px`. Two flavors:
- *Confirmed link* (e.g. `.linked-app-link`): filled tint — `--map-success-tint` bg / `--map-success` text (or `--map-accent-tint` / `--map-accent-hover` for the accent-colored variant, `.map-chip`).
- *Suggestion / not yet confirmed* (e.g. `.related-app-link`): outline treatment instead of filled tint — `--map-card` bg, 1.5px `--map-accent-line` border, `--map-accent-hover` text — reads as "candidate" rather than "fact".

**Star rating**: gold (`--map-star`) filled/outline stars (★/☆), an average row (rounded average + "X.X (N ratings)" / "No ratings yet") above an interactive rate row that highlights on hover and commits on click.

**Search input**: full-width, `padding: 12px 16px`, 16px font, pill radius, and — unlike other inputs — gets a visible focus glow (`var(--map-focus-ring)`) since it's the primary page-level action.

**Destructive icon button** (e.g. delete): `--map-faint` color by default, `--map-error` on hover with a subtle `rgba(192,57,43,0.08)` hover background, circular (`border-radius: 50%`).

**Toast** (reserved for future use, e.g. `.map-toast`): `--map-toast-bg` background, `--map-toast-text` text, pill radius, `var(--map-shadow-modal)`.

## Empty / Search States

Every list has both:
- A "nothing here yet" message when the list is genuinely empty (encourage the first action).
- A distinct "no results found" message when a search query filters everything out.

## When to Deviate

These are defaults for visual consistency across the platform, not hard rules — deviate when a mini app's purpose genuinely calls for a different accent color or layout, but keep the spacing scale, shadow style, and radius values (and the underlying `--map-*` tokens) unless there's a specific reason not to.
