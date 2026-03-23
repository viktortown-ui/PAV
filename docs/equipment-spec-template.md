# Equipment specification template

This template standardizes how a new equipment type is introduced into the editor. It is a repository-level developer contract only.

> Guardrail: do **not** add in-app AI, AI buttons, AI panels, or AI-assisted user workflows as part of an equipment implementation.

## Purpose

Use this file before touching the registry, inspector, simulation, or visuals. A completed specification should exist for every new `SoapNodeKind` so that naming, metadata, behavior, validation, and persistence stay aligned with the existing equipment library.

## How to use

1. Copy this file to a new working note or attach the filled sections to the implementation PR.
2. Complete every section before coding.
3. Use the completed spec to drive registry updates, inspector fields, visuals, simulation, and tests.
4. Keep Russian user-facing labels aligned with the existing RU-first UI.

---

## 1. Classification

- **Node kind (`SoapNodeKind`)**:
- **Family (`SymbolFamily`)**: `vessel` | `machinery` | `valve` | `instrument` | `topology` | `terminal`
- **Subtype identifier**:
- **Subtype label (RU)**:
- **Visual class (`EquipmentClass`)**: `major` | `line` | `valve` | `instrument` | `topology` | `terminal`
- **Insertion mode**:
  - `standalone`
  - `inline`
  - `topology-anchor`
- **Equipment placement category**:
  - `major`
  - `inline`
  - `instrumentation`
  - `topology`
  - `terminal`
- **Preferred toolbox/defaults group**:
- **Category label shown in UI**:
- **Placement note for operators/designers**:

## 2. Naming

- **Russian visible name**:
- **Short name**:
- **Technical tag prefix**:
- **Aliases for search**:
  - RU aliases:
  - EN aliases:
  - Legacy/internal aliases:
- **Library tags**:
- **Search metadata**:
- **Description (developer-facing)**:
- **Short RU description**:

## 3. Data model

### 3.1 Required fields

List every field that must exist when the node is created.

| Field | Location | Type | Reason |
| --- | --- | --- | --- |
| `visibleName` | root | `string` | |
| `shortName` | root | `string` | |
| `technicalTag` | root | `string` | |

### 3.2 Optional fields

| Field | Location | Type | Default / fallback | Notes |
| --- | --- | --- | --- | --- |

### 3.3 Defaults

- **Base defaults inherited from registry factory**:
- **Process defaults**:
- **Visual defaults**:
- **Ports defaults**:
- **Runtime defaults**:
- **Status default**:
- **Mode default**:
- **Medium default**:

### 3.4 Inherited context fields

Document values expected to be inherited or inferred from the current editor context.

- **Defaults group inheritance**:
- **Template/project defaults inheritance**:
- **Line medium inheritance**:
- **Naming rule inheritance**:
- **Port/handle inheritance**:
- **Inspector context dependencies**:

## 4. Inspector schema

- **Tabs used**:
  - `main`
  - `process`
  - `ports`
  - `signals`
  - `appearance`
  - `alarms`
  - `simulation`
  - `actions`
- **Visible fields per tab**:
- **Advanced fields**:
- **Read-only summary fields**:
- **Validation rules in inspector**:
  - Required values:
  - Numeric ranges:
  - Enumerations:
  - Conditional visibility:
  - Derived fields:
- **Commands shown on the Actions tab**:

## 5. Runtime behavior

- **Supported states (`EquipmentStatus` / runtime flags)**:
- **Supported commands**:
- **Simulation participation**:
- **Effect on upstream flow**:
- **Effect on downstream flow**:
- **Blocking/starvation/alarm behavior**:
- **Events/diagnostics emitted**:
- **Unsupported runtime behavior explicitly rejected**:

## 6. Visual representation

- **Icon family**:
- **Semantic size class**:
- **Accent/fill defaults**:
- **Badges/state indicators**:
- **Animation requirements**:
- **Label behavior**:
- **Line insertion behavior if inline**:
  - required source handle:
  - required target handle:
  - branch handle rules:
- **Special render affordances in `ProcessNode`**:

## 7. Validation contract

- **Legal connection types**:
- **Illegal connection types**:
- **Direction constraints**:
- **Mixing constraints**:
- **Media group constraints**:
- **Port occupancy rules**:
- **Topology restrictions**:
- **Known validation messages to add/update**:

## 8. Persistence

- **Serialization shape**:
- **Required stable field names**:
- **Migration notes**:
- **Import/export compatibility expectations**:
- **Backwards compatibility risks**:
- **Seed/template implications**:

## 9. Tests required

- **Creation test**:
- **Searchability test**:
- **Insertion test**:
- **Save/load test**:
- **Runtime state test**:
- **Validation regression test**:
- **Any visual/render snapshot or DOM assertion needed**:

## 10. Implementation map

Use this mapping to ensure the finished code lands in the right layer.

| Concern | Typical file(s) to update |
| --- | --- |
| Node kind / schema | `src/domain/schemas/types.ts` |
| Registry metadata / defaults / inspector fields | `src/domain/registry/componentRegistry.ts` |
| Wizard/default naming behavior | `src/features/equipmentWizard/schema.ts` |
| Node commands | `src/domain/commands/nodeCommands.ts` |
| Runtime/simulation | `src/domain/simulation/engine.ts` |
| Topology / inline insertion / handle logic | `src/domain/topology/*`, `src/domain/flow/*` |
| Validation rules | `src/domain/validation/*` |
| Node renderer / visuals | `src/ui/nodes/ProcessNode.tsx`, `src/styles/global.css` |
| Search/toolbox exposure | `src/features/toolbox/*` |
| Persistence/import/export | `src/features/persistence/*`, restore/validation modules |
| Tests | `src/tests/unit/*`, `src/tests/integration/*` |

## 11. Definition of done

A new equipment type is complete only when:

- classification, naming, metadata, defaults, and aliases are fully documented;
- inspector tabs and fields are explicitly defined rather than improvised;
- runtime and validation behavior are specified before release;
- persistence/import/export compatibility is reviewed;
- automated tests cover creation, searchability, insertion, save/load, and runtime state;
- no in-app AI features or AI UI affordances are introduced.
