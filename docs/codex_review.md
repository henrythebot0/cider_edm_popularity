# Cider EDM Popularity: UAT/Quality/Safety Review

## Scope
- Reviewed: `index.js`, `index.frontend.js`, `scripts/update_db.mjs`, `scripts/adapters/*`.
- Focus: UAT readiness, code quality, safety, and performance in Cider plugin runtime.

## Readiness Summary
- Status: **Conditional UAT-ready**.
- Core flow (DB build -> IPC lookup -> badge render) is coherent and works with graceful fallback.
- Main gaps are performance/scalability and operational hardening rather than critical correctness defects.

## Findings (Prioritized)

### P1 - High
1. `scripts/update_db.mjs:87` used foreign keys but did not enable SQLite FK enforcement.
- Risk: `ON DELETE CASCADE` rules are silently ignored in SQLite by default, allowing orphaned rows and drift.
- Fix: Enable `PRAGMA foreign_keys = ON;` during schema/init.
- Status: **Fixed**.

### P2 - Medium
1. `index.frontend.js:199` triggered full-page row scans on every mutation.
- Risk: repeated `querySelectorAll` across subtree can cause avoidable UI overhead in dynamic Cider lists.
- Fix: Schedule scan once per animation frame and collapse mutation bursts.
- Status: **Fixed**.

2. `index.frontend.js:177` used one-time row marker, preventing re-evaluation when row metadata changes after initial render.
- Risk: badges can remain stale (`N/A`) for lazy-hydrated rows.
- Fix: Track a lightweight row signature (song id + normalized key) and only skip unchanged rows.
- Status: **Fixed**.

3. `scripts/update_db.mjs:149` closed DB only on success path.
- Risk: on thrown errors, file handles/locks can leak until process exit.
- Fix: Wrap DB lifecycle in `try/finally` and always close.
- Status: **Fixed**.

### P3 - Low
1. `scripts/update_db.mjs:346` recomputes scores by scanning all observations each run.
- Risk: runtime will grow with DB size; this will become a bottleneck as history accumulates.
- Recommended next fix: compute only changed tracks or maintain rolling aggregates/materialized latest metrics.
- Status: **Not changed** (non-trivial behavior/perf refactor).

2. `scripts/adapters/beatport.mjs` and `scripts/adapters/apple_music_rss.mjs` run sequential network fetches.
- Risk: longer update windows and partial staleness if long jobs fail mid-run.
- Recommended next fix: bounded concurrency (e.g., 2-4 workers) with backoff and per-source summary metrics.
- Status: **Not changed** (behavioral/runtime change).

## Implemented Low-Risk Fixes
- `scripts/update_db.mjs`
  - Added `PRAGMA foreign_keys = ON`.
  - Added guaranteed DB close via `try/finally`.
- `index.frontend.js`
  - Added frame-scheduled badge scan to reduce mutation thrash.
  - Replaced one-time row processed marker with signature-based refresh.
  - Tightened title cleanup regex to remove only plugin badge suffix variants.
- Added minimal automated smoke test:
  - `scripts/smoke_test.mjs` creates temp SQLite DB, validates queryability, wires mock IPC, and asserts IPC contract responses.
  - Wired script in `package.json` as `npm run test:smoke`.

## Suggested Next Steps for UAT
1. Add one integration run in CI: `npm run lint && npm run test:smoke`.
2. Add update-job guardrails (max duration, adapter timeouts surfaced in final summary).
3. Decide retention strategy for `observations` growth before wider UAT.
