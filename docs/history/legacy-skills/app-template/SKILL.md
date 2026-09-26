---
name: app-template
description: Starter file skeleton and boilerplate code for scaffolding a brand-new mini app under apps/{app-slug}/ — HTML structure, the AppSync.store() data layer with its openStore fallback stub, the sync traps that cause cross-device data loss, and base CSS variables. Use when creating the first version of a new mini app's files, or when adding cloud-synced data to an existing one.
---

# App Template

Boilerplate to copy when starting a new mini app. Keeps every app consistent with platform-rules (security, storage keys) and ui-guidelines (visual style) without re-deriving them each time.

## File Skeleton

```text
apps/{app-slug}/
  index.html
  style.css
  script.js
app-icons.js          <- one line, at the repo root: the app's list icon
```

The icon is not optional and not a later step. Without it the app shows a bare
letter badge on the CobbleWorks list, and nothing in the app's own pages
reveals that it is missing. See mini-app-builder's "Every App Gets an Icon"
for the entry format and the 40px check.

### index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{App Name}</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header>
      <h1>{App Name}</h1>
      <p>{One-line description of what it does}</p>
    </header>

    <main>
      <!-- sections go here -->
    </main>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="../../supabase-config.js"></script>
    <script src="../../app-sync.js"></script>
    <script src="script.js"></script>
  </body>
</html>
```

The three shared scripts must come before `script.js`. Order matters: `app-sync.js` reads `supabaseClient` from `supabase-config.js`.

### script.js — data layer

Don't read or write `localStorage` directly for app data. `AppSync.store()` is the data layer — it owns saving, the initial local/cloud merge, conflict resolution, debounced upload, retry, cross-tab updates, and the "loaded changes from another device" toast. The app only calls `get()` / `set()` / `subscribe()`.

Two guarantees the sync layer makes, so you never write around them:

- **`get()` always returns a copy.** Read it, mutate it in place, save it — the cache won't see the intermediate state.
- **`subscribe()` only fires for other devices and other tabs.** Your own `set()` never triggers it, so don't check the `source` argument. Re-render after your own actions yourself.

```js
// Key used before this app synced. AppSync harvests it once on first run
// and leaves it in place, so a rollback still finds the old data.
const LEGACY_STORAGE_KEY = '{appSlugCamelCase}:{entity}:v1';

let store = null;

// Fallback for when app-sync.js fails to load. localStorage only, no sync.
// Writes the same key in the same envelope format, so the next healthy load
// picks it up and uploads it. Copy as-is; don't trim it.
async function openStore(slug, key, opts) {
  try { if (window.AppSync) return await window.AppSync.store(slug, key, opts); } catch (e) { console.error(e); }
  const o = opts || {}, k = 'appdata:' + slug + ':' + key;
  const read = function (s) { try { return JSON.parse(localStorage.getItem(s)); } catch (e) { return null; } };
  const cp = function (v) { return v == null ? v : JSON.parse(JSON.stringify(v)); };
  const env = read(k);
  let c = env && 'd' in env ? env.d : ((o.legacyKey && read(o.legacyKey)) ?? o.default ?? null);
  return {
    get: function () { return cp(c); },
    set: function (v) {
      c = cp(v);
      try { localStorage.setItem(k, JSON.stringify({ v: 1, av: o.version || 1, t: Date.now(), o: null, d: c })); } catch (e) {}
      return Promise.resolve();
    },
    subscribe: function () { return function () {}; },
    flush: function () { return Promise.resolve(); },
    status: function () { return { online: false, syncing: false, lastSyncedAt: null, error: null }; }
  };
}

function getItems() {
  if (!store) return [];
  const items = store.get();
  return Array.isArray(items) ? items : [];
}

function saveItems(items) {
  if (!store) return;
  store.set(items).catch(function (e) {
    console.error('{App Name}: 保存に失敗しました', e);
  });
}

