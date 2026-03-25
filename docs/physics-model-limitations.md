# Physics core: model boundaries and limitations

## What is currently modeled

- Incompressible steady-state flow for simple hydraulic chains (no branching solver yet).
- Pipe velocity and losses via Darcy–Weisbach + local resistance (`K`).
- Pump head curve approximation as a function of flow.
- Valve throttling through an equivalent `Kv` model.
- Tank inventory dynamics via mass balance: `dV/dt = Qin - Qout + Qboundary`.
- Basic consistency and sanity checks with warnings for suspicious states.

## What is explicitly not modeled yet

- Full network solving for branched/meshed topologies.
- Real cavitation / NPSH calculations (currently only placeholder warning).
- Two-phase effects, dissolved gas, vapor lock, thermal effects.
- Non-Newtonian rheology and temperature-dependent viscosity in transient loop.
- Detailed control loops and actuator dynamics.
- Water hammer and other fast transient hydraulic phenomena.

## Simplifications and caveats

- Flow direction is primarily forward in current use-cases; reverse flow is limited by edge type rules.
- Unrealistic velocity detection is threshold-based and is intended as an operator warning, not as a hard solver failure.
- Tank level is derived from volume and cross-section area (uniform geometry assumption).
- UI visibility state (`hidden`) must not influence physics; simulation uses topology/process data only.
