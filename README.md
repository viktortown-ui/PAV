# SoapFlow Studio

SoapFlow Studio is a client-only process-flow builder for educational and internal visualization of small liquid soap / surfactant production lines. It provides an editable React Flow canvas, an extensible component registry, deterministic visual simulation, and IndexedDB persistence.

## Short architecture audit

Before this refactor, the application already had strong domain concepts, but several responsibilities were still concentrated in the Zustand store and a few feature components:

- domain simulation, persistence, topology editing, and command orchestration were partially coupled inside `useAppStore`
- edge editing flows were reusable in the UI, but the actual topology mutations were not isolated as a dedicated domain service
- inspector edge forms were functional, but they were not backed by an explicit typed schema object
- renderer placement (`nodes/`, `edges/`, and visual tokens) was less clearly separated from domain logic
- the repo had only runtime validation, not a dedicated integrity-focused automated test suite

This phase formalizes those boundaries so future equipment, topology nodes, persistence versions, and simulation rules can evolve with less coupling.

## Features

- RU-first industrial UI with toolbox, canvas, inspector, simulation controls, and development diagnostics.
- React Flow editor with custom process nodes, animated edges, minimap, pan/zoom, snap-to-grid, and multi-select.
- Extensible domain registry for water treatment, tanks, pumps, valves, sensors, and finishing equipment.
- Deterministic front-end simulation for active/inactive/blocked flows, animated pipe movement, mixer rotation, and tank fill levels.
- Dexie + IndexedDB project persistence with autosave, manual save, local load, and JSON import/export.
- Seed demo line: raw water → carbon filter → reverse osmosis → clean water tank → pump → reactor → valve → buffer tank → sensor → filling line.

## Stack

- Vite
- React + TypeScript
- React Flow
- Zustand
- Dexie / IndexedDB
- Vitest

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Tests

```bash
npm test
npm run lint
```

## Architecture overview

The repository is now organized around explicit layers:

- `app/` bootstraps the shell and provider wiring.
- `domain/` owns entities, commands, simulation, topology mutations, validation, schemas, templates, and registry metadata.
- `features/` owns user-facing workflows such as the editor, inspector, persistence, simulation controls, and diagnostics.
- `ui/` owns presentational React Flow renderers and visual tokens.
- `store/` coordinates application state, delegating business mutations to domain services.
- `tests/` verifies domain rules and cross-layer integrity paths.

### Current folder structure

```text
src/
  app/
    App.tsx
  domain/
    commands/           Reusable equipment commands
    entities/           Project factories and builders
    flow/               Handle topology normalization
    registry/           Equipment metadata and inspector fields
    schemas/            Typed domain models
    simulation/         Deterministic simulation engine
    templates/          Seed templates and demo project
    topology/           Insert/branch/reconnect/remove edge mutations
    validation/         Restore + validate rules
  features/
    devtools/           Internal diagnostics panel
    editor/             Canvas shell and toolbar
    inspector/          Typed inspector schemas + panel
    persistence/        Dexie persistence/version safety
    simulation/         Simulation controls
    toolbox/            Equipment library
  store/
    selectors/          Derived diagnostics selectors
    useAppStore.ts      Application orchestration only
  ui/
    edges/              Flow edge rendering
    nodes/              Process node rendering
    tokens/             Visual palettes and route tokens
  tests/
    unit/
    integration/
```

## State flow

1. UI components emit user intent only.
2. `useAppStore` receives the event and selects the appropriate domain service.
3. Domain command/topology/validation modules produce the next `ProjectDocument`.
4. The store validates and publishes state.
5. UI renderers consume the normalized state and render visuals without embedding business rules.

## Simulation flow

1. Equipment commands update the domain model.
2. `tickSimulation` calls `domain/simulation/engine.ts`.
3. The simulation engine computes node runtime state, edge route state, warnings, and events.
4. UI node and edge renderers translate those state fields into badges, motion, color, and line effects.

## Persistence and versioning

- IndexedDB persistence is isolated in `features/persistence/db.ts`.
- Persistence compatibility is checked through a dedicated `isStoredProjectCompatible` guard.
- Invalid persistence versions trigger a safe reset path instead of a risky partial load.
- JSON import/export still flows through `restoreProjectDocument`, ensuring schema sanitization and handle normalization.

## Integrity verification covered by tests

The test suite verifies that:

- inspector/domain-style commands update the domain model
- insert-on-line preserves source/target relations
- branch insertion preserves handle fidelity
- import/export preserves topology refs and handles
- duplicate handle usage is rejected by validation
- persistence version mismatch is treated as incompatible
- simulation ticks drive visual state payloads for nodes and edges

## How to add a new equipment type

Future equipment should be added through a documented contract, not by inventing structure ad hoc. Before implementing a new type, fill out `docs/equipment-spec-template.md` and use `docs/equipment-implementation-checklist.md` as the delivery checklist. These files standardize classification, naming, data model, inspector tabs, runtime behavior, visuals, validation, persistence, and tests.

### Required workflow

1. Fill out the reusable equipment specification in `docs/equipment-spec-template.md`.
2. Add the new `SoapNodeKind` in `src/domain/schemas/types.ts`.
3. Register the definition, defaults, aliases, search metadata, and inspector fields in `src/domain/registry/componentRegistry.ts`.
4. If the equipment has business commands, add them in `src/domain/commands/nodeCommands.ts`.
5. If it affects runtime behavior or flow, extend `src/domain/simulation/engine.ts`.
6. If it is inline or topology-sensitive, update the relevant handle/topology/validation modules in `src/domain/flow`, `src/domain/topology`, and `src/domain/validation`.
7. Ensure `ProcessNode` and related styles provide the required visual affordances in `src/ui/nodes/ProcessNode.tsx` and `src/styles/global.css`.
8. Add or update tests in `src/tests/unit` and `src/tests/integration` for creation, searchability, insertion, save/load, and runtime behavior.

### Required equipment contract

Every new equipment type should explicitly define:

- classification: family, subtype, visual class, insertion mode, and placement category;
- naming: Russian visible name, short name, technical prefix, aliases, and search tags;
- data model: required fields, optional fields, defaults, and inherited context;
- inspector schema: tabs, visible fields, advanced fields, and validation rules;
- runtime behavior: supported states, commands, and flow/simulation effects;
- visuals: icon family, size class, badges, and inline insertion behavior;
- validation: legal/illegal connections, direction rules, and mixing constraints;
- persistence: serialization shape, migration notes, and import/export compatibility;
- tests: creation, searchability, insertion, save/load, and runtime-state coverage.

### Guardrails

- Preserve the existing RU-first industrial UI conventions.
- Keep the implementation developer-facing; do **not** add in-app AI, AI buttons, or AI workflows.
- Prefer consistency with neighboring equipment families over one-off exceptions.

## How to add a new inline device

1. Create the equipment definition with `ports.inline = true` in the component registry.
2. Add an insert action mapping in the edge UI or reusable edge action lists.
3. Confirm `insertNodeIntoEdge` can use the default source/target handles for the new device.
4. Add an integration test for insert-on-line behavior and handle preservation.

## How to add a new topology node

1. Add the new node kind to the schema types.
2. Register handle behavior in `src/domain/flow/handles.ts` if it needs custom ports.
3. Register defaults and inspector fields in the component registry.
4. Extend `src/domain/topology/edgeOperations.ts` or validation rules if the node changes branching/merging semantics.
5. Add regression tests for `sourceHandle` / `targetHandle` correctness.

## Notes

- This is **not** an industrial control system and does not implement real chemical engineering logic.
- The simulation is deterministic and intended only for planning, visualization, and educational demos.
