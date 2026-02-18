# Cider EDM Popularity Plugin

Cider 2.x plugin that decorates track rows with a local popularity score from a SQLite database.

## Project Layout
- `index.js`: backend plugin entry and IPC score lookup.
- `index.frontend.js`: renderer badge injection and cached score requests.
- `scripts/update_db.mjs`: daily-friendly local DB updater.
- `scripts/adapters/*.mjs`: source adapters (sample adapter active, others stubbed).
- `data/sample_seed.json`: keyless seed data used when external sources are not reliable.
- `docs/testing.md`: manual test plan for macOS + Cider 2.x.

## UAT / Non-developer install (recommended)

If you’re helping test this on a different machine and you’re **not** a developer, you should **not** need Node.js or any terminal commands.

### What you’ll need
- Cider 2.x installed
- This plugin folder (download as a ZIP from the repo)
- A prebuilt database file: `edm_popularity.sqlite` (we’ll provide it)

### Downloads (for testers)
- Google Drive folder (public): https://drive.google.com/drive/folders/1Yt3D9qolgf8Et0z-Dr_Ps9Tf9Jec-ej0
- One-file UAT ZIP (plugin + DB): https://drive.google.com/file/d/1TGruV-Wbt2FLz_bLOA4lXdRm3d78NXiA/view
- DB only (`edm_popularity.sqlite`): https://drive.google.com/file/d/1MHg9_vJRcmp2xMBRNdhk7YXRoCG-XrxO/view

### Install steps (no coding)
1) **Download** the plugin ZIP from this repo and unzip it.
2) Open **Cider → Settings → Plugins** and click **Open plugins folder** (wording may vary).
3) Copy the unzipped folder into the plugins folder.
   - You should end up with a folder like: `<Cider plugins folder>/cider_edm_popularity/`
4) Ensure the database file is present at:
   - `<Cider plugins folder>/cider_edm_popularity/data/edm_popularity.sqlite`
5) Back in Cider, **enable** the plugin (or “Reload plugins”).
6) Open any view with a track list (playlist/album/search results) and confirm you see badges like:
   - `Score: 73`
   - If there is no match, it should safely show `Score: N/A`.

### What to report (UAT checklist)
- Does the badge appear reliably?
- Does it update from `N/A` → a number within a second or two?
- Any UI lag when scrolling long lists?
- Any errors in Cider’s DevTools console after enabling?

## Developer setup
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
