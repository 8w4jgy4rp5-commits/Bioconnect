---
name: platform-rules
description: Foundational rules for the mini-app-platform project — where files live, the request-to-app principle, security rules, localStorage conventions, and git workflow. Apply this whenever creating, moving, or modifying any file in the project, especially under apps/ or the platform root (index.html/style.css/script.js).
---

# Platform Rules

Ground rules for the mini-app-platform repo. Other skills (mini-app-builder, ui-guidelines, app-template, debugging) build on top of these — apply this skill alongside them, not instead of them.

## Project Structure

Each standalone mini app lives under:

```text
apps/{app-slug}/
  index.html
  style.css
  script.js
```

Example: `apps/company-watchlist-us/`

Every app also needs one line in `app-icons.js` at the repo root, keyed by its
folder name — that is the icon shown on the app list. It lives outside the
app's folder, so it is easy to forget; `node test/run.js` fails when it is
missing. See mini-app-builder's "Every App Gets an Icon".

- Do not modify the platform root files (`index.html`, `style.css`, `script.js` at repo root) unless the task explicitly requires platform integration.
- Build each mini app independently first. Only touch the platform root when asked to register/link it.

## Platform Integration Model

The platform root is a request/mini-app board, not an app launcher. Mini apps are registered by a user manually filling in the "Submit a Mini App" form (name, description, URL, target users, built-for-request) — there is no automatic scan of `apps/`. Don't build auto-registration logic unless explicitly asked.

## Request-to-App Principle

Core product idea: **Problem → Request → Mini App**. Every mini app should be describable as:

- Which request it answers
- Who it is for
- What small problem it solves
- How the user can try it

Keep this framing in planning discussions and in any integration copy you write.

## Security Rules

- Never run or `eval` user-submitted app code inside the platform. Mini apps are linked as separate pages, not executed inline.
- Never render user input with `innerHTML`. Use `textContent` or `createElement`.
- Validate URLs before using them as links: only allow `http://` and `https://`. Reject/ignore other schemes (e.g. `javascript:`).
- External links: always add `target="_blank"` and `rel="noopener noreferrer"`.
- No secrets, API keys, or credentials in frontend code — this stack has no backend, so never suggest adding a "hidden" key to a mini app.
- Don't add scraping of external websites without discussing it with the user first.
- If the app relates to companies, investing, finance, or business decisions, include a short disclaimer, e.g. "This tool helps you organize notes. It does not provide financial advice."

## localStorage Rules

- Key format: `{app-slug}:{entity}:v1` (e.g. `companyWatchlist:companies:v1`). Never use generic keys like `items` or `data`.
- Always wrap `JSON.parse` in a try/catch (or equivalent guard) when reading from localStorage — corrupted or missing data must not crash the page. Fall back to an empty array/object.
- Don't store sensitive personal data.
- Remember localStorage is per-browser only, never shared between users — don't imply otherwise in UI copy.

## Git Workflow

- Run `git status` before starting a change so you know the current state.
- After a completed step, suggest a commit — don't commit automatically without being asked.
- Never push to a remote unless explicitly asked.
- Never run destructive commands (`git reset --hard`, `git clean -fd`, force push, deleting files) without explicit approval.
