# Cider EDM Popularity Plugin

Cider 2.x plugin that decorates track rows with a local popularity score from a SQLite database.

## Project Layout
- `index.js`: backend plugin entry and IPC score lookup.
- `index.frontend.js`: renderer badge injection and cached score requests.
- `scripts/update_db.mjs`: daily-friendly local DB updater.
- `scripts/adapters/*.mjs`: source adapters (sample adapter active, others stubbed).
- `data/sample_seed.json`: keyless seed data used when external sources are not reliable.
- `docs/testing.md`: manual test plan for macOS + Cider 2.x.

## Setup
```bash
make install
make update-db
```

This creates/updates:
- `data/edm_popularity.sqlite`
- `data/last_update.json`

## Plugin Runtime Behavior
- Backend opens local SQLite DB read-only and registers IPC handler `cider-edm-popularity:get-score`.
- Frontend extracts Apple Music song id when available; otherwise falls back to title/artist key lookup.
- Frontend caches results to reduce IPC spam.
- Missing DB or no match returns `Score: N/A` safely.

## Daily Update Suggestion
Use `cron` or `launchd` to run `npm run update:db` once daily.

## No Secrets
No tokens or secrets are required for the current MVP pipeline.
