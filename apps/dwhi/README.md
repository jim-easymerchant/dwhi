# Do We Have It? — Expo app

> **This directory is a placeholder.** Until the follow-up branch
> physically moves the Expo entry into `apps/dwhi/`, the canonical
> location for the app is still the repo root (`app/`, `assets/`,
> `app.json`).

The monorepo package boundary already exists — see
[`/MONOREPO.md`](../../MONOREPO.md). The next refactor branch will:

1. Move `app/` → `apps/dwhi/app/`.
2. Move `assets/` → `apps/dwhi/assets/`.
3. Move `app.json` / `app.config.js` → `apps/dwhi/`.
4. Add this app to the root `workspaces` array (currently
   `packages/*` only).
5. Update Expo + Metro config to set the project root and
   `watchFolders` so live-reload picks up `packages/*` changes.

Until then, no files live here.
