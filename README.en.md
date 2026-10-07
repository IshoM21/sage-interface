# Sage Interface

[Español](README.md) | **English**

A procedural, real-time visual interface for coding agents (Codex CLI, Claude Code, …), conceptually inspired by the visual language of "Great Sage / Raphael": a **magic circle that writes itself** in the void, **kanji typographic cards**, a formal **voice** («Notice.», «Answer.», «Understood.»), a hyperspace tunnel, armillary bands and overflowing light. Everything is procedural and original: the script in the rings is an invented alphabet, and no assets, emblems or names from the anime are used.

Current status: **visual POC (v2, Three.js)**. The eight states, transitions, AUTO DEMO, milestone ceremony, retry beat, metrics, bloom and GLSL shaders are implemented. Real agent integration is prepared (event model, Tauri bridge, PTY skeleton) but not connected.

### Visual language

| State | Scene | Card |
|---|---|---|
| READY | only the **seed**: a thin double square tilted in the void | 待機 Standing by |
| LISTENING | the seed unfolds, light flows inward, the bands wake | 聴取 Listening |
| ANALYZING | tunnel with panels, armillary bands on every axis, full seal and script ring | 解析 Analyzing |
| EXECUTING | faster travel, bands in mechanical steps, module sigils (READ…TEST) | 実行 Executing |
| QUESTION | everything stops; the seal turns to face you | 問 Question |
| COMPLETE | convergence, bands aligned in one plane, flash, blue rain of light | 了 Understood |
| WARNING | amber pulses that transform the scene in stages, wobbling bands | 警告 Warning |
| CRITICAL | inversion to paper and red, datamosh, fragmentation, ejected light | 失敗 Failed |
| retry | «Failed. Repeating attempt.»: inversion and the frame repeated in a grid | 再度実行 |
| milestone | gold ceremony: ornate script ring, dodecagon, rays | 獲得 Ultimate skill |

---

## Stack

| Layer | Technology | Role |
|---|---|---|
| Native shell | **Tauri 2 + Rust** | window, commands, semantic events; PTY in the future |
| UI | **React 19 + TypeScript + Vite** | panels, text, controls. **Never** renders frames |
| State | **XState v5 + @xstate/react** | parallel state machine (agent + ceremonies) |
| Rendering | **Three.js (WebGL2) + EffectComposer** | real 3D scene, Line2, instancing, UnrealBloom |
| UI motion | **Motion for React** | cards, voice, panels and overlays |
| Shaders | **GLSL** (ShaderMaterial / ShaderPass) | nebula, tunnel, rain, panels, points, script ring, composite |
| Typography | Hiragino Mincho (macOS system) + Baskerville | serif kanji and voice; no external fonts |

v1 used PixiJS (2D/2.5D). It was migrated to Three.js because the reference relies on **real depth** (tunnel, tilted bands) and **light** (HDR bloom), which is exactly what Three.js + postprocessing do well.

## Running

```bash
npm install
npm run app:dev        # Tauri app with hot reload (opens the macOS window)
npm run dev            # frontend only at http://localhost:1420 (browser)
npm run app:build      # release bundle → src-tauri/target/release/bundle/macos/Sage Interface.app
```

Verification:

```bash
npm run typecheck      # tsc -b
npm run lint           # eslint
npm test               # vitest (state machine)
npm run build          # production web build
cd src-tauri && cargo test   # AgentEvent serialization in Rust
```

### Controls

| Key | Action |
|---|---|
| `1`–`8` | READY · LISTENING · ANALYZING · EXECUTING · QUESTION · COMPLETE · WARNING · CRITICAL |
| `4` repeated | cycles the active module (READ → WRITE → EXEC → BUILD → TEST) |
| `A` | AUTO DEMO (READY 2s → LISTENING 2s → ANALYZING 5s → EXECUTING 4s → COMPLETE → READY) |
| `T` | FULL TOUR (includes QUESTION, WARNING and MILESTONE) |
| `M` | MILESTONE / SKILL ACQUIRED |
| `R` | retry beat (`agent.retry`) |
| `Enter` / `Esc` | ACCEPT / REJECT in QUESTION |
| `D` / `C` / `H` | debug / controls / hide the whole UI |
| `Q` | cycles quality LOW → MEDIUM → HIGH → ULTRA |
| `F` | fullscreen |

