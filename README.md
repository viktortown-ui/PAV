# SoapFlow Studio

SoapFlow Studio is a client-only process-flow builder for educational and internal visualization of small liquid soap / surfactant production lines. It provides an editable React Flow canvas, an extensible component registry, deterministic visual simulation, and IndexedDB persistence.

## Features

- RU-first industrial UI with toolbox, canvas, inspector, and simulation controls.
- React Flow editor with custom process nodes, animated edges, minimap, pan/zoom, snap-to-grid, and multi-select.
- Extensible domain registry for water treatment, tanks, pumps, valves, sensors, and finishing equipment.
- Deterministic front-end simulation for active/inactive/blocked flows, animated pipe movement, mixer rotation, and tank fill levels.
- Dexie + IndexedDB project persistence with autosave, manual save, local load, and JSON import/export.
- Seed demo line: raw water → carbon filter → reverse osmosis → clean water tank → pump → reactor → valve → buffer tank → sensor → filling line.
- GitHub Pages-ready Vite config and deployment workflow.

## Stack

- Vite
- React + TypeScript
- React Flow
- Zustand
- Dexie / IndexedDB

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Architecture

```text
src/
  app/                  App shell and bootstrap wiring
  domain/
    registry/           Component registry and seed project
    schemas/            Typed domain models
    simulation/         Deterministic visual simulation engine
  features/
    editor/             Canvas and toolbar
    inspector/          Property editing panel
    persistence/        Dexie database
    simulation/         Simulation controls
    toolbox/            Searchable equipment library
  edges/                Custom animated React Flow edge
  icons/                Industrial SVG iconography
  nodes/                Custom process node renderer
  store/                Zustand application state
  styles/               Global theme and layout
```

## GitHub Pages deployment

This repository is configured for GitHub Pages project deployment under `/PAV/`.

1. Push the repository to GitHub.
2. In repository settings, enable **Pages** and choose **GitHub Actions** as the source.
3. The included workflow installs dependencies, builds the Vite app, and deploys the generated `dist/` folder.

## Notes

- This is **not** an industrial control system and does not implement real chemical engineering logic.
- The simulation is deterministic and intended only for planning, visualization, and educational demos.
