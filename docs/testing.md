# Manual Test Plan (macOS + Cider 2.x)

## Prerequisites
- macOS with Cider 2.x installed.
- Node.js 18+.
- Plugin source available in Cider plugins directory.

## 1. Install dependencies
Run:
```bash
make install
```

Expected:
- `node_modules/` created.
- No install errors for `better-sqlite3`.

## 2. Build/update local SQLite DB
Run:
```bash
make update-db
```

Expected:
- `data/edm_popularity.sqlite` created.
- `data/last_update.json` created with current timestamp and table counts.
- Console prints `[update-db] done ...`.

Quick Apple RSS-only run (faster sanity check):
```bash
npm run update:db:quick
```

Expected:
- Source run includes `apple_music_rss`.
- `tracks_seen` is typically up to ~800 raw chart rows (4 countries x 2 charts x 100).
- Due to overlap/dedupe, net new `tracks` should still grow by hundreds on a fresh DB.

## 3. Validate DB contents (optional)
Run:
```bash
sqlite3 data/edm_popularity.sqlite "select count(*) from tracks;"
sqlite3 data/edm_popularity.sqlite "select t.title, t.artist, s.score from tracks t join scores s on s.track_id=t.id order by s.score desc limit 5;"
```

Expected:
- Non-zero track count.
- Scores shown in 0-100 range.

## 4. Load plugin in Cider
- Copy/link plugin folder into Cider's plugin directory if not already present.
- In Cider plugin settings, enable/reload this plugin.
- Open DevTools console.

Expected backend logs:
- `[cider-edm-popularity] Backend ready`
- `[cider-edm-popularity] SQLite opened: ...` (or warning if DB is missing)
- `[cider-edm-popularity] Renderer ready; loading frontend`

Expected renderer log:
- `[cider-edm-popularity] Frontend plugin loaded`

## 5. Verify score badges
- Open a list with visible track rows.
- Confirm badges appear near titles.

Expected:
- Badge text initially `Score: N/A`, then updates to `Score: <n>` where matches exist.
- If DB is missing or no match exists, badge stays `Score: N/A`.

## 6. Validate fallback keying
- Test with tracks that likely do not include a direct Apple song id in DOM.

Expected:
- Frontend falls back to title/artist key lookup via IPC.
- No renderer crashes/errors if metadata is incomplete.

## 7. Basic performance sanity
- Scroll long track lists quickly.

Expected:
- No noticeable UI freeze from repeated IPC calls.
- Badge updates remain stable due to frontend cache.

## 8. Regression check
Run:
```bash
make lint
```

Expected:
- Syntax checks pass for backend, frontend, and updater script.