---

## Architecture

```
React (UI, 0 renders per frame)
 ├── SageActor (XState)  ← AgentEvents ←  AgentBridge ─┬─ MockAgentBridge (scripts)
 │        │                                             └─ TauriAgentBridge ← Rust `sage://agent-event`
 │        │ actor.subscribe (no React state)
 │        ▼
 └── VisualEngine (Three.js, own setAnimationLoop)
       ├── ParamController   — per-state targets, per-parameter easing
       ├── PaletteField      — color = f(role, radius); color wave from the core
       ├── TransitionController — choreography, inversion, datamosh, retry grid, gold ceremony
       ├── ShaderManager     — assembles GLSL (chunks) and declares uniforms
       ├── Composer: RenderPass → UnrealBloom (reduced resolution) → SageComposite → OutputPass
       └── Systems: Background (nebula + stars) · Tunnel (lines + panels) · Rain · Seal (seed,
                    circles, rhombus, script ring) · Modules · Armillary · Shockwaves · Milestone
                    · Core (light, star, streak) · Motes (CPU) · Flares (prismatic halos)
```

```
src/
  app/            App.tsx, styles, state catalog (UI copy), fullscreen
  machine/        events.ts (AgentEvent), sageMachine.ts, selectors.ts, tests
  agent/          AgentBridge, MockAgentBridge, TauriAgentBridge, scenarios
  hooks/          sageActor, useVisualEngine, useAgentBridges, useKeyboardControls
  components/     SageOverlay (kanji cards, voice, status, QUESTION), MilestoneOverlay, StateControls, DebugPanel
  visual/
    VisualEngine.ts
    core/         params, PaletteField, TransitionController, CameraDirector, Metrics, math, textures, glyphs, lines, types
    systems/      one file per visual system
    states/       one file per state (pure data) + index
    shaders/      nebula, streak, panel, points, script, composite (.vert/.frag), noise.glsl, ShaderManager.ts
    config/       palettes (incl. GOLD), quality, visualConfig (world layout)
src-tauri/src/
  lib.rs          builder + handlers
  agent/          AgentEvent (serde, mirror of TS) + emit()
  commands/       app_info, emit_agent_event, run_mock_sequence, pty_spawn (stub)
  pty/            PTY design: PtyRegistry, PtyChunk (Channel), AgentAdapter trait
