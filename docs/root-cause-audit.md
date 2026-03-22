# Root-cause audit: editor hangs and canvas drift

## Primary hotspot

The main hang came from a **viewport feedback loop in `CanvasEditor`**:

1. `applyIntentionalViewport(...)` was recreated whenever `project` changed.
2. A `useEffect` depended on `project.view.viewport`, `project.view.metadata`, and `project.id`, so almost any project write could trigger a new viewport apply.
3. `applyIntentionalViewport('curated')` called both `flow.setViewport(...)` and `setViewport(...)` in Zustand.
4. That store write changed `project.view.viewport`, which retriggered the effect and repeated the cycle.
5. A `ResizeObserver` on the shell also called the same viewport routine, so layout changes from side panels or the bottom panel could keep the loop alive.

This produced repeated React Flow viewport writes, visible canvas drift, and enough main-thread churn to make pointer interactions unreliable and eventually trigger browser “Page is unresponsive” warnings.

## Secondary amplification paths

- **Whole-project validation on every write**: `validateProject(project)` ran synchronously on node moves, edge changes, inspector edits, and simulation ticks. That made every interaction pay a full graph traversal cost.
- **Autosave on every project mutation**: the app-level autosave effect subscribed to the entire `project`, so viewport writes and simulation updates also scheduled persistence work.
- **Broad editor subscriptions and derived graph recreation**: the canvas rebuilt node/edge render data on each store change, including selection-only changes, while reading `selectedNodeId` via `useAppStore.getState()` inside render mapping.
- **Layout instability from the shell**: the center column did not enforce `minmax(0, 1fr)` / bounded height, and the bottom simulation panel had a large `min-width`. That made the canvas area more likely to resize repeatedly and re-trigger viewport work.

## What had to change

- Run automatic viewport placement **only once per restored/template load** using an explicit nonce, not on arbitrary project updates.
- Guard viewport writes so unchanged targets do not reapply.
- Debounce validation and keep autosave tied to **meaningful unsaved revisions**, not all project object churn.
- Memoize node/edge view models and narrow canvas subscriptions.
- Stabilize shell geometry so side panels and the bottom status panel do not create repeated resize churn.
