# Project Rules

Instructions for coding agents working in this repository.

## Working Style

- Always communicate with the user in natural Japanese. All application UI must be in English.
- The user is a beginner programmer — explain changes simply and in small steps (see the `beginner-guide` skill).
- Before editing files, explain what will change and why, then wait for approval. Do not edit first and explain afterwards.
- Keep output concise; don't restate unchanged code (see the `token-optimizer` skill).
- At the start of a session, read `PROGRESS.md` to catch up on recent work; append to it when a chunk of work wraps up. This is how sessions on different machines stay in sync, and it is the project's memory — anything not written there is lost.

## Project Structure

Each standalone mini app lives under:

```text
apps/{app-slug}/
  index.html
  style.css
  script.js
```

- Do not modify the platform root files (`index.html`, `style.css`, `script.js` at the repo root) unless the task explicitly requires platform integration.
- Build each mini app independently first. Only touch the platform root when asked to register or link it.
- The platform root is a request/mini-app board, not an app launcher. Mini apps are registered by the user manually filling in the "Submit a Mini App" form — there is no automatic scan of `apps/`. Don't build auto-registration logic unless explicitly asked.

## Hard Rules

These hold even if no skill has been loaded.

**Security**

- Never run or `eval` user-submitted app code inside the platform. Mini apps are linked as separate pages, not executed inline.
- Never render user input with `innerHTML`. Use `textContent` or `createElement`.
- Validate URLs before using them as links: allow only `http://` and `https://`. Reject other schemes (e.g. `javascript:`).
- External links always get `target="_blank"` and `rel="noopener noreferrer"`.
- No secrets, API keys, or credentials in frontend code. This stack has no backend, so never suggest hiding a key in a mini app.
- Don't add scraping of external websites without discussing it with the user first.
- If an app relates to companies, investing, finance, or business decisions, include a short disclaimer, e.g. "This tool helps you organize notes. It does not provide financial advice."

**`supabase-config.js` is intentional, leave it alone**

It contains a Supabase URL and a publishable (anon) key in plain text. This is by design — that key is meant to be public, and the data is protected by row-level security on the Supabase side. Do not "fix" this by moving it to environment variables, and never add a `service_role` key to this repo.

**localStorage**

- Key format: `{app-slug}:{entity}:v1` (e.g. `companyWatchlist:companies:v1`). Never generic keys like `items` or `data`.
- Always wrap `JSON.parse` in a try/catch when reading stored data. Corrupted or missing data must not crash the page — fall back to an empty array or object.
- Don't store sensitive personal data.
- localStorage is per-browser only and never shared between users. Don't imply otherwise in UI copy.

**Git**

- Run `git status` before starting a change.
- After a completed step, suggest a commit — don't commit automatically without being asked.
- Never push to a remote unless explicitly asked.
- Never run destructive commands (`git reset --hard`, `git clean -fd`, force push, deleting files) without explicit approval.

## Request-to-App Principle

The product idea is **Problem → Request → Mini App**. Every mini app should be describable as:

- Which request it answers
- Who it is for
- What small problem it solves
- How the user can try it

Keep this framing in planning discussions and in any integration copy.

## Skills

Detailed guidance lives in `.agents/skills/{name}/SKILL.md`. Read the relevant one before starting; don't work from this file alone.

| Task | Skill |
|---|---|
| Building or extending a mini app (entry point) | `mini-app-builder` |
| Project structure, security, localStorage, git rules | `platform-rules` |
| Visual design, responsiveness, accessibility | `ui-guidelines` |
| Concrete colors/spacing/component patterns to reuse | `ui-format` |
| Scaffolding a brand-new app's files | `app-template` |
| Fixing a bug / investigating an error | `debugging` |
| How to phrase explanations to the user | `beginner-guide` |
| Keeping responses and tool use lean | `token-optimizer` |

`mini-app-builder` is the usual starting point for build work; it references the others by name rather than duplicating their rules.

**Note on the two skill directories.** The same skills exist twice: `.agents/skills/` (read by Codex) and `.claude/skills/` (read by Claude Code). They are mirrors. If you change a skill, apply the same change to both copies so the two tools don't drift apart.
