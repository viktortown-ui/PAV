# Symbol audit and family plan

## Short audit
- The previous library leaned on one repeated visual grammar: rounded rectangles for equipment, the same valve diamond for most shutoff devices, and near-identical circular badges for all instrumentation.
- Major equipment and terminals partially overlapped in silhouette, so vessels, utility drains, consumers, and filling assets could read as the same family at a glance.
- Several inline nodes reused the same box-on-line treatment, which reduced contrast between pumps, filters, mixers, and heat-transfer equipment.
- The drawer already exposed family metadata, but the default compact row did not make insertion context and technical code prominent enough for engineering workflows.
- The registry was extensible, but family expansion still depended too much on per-kind icon exceptions instead of a stronger family grammar.

## Family plan
- **Major equipment**: give each asset a larger chassis, interior process cues, and subtype-only markers inspired by conventional P&ID vessel and package-unit silhouettes.
- **Inline machinery**: keep these centered on the process line, but use mechanically distinct profiles for rotating, dosing, filtering, mixing, and heat-exchange functions.
- **Valves**: keep a shared inline body so they remain recognizable as shutoff devices, then differentiate each subtype with actuator, check, drain, and relief markers.
- **Instrumentation**: use ISA-like instrument bubbles/badges with compact functional glyphs and support stems where appropriate.
- **Topology**: reduce to sparse technical linework only, with direction and mixing intent shown by minimal geometry rather than boxed symbols.
- **Terminals / utilities**: separate service, off-page, sampling, drain, and consumer endpoints into unmistakable endpoint silhouettes.

## Implementation structure
1. Rebuild the icon renderer around family-grade geometry and subtype markers.
2. Extend terminal coverage with service and off-page connector symbols without changing editor core concepts.
3. Improve library rows so each entry shows RU description, family, short code, and best insertion context in the compact view, while the hover panel stays as the richer preview.
4. Tune node chrome so family distinctions remain readable on-canvas, not just in the drawer.
