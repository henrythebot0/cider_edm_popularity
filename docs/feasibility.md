# Feasibility: Per-Track Popularity Score in Cider

## Summary
It is feasible to build a Cider plugin that displays a per-track popularity score beside tracks, with caveats around UI integration depth.

Cider plugins can run backend JavaScript and inject frontend JavaScript into the renderer. In practice, this allows:
- Loading frontend code via the plugin lifecycle.
- Accessing/using MusicKit JS context available in Cider's renderer environment.
- Modifying UI presentation by selecting DOM nodes, injecting elements, and applying CSS.

## Why This Is Feasible
- **Frontend injection path exists**: Cider plugin runtime supports loading frontend JS into the renderer, so we can attach UI behavior without modifying Cider core.
- **MusicKit JS availability**: Cider operates on Apple Music/MusicKit primitives, so plugin logic can potentially read track metadata identifiers used to map into external popularity datasets.
- **Client-side augmentation pattern**: Adding a small badge-like score next to track rows is a common DOM augmentation use case and can be prototyped quickly.

## Constraints and Unknowns
- **Track row hook stability**: Official, stable UI extension hooks for every track-list row may be limited or absent depending on Cider build/version.
- **Potential need for DOM observation**: If direct row-render callbacks are unavailable, the plugin will likely need a `MutationObserver` to detect row mount/update events.
- **Selector fragility**: DOM class names/structure can change between Cider releases, so selectors may require maintenance.
- **Performance considerations**: Observer + repeated scans must be throttled/idempotent to avoid UI jank on large lists.
- **Data mapping gap**: External popularity source IDs may not map cleanly to Apple Music track IDs; a reconciliation strategy is required.

## Recommended Technical Direction
1. Start with a renderer-side proof of concept that:
   - Detects candidate track rows.
   - Appends a small score badge (`Score: N/A`) once per row.
   - Uses a `data-*` marker for idempotency.
2. Add CSS injection for consistent badge styling.
3. Introduce score lookup using local cache (JSON/SQLite-backed feed).
4. Harden selectors and row detection against common UI variants.

## Key References
- Cider legacy plugin docs: https://github.com/ciderapp/Cider/wiki/Plugins
- Cider PluginKit repository: https://github.com/ciderapp/PluginKit
