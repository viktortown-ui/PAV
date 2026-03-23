# Codex checklist: add a new equipment type

Use this checklist when implementing any new equipment type in SoapFlow Studio.

> Scope reminder: this is a developer workflow artifact. It must not create any in-app AI experience, AI control, AI button, or AI-generated workflow in the product UI.

## 1. Prepare the specification

- [ ] Fill out `docs/equipment-spec-template.md` for the new equipment.
- [ ] Confirm the equipment fits one of the existing families: vessel, machinery, valve, instrument, topology, or terminal.
- [ ] Confirm the correct visual class: major, line, valve, instrument, topology, or terminal.
- [ ] Decide whether the device is standalone, inline, or topology-anchored.
- [ ] Decide whether it behaves as major equipment, inline equipment, instrumentation, topology, or terminal equipment.
- [ ] Define the Russian visible name, short name, technical prefix, aliases, and search tags.

## 2. Update domain types and registry metadata

- [ ] Add the new `SoapNodeKind` in `src/domain/schemas/types.ts`.
- [ ] Add the registry definition in `src/domain/registry/componentRegistry.ts`.
- [ ] Set family, subtype, subtype label, class name, category, descriptions, aliases, tags, and compatibility hints.
- [ ] Define required defaults for process, visual, runtime, and ports data.
- [ ] Confirm semantic size and icon family are consistent with neighboring equipment.
- [ ] Confirm the equipment appears in the appropriate toolbox/search grouping.

## 3. Define data model and inspector contract

- [ ] List required root fields.
- [ ] List optional root/process/runtime/visual fields.
- [ ] Document default values and inherited context values.
- [ ] Select inspector tabs to enable.
- [ ] Define visible fields for each enabled tab.
- [ ] Define advanced fields and any read-only summary rows.
- [ ] Add validation ranges, enums, and conditional field visibility rules.
- [ ] Confirm that inspector terminology remains RU-first for user-visible labels.

## 4. Implement behavior

- [ ] Add node commands in `src/domain/commands/nodeCommands.ts` if the equipment exposes actions.
- [ ] Extend `src/domain/simulation/engine.ts` if the equipment changes runtime state, flow, alarms, or diagnostics.
- [ ] If inline, verify insert-on-line behavior and handle selection.
- [ ] If topology-related, update handle or routing rules in `src/domain/flow/*` and `src/domain/topology/*`.
- [ ] If the equipment introduces connection restrictions, update validation rules in `src/domain/validation/*`.
- [ ] Explicitly reject unsupported behaviors instead of leaving them implicit.

## 5. Implement visuals

- [ ] Ensure `src/ui/nodes/ProcessNode.tsx` can render the required silhouette, badges, and runtime affordances.
- [ ] Update styling only where needed to preserve the existing visual grammar.
- [ ] Confirm the label, technical tag, and state cues match the current editor patterns.
- [ ] If inline, confirm line insertion looks correct and does not break edge continuity.
- [ ] Avoid introducing any AI-related UI elements.

## 6. Validate persistence and compatibility

- [ ] Confirm the new fields serialize cleanly.
- [ ] Review restore/import/export behavior for the new node kind.
- [ ] Add migration notes if older documents may omit or mis-shape new fields.
- [ ] Confirm save/load works without losing inspector, runtime, or port metadata.

## 7. Add automated tests

- [ ] Creation test: node can be instantiated with the expected defaults.
- [ ] Searchability test: aliases/tags/toolbox search can discover the equipment.
- [ ] Insertion test: standalone or inline insertion behaves correctly.
- [ ] Save/load test: serialization and restoration preserve the node contract.
- [ ] Runtime state test: simulation/commands produce expected runtime state.
- [ ] Validation regression test: legal and illegal connections are enforced.

## 8. Review before merge

- [ ] Compare the new equipment against a similar existing type for consistency.
- [ ] Verify metadata, visuals, behavior, and inspector structure are not ad hoc.
- [ ] Verify the README guidance still matches the real implementation path.
- [ ] Confirm no in-app AI clutter was introduced.
- [ ] Include the filled specification or a link to it in the PR description.