```

### Structural decisions

- **Only `VisualEngine`** (no separate `SageRenderer`): one class owns the renderer and the composer.
- **`SealSystem`** holds the construction narrative: seed → circle → rhombus → inner circle → vertex rings → script ring. Each stroke is "written" by limiting the instanced segments of a `Line2` (zero per-frame cost).
- **`ArmillarySystem`**: 3D ribbons (textured open cylinders) on their own axes; `armAlign` swings them into a front-facing plane (resolution = symmetry).
- **A single composite pass** after bloom (wave refraction, datamosh, aberration, inversion, retry grid, flash, grain, vignette) instead of chaining filters.
- **Parallel machine.** `agent` region (8 states) + `overlay` region (milestone). `agent.retry` only increments a counter (no state change).
- **States as data.** `visual/states/*.ts` declare parameters, palette and color waves; they contain no logic.
- **`CameraDirector`** (`core/CameraDirector.ts`): the camera is the sum of a per-state baseline (`camDolly`, `camOrbit`, `camSway`, `camShake`), short *moves* fired by transitions (push-ins, pull-backs, roll snaps, FOV punches, shakes) and pointer parallax. Systems never move the camera.
- **Editing rhythm:** `TransitionController.flashCut()` produces 1–2 frame cuts of solid light (composite `uCut`), counted in frames, not time.
- **Failure frames** (`SageOverlay` → `FailureFrame`): in CRITICAL and on retries, giant kanji flank the center (失 | Failed | 敗, 再度 | Repeating attempt | 実行) with the word «FAILURE»/«RETRY» bleeding off the top and mirrored at the bottom.
- **Simulated depth of field:** tunnel panels and lines defocus with their distance to the focal plane (mip bias + widening in the shader), with no extra post pass.
- **Text lives in React** (kanji cards, voice): crisp at any scale and animated with Motion; the canvas only draws light and geometry.

### How a transition works

1. The machine changes state → `useVisualEngine` calls `engine.setState()` (direct subscription, no React).
2. `TransitionController.enter(from, to)`:
   - sets the **targets** of ~45 continuous parameters (tunnel speed, seal unfolding, bands, convergence, fragmentation, inversion…); each one is interpolated at its own rate → nothing changes abruptly;
   - launches the **palette wave**: elements recolor by radius as the wave reaches them (WARNING uses 3 legs: each amber pulse transforms more segments);
   - schedules **cues** (flash, shockwaves, temporary overrides) and **camera moves / cuts**. E.g. COMPLETE: the tunnel decelerates → light converges → the bands align in one plane → flash → radial wave → rain of light → (UI) the 了 card at 1.25 s, synchronized with the machine's `complete.resolved` substate.

---

## Adding a new state

1. `src/machine/events.ts`: add the name to `SageState`/`SAGE_STATES` and, if needed, a new `AgentEvent`.
2. `src/machine/sageMachine.ts`: add the state under `agent.states` and the transition in `agent.on`. Map the key in `selectors.ts` (`MAP`).
3. `src/visual/config/palettes.ts`: add its `Palette`.
4. Create `src/visual/states/myStateVisual.ts` (copy an existing one: `params`, `rates`, `wave`) and register it in `states/index.ts`.
5. (Optional) entry choreography in `TransitionController.enter`.
6. UI: kanji, voice line and copy in `app/stateCatalog.ts`; CSS color in `app.css` (`.app[data-state=…]`).

TypeScript will flag every incomplete `Record<SageState, …>`.

## Adding a visual system

1. Create `src/visual/systems/MySystem.ts` implementing `VisualSystem` (`core/types.ts`): `update(ctx)` is required; `resize`, `setQuality`, `onStateChange`, `stats`, `destroy` are optional.
2. Hot-path rules: **no allocation in `update`** (preallocated pools, typed arrays, shader-side animation when possible), read only `ctx.params`, color with `ctx.palette.at(ROLE.x, radius)` (radius in world units), use `ctx.rng` instead of `Math.random()`.
3. Glowing materials: additive, `depthWrite: false`, ordered with `renderOrder`. Thick lines via `core/lines.ts` (`makeLine` / `setProgress`).
4. If it needs a new parameter, add it to `VisualParams` + `BASE_PARAMS` (`core/params.ts`) and give it values in the states.
5. Instantiate it in `VisualEngine.init()` (adding it to `ctx.scene`, the seal group or the camera) and append it to `this.systems`.

## Sending an AgentEvent

From the frontend:

```ts
mock.emit({ type: "tool.started", tool: "cargo build" });   // MockAgentBridge
actor.send({ type: "agent.warning", message: "CONTEXT 87%" }); // straight to the machine
```

From Rust (what real adapters will do):

```rust
agent::emit(&app_handle, &AgentEvent::ToolStarted { tool: "npm test".into() })?;
```

The event travels as `sage://agent-event` → `TauriAgentBridge` → machine → engine. In the Tauri app the panel shows **NATIVE BRIDGE (RUST)**: *ECHO EVENT* round-trips through Rust and *RUST SEQUENCE* emits a sequence from a native thread.

`tool.started` maps arbitrary tool names onto the five visual modules with `toolToModule()` (`events.ts`). `agent.retry` (optional `attempt`) triggers the retry beat without changing state.

## Graphics quality

`src/visual/config/quality.ts` defines LOW / MEDIUM / HIGH (default) / ULTRA. Each level controls: max DPR, CPU motes, bursts, stars, tunnel lines, panels, rain, bloom (on/off and internal resolution), composer MSAA, nebula octaves and prismatic halos.

- At runtime: DEBUG panel buttons, the `Q` key or `engine.setQuality("MEDIUM")`.
- **ADAPTIVE QUALITY** (optional): steps down one level if the average frame exceeds 21 ms for 3 consecutive seconds. Never steps up automatically.
- Changing quality rebuilds the pools and the composer (MSAA included) without recreating the renderer.

## Adding a shader

1. Write `src/visual/shaders/my.vert` / `my.frag` (`ShaderMaterial` GLSL: Three injects `projectionMatrix`, `modelViewMatrix`, `position`, `uv`).
2. In `ShaderManager.ts`, create a factory that returns a `ShaderMaterial` (or a `ShaderPass` definition for post-processing). Use `withNoise()` if you need `fbm`/`hash12`.
3. For many elements: `InstancedBufferGeometry` + per-instance attributes, animated in the vertex shader from one accumulated scalar (like `TunnelSystem`).
4. Write uniforms from a system in `update()`.

WebGPU would require porting to TSL / `WebGPURenderer`; `WebGLRenderer` is used today.

---

## Performance decisions

- **React out of the loop.** The engine subscribes to the XState actor directly; React only re-renders on state changes and the metrics panel polls at 4 Hz.
- **Geometry built once.** Seal, bands, rays and script rings are created at startup; progressive "writing" limits the number of instanced segments.
- **GPU animation.** Tunnel, panels, rain and stars (thousands of instances) move in the vertex shader from a single scalar; O(1) CPU cost.
- **Motes and bursts** in `Points` with `Float32Array` and `DynamicDrawUsage`; fixed pools, no per-frame objects.
- **Bloom at reduced resolution** (0.35–0.7× depending on quality) on a `HalfFloat` render target; then a single composite.
- **Inversion, datamosh and aberration** only in bursts (transitions, retries, CRITICAL), never as a permanent filter.
- **Palette LUT** (32 buckets × 7 roles per frame), **clamped dt**, **own PRNG**, `setAnimationLoop` stopped while the window is hidden, DPR bounded by quality.
- **Procedural textures** (glows, star, prismatic halo, panels, ribbons, script rings) generated once with Canvas2D.

Measured in Chrome (Metal) at 2880×1800, DPR 2, HIGH quality: **60 FPS** in all 8 states and with state changes every 250 ms (a single 33 ms frame on the first ANALYZING entry); **CPU 0.3–0.6 ms/frame**; **26–62 draw calls**; ~3.8k elements in READY and ~5k in ANALYZING. ULTRA also holds 60 FPS (~7.8k elements). Measuring inside the Tauri app's WKWebView is still pending (the DEBUG panel shows it).

---

## What is still mocked

- All agent events (`MockAgentBridge`, `scenarios.ts`).
- ACCEPT/REJECT only change the machine state.
- `pty_spawn` returns an error (no `portable-pty` yet); `run_mock_sequence` is a scripted sequence in Rust.
- WARNING/CRITICAL and milestone payloads.

## Next steps: integrating Codex / Claude Code

1. **PTY:** add `portable-pty`, implement `PtyRegistry::spawn` (openpty + reader thread) and stream bytes through `tauri::ipc::Channel<PtyChunk>`; `pty_write` / `pty_resize` / `pty_kill` commands.
2. **Terminal:** React panel with `@xterm/xterm` + `@xterm/addon-fit` connected to that Channel.
3. **Adapters (`AgentAdapter`):** translate each CLI's output into `AgentEvent`. Prefer structured channels when available (e.g. JSON/stream output or agent hooks) over parsing ANSI text.
4. **Real approvals:** `ui.accept`/`ui.reject` → a Rust command that answers the agent's prompt.
5. **More agent feedback:** map real progress (files read, tests passing) to parameters (`unfold`, panel density) so the scene reflects the work, not just the state.
6. **Sound:** a crystalline tone when each voice line and card appears.
