# Product Spec: Cider EDM Popularity Overlay

## Problem Statement
EDM listeners in Cider cannot quickly evaluate a track's current scene momentum while browsing playlists/albums/stations. This slows discovery and curation for DJs and enthusiasts who want a fast popularity proxy at track-row level.

## Goals
- Show a per-track popularity score (0-100) inline in Cider track lists.
- Keep UI impact minimal: compact badge near the track title.
- Provide explainable scoring based on multiple external signals.
- Update data frequently enough to reflect trend changes without high runtime overhead.

## Non-Goals
- Replacing Cider's native ranking/recommendation systems.
- Real-time stream-level analytics inside the plugin runtime.
- Building a cloud service in v1.
- Collecting personal listening data from users.

## Target Users
- EDM fans discovering new tracks.
- DJs building sets/crates.
- Curators comparing track momentum across playlists.

## Data Sources Shortlist
- Beatport charts and category positions.
- 1001Tracklists support (set/play frequency proxies).
- Spotify popularity and playlist presence.
- SoundCloud play/like/repost trends.
- YouTube view/engagement signals for official/audio uploads.
- Shazam chart or rank-style indicators.
- Optional additions later: TikTok usage signals, radio charts, Apple Music chart presence.

## Scoring Approach
- Output: normalized integer score from 0 to 100.
- Build per-source sub-scores using source-specific normalization windows.
- Combine via weighted blend, e.g.:
  - Beatport: 0.30
  - Spotify: 0.20
  - 1001Tracklists: 0.15
  - YouTube: 0.15
  - SoundCloud: 0.10
  - Shazam: 0.10
- Apply recency decay to favor momentum over legacy popularity.
- Add confidence level (optional field) based on source coverage density.

## Update Strategy
- A daily batch job (outside plugin) fetches and reconciles source signals.
- Batch job writes a local artifact consumed by plugin:
  - Option A: JSON file keyed by stable track IDs.
  - Option B: SQLite database for faster lookup/updates.
- Plugin reads local data only at runtime and memoizes lookups.
- Stale-data behavior: show `Score: N/A` when no recent record exists.

## Plugin Runtime Behavior
- On renderer ready, inject frontend script.
- Detect track rows and render badge per row.
- Resolve Apple Music track ID -> local popularity record.
- Update badge text/color based on score bucket (future milestone).

## Privacy Notes
- No user tokens/secrets stored in plugin.
- Prefer offline/local reads in plugin runtime.
- If optional remote updates are introduced later, use explicit opt-in and clear disclosure.
- Avoid collecting personal listening history unless a future feature explicitly requires it.

## Milestones
1. **M0 - Technical Spike**
   - Row detection + `Score: N/A` badge injection via MutationObserver.
2. **M1 - Local Data Integration**
   - Read JSON/SQLite score map locally and display numeric score.
3. **M2 - ID Reconciliation**
   - Improve Apple Music to external-source mapping quality.
4. **M3 - UX Hardening**
   - Better styling, performance tuning, selector resilience across Cider updates.
5. **M4 - Data Pipeline v1**
   - Daily updater + validation reports + confidence metrics.
