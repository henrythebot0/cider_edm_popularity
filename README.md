# Cider EDM Popularity Plugin (Scaffold)

Initial scaffold for a Cider V2-style plugin that injects a frontend script and appends a basic `Score: N/A` badge to detected track rows.

## Project Layout
- `package.json`: plugin metadata scaffold.
- `index.js`: backend plugin entry class.
- `index.frontend.js`: renderer-side POC with MutationObserver badge injection.
- `docs/feasibility.md`: feasibility notes and references.
- `docs/product_spec.md`: PM/product spec draft.

## Install in Cider
1. Locate your Cider plugins directory (path can vary by OS/build; check Cider settings/docs for the exact plugins folder).
2. Copy this project folder into that plugins directory.
3. Open Cider and enable/reload the plugin from Cider's plugin management UI.
4. Open a track list view and check DevTools console for:
   - `[cider-edm-popularity] Backend ready`
   - `[cider-edm-popularity] Renderer ready; loading frontend`
   - `[cider-edm-popularity] Frontend plugin loaded`

## Development Notes
- Frontend script uses `MutationObserver` because stable per-row extension hooks may be limited.
- Badge injection is idempotent using `data-edm-popularity-processed` and `data-edm-popularity-badge` attributes.
- Selector list in `index.frontend.js` is intentionally broad for early prototyping and should be tightened against real Cider DOM.
- Current badge value is placeholder `Score: N/A` until local score data integration is added.

## No Secrets
This scaffold intentionally does not include API keys, access tokens, or secret material.
