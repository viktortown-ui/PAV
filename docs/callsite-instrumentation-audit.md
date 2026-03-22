# Call-site instrumentation audit

This document inventories every discovered call site for the requested viewport/persistence/validation/routing operations and records the runtime policy now enforced in code.

## Viewport APIs

### `fitView`
- **Call site:** `TopToolbar.onFitView` in `src/features/editor/TopToolbar.tsx`.
- **When it runs:** Only when the user clicks **«Вписать схему»**.
- **Why it runs:** To explicitly reframe the current graph after a user request.
- **Can it run repeatedly?** Yes, but only on repeated clicks.
- **Policy:** Keep **user-triggered only**. Do not auto-run it from reactive effects because its `onMoveEnd` consequence persists a manual viewport.

### `setViewport`
- **Call site 1:** `CanvasEditor.applyViewport('restore' | 'curated')` in `src/features/editor/CanvasEditor.tsx`.
  - **When it runs:** After restore/template/import viewport nonce changes, and after curated resize placement.
  - **Why it runs:** To replay a restored viewport or apply the template metadata viewport.
  - **Can it run repeatedly?** Yes.
  - **Policy:** Restores are fine; curated resize placement must stay **throttled/debounced** and guarded against unchanged targets.
- **Call site 2:** `useAppStore.setViewport` in `src/store/useAppStore.ts`.
  - **When it runs:** After `onMoveEnd` for manual gestures or after curated viewport syncing.
  - **Why it runs:** To persist the latest viewport in project state.
  - **Can it run repeatedly?** Yes.
  - **Policy:** Manual writes may repeat naturally; programmatic writes must stay **guarded/throttled** so they do not echo back into the canvas.

### `setCenter`
- **Call sites discovered:** None.
- **Policy:** Leave unused. If introduced later, it should be wrapped with the same instrumentation and no-op guards as `setViewport`.

### `zoomTo`
- **Call sites discovered:** None.
- **Policy:** Leave unused. If introduced later, keep it **user-triggered** unless there is a tightly bounded accessibility or onboarding flow.

## Persistence / restore

### `autosave`
- **Call site 1:** `App` autosave effect in `src/app/App.tsx`, which calls `saveProject('autosave')` after a 1200 ms timeout.
  - **When it runs:** When `projectRevision !== persistedRevision` and startup is ready.
  - **Why it runs:** To persist meaningful unsaved revisions without blocking edits.
  - **Can it run repeatedly?** Yes.
  - **Policy:** Must remain **throttled/debounced**.
- **Call site 2:** `useAppStore.saveProject('manual')` from the toolbar button in `src/features/editor/TopToolbar.tsx`.
  - **When it runs:** User presses **«Сохранить»**.
  - **Why it runs:** To force immediate persistence.
  - **Can it run repeatedly?** Yes.
  - **Policy:** **User-triggered only**.

### `project restore`
- **Call site 1:** `useAppStore.loadProject` in `src/store/useAppStore.ts`.
  - **When it runs:** On startup and when the user opens a project.
  - **Why it runs:** To read IndexedDB state or fall back to a safe demo project.
  - **Can it run repeatedly?** Yes, but usually infrequent.
  - **Policy:** No throttle required; keep it event-driven.
- **Call site 2:** `useAppStore.importProject` in `src/store/useAppStore.ts`.
  - **When it runs:** User imports JSON.
  - **Why it runs:** To restore external project state.
  - **Can it run repeatedly?** Yes.
  - **Policy:** **User-triggered only**.
- **Call site 3:** `restoreProjectDocument` in `src/domain/validation/validateProject.ts`.
  - **When it runs:** Whenever persisted/imported JSON is normalized.
  - **Why it runs:** To sanitize untrusted project payloads.
  - **Can it run repeatedly?** Yes.
  - **Policy:** No throttle required, but keep it off hot animation paths.

## Validation / route work

### `graph validation`
- **Call site 1:** `sanitizeProjectState(...)` in `src/store/useAppStore.ts` initializes issues synchronously.
  - **When it runs:** During project boot/load/reset/template replacement.
  - **Why it runs:** To ensure the issue list matches the newly loaded graph immediately.
  - **Can it run repeatedly?** Yes, but only around whole-project replacement.
  - **Policy:** Fine as-is; not on every small interaction.
- **Call site 2:** `scheduleValidation` in `src/store/useAppStore.ts`.
  - **When it runs:** After graph-mutating edits that replace the project object.
  - **Why it runs:** To debounce whole-graph validation after edits.
  - **Can it run repeatedly?** Yes.
  - **Policy:** Must stay **throttled/debounced**.
- **Call site 3:** `runValidation` in `src/store/useAppStore.ts`.
  - **When it runs:** User presses **«Проверить»**.
  - **Why it runs:** To force an immediate validation pass.
  - **Can it run repeatedly?** Yes.
  - **Policy:** **User-triggered only**.
- **Call site 4:** `validateProject` in `src/domain/validation/validateProject.ts`.
  - **When it runs:** As the shared implementation behind the above callers.
  - **Why it runs:** To traverse the graph and emit issues.
  - **Can it run repeatedly?** Yes.
  - **Policy:** Must be called through the debounced/manual entry points above for hot paths.

### `route recomputation`
- **Call site 1:** `computePathSelection` in `src/store/useAppStore.ts`.
  - **When it runs:** On node/edge selection changes.
  - **Why it runs:** To recompute upstream/downstream highlight paths.
  - **Can it run repeatedly?** Yes.
  - **Policy:** Keep **memoized / narrowly triggered** by selection only.
- **Call site 2:** `runSimulationStep` in `src/domain/simulation/engine.ts`.
  - **When it runs:** Every animation frame while simulation is running.
  - **Why it runs:** To recompute route state, blockage, and flow propagation.
  - **Can it run repeatedly?** Yes, continuously.
  - **Policy:** Must stay **throttled by the simulation loop** and never be coupled to viewport changes.

## Removed feedback loop

The remaining accidental loop risk was the curated viewport sync writing back into project state even after React Flow had already reached the requested viewport. `CanvasEditor.applyViewport(...)` now performs a second equality guard before calling `setViewportState(...)`, so programmatic viewport application no longer echoes unchanged state back into Zustand during resize/restore sequences.