// Single entry point for redrawing. Call it after every action that saves.
function renderAll() {
  const items = getItems();
  // ...render the list, empty state, counts
}

document.addEventListener('DOMContentLoaded', async function () {
  // Data layer first — don't let the user act on a half-loaded screen
  store = await openStore('{app-slug}', '{entity}', {
    default: [],
    legacyKey: LEGACY_STORAGE_KEY
  });

  store.subscribe(function () { renderAll(); });
  renderAll();
});
```

An action looks like: read with `getItems()`, change the array, `saveItems()`, then `renderAll()`. Every save needs its own `renderAll()` call — `subscribe` won't do it for you.

For a brand-new app with no previous version, drop `LEGACY_STORAGE_KEY` and the `legacyKey` option — there's nothing to harvest.

Settings that are device-specific rather than user data (theme, language, sort order) stay on plain `localStorage`; they shouldn't follow the user across devices. Parse those defensively per platform-rules.

### Sync traps — the rules that cost real data

These came out of a "PC and phone show different lists" incident. Each one is invisible on a single device and only bites when two devices with separate histories meet, so follow them by default rather than deciding case by case.

**Never put these in a store.** They belong on plain `localStorage`, keyed per device:

- API keys — a store is account-wide, and keys are the user's own credential for their own browser
- Device identifiers (push registration ids and the like) — a device id copied to another device breaks the feature it exists for
- The platform language setting (`LANG_KEY`) and other display preferences

**Reading another app's data: open its store read-only.** Never reach into another app's `localStorage` key, and never `set()` on a store you don't own:

```js
// news-feed reading the watchlist that company-watchlist-us owns
watchlistStore = await openStore('company-watchlist-us', 'companies', {
  default: [], legacyKey: LEGACY_WATCHLIST_KEY   // the owner app's legacy key
});
```

Use `watchlistStore.subscribe()` for updates, not `window.addEventListener('storage', ...)`. The store already covers other tabs, and it adds other devices for free.

**Never build an envelope or a timestamp by hand.** `{ v, av, t, o, d }` and the `t`/`o` rules are app-sync's business. Two specifics that look like bugs but are deliberate:

- Data harvested from a `legacyKey` is stamped `t = 0` (oldest), never `Date.now()`. Old localStorage data has no modification time; calling it "now" makes a second device's stale copy beat the cloud and wipe it.
- The `openStore` fallback stub writes `o: null` on purpose — it means "written with no signed-in owner", and app-sync discards such data when a cloud row exists. Don't "fix" it to write an owner id.

**Syncing is not verified by a syntax check.** Before calling a new app done, open it in a real browser while signed in, add an item and delete it, and confirm the cloud row (`user_app_data`) changed to match. `node --check` passes straight through every failure above.

**One known limitation to design around:** conflict resolution replaces the whole document — the newer `t` wins entirely. Two devices editing the same list means one side's edits are lost. Prefer many small keys over one giant list when a shape choice is available.

### style.css — base variables

```css
:root {
  --color-primary: #4a90e2;
  --color-text: #333;
  --color-muted: #888;
  --color-bg: #f5f5f5;
}

body {
  font-family: sans-serif;
  margin: 0;
  padding: 40px 20px;
  background-color: var(--color-bg);
  color: var(--color-text);
}

header, main {
  max-width: 680px;
  margin: 0 auto;
}
```

## Naming Conventions

- App slug: kebab-case, matches the folder name (e.g. `company-watchlist`). This is the first argument to `openStore()`.
- Synced data lives under `appdata:{app-slug}:{key}`, written by app-sync — you never build that key yourself. For an incompatible shape change, bump `version` and pass a `migrate` function instead of changing the key.
- Device-local settings keep the plain key format `{appSlugCamelCase}:{entity}:v1`.
- File names stay exactly `index.html`, `style.css`, `script.js` for every app, so tooling and habits stay predictable.
