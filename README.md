# Sage Interface

**Español** | [English](README.en.md)

Interfaz visual procedural en tiempo real para agentes de programación (Codex CLI, Claude Code, …), inspirada conceptualmente en el lenguaje gráfico de "Gran Sabio / Rafael": un **círculo mágico que se escribe** en el vacío, **tarjetas tipográficas de kanji**, una **voz** formal («Notice.», «Answer.», «Understood.»), túnel hiperespacial, bandas armilares y luz que desborda. Todo es procedural y propio: el alfabeto de los anillos de escritura es inventado, y no se usan assets, emblemas ni nombres del anime.

Estado actual: **POC visual (v2, Three.js)**. Los ocho estados, transiciones, AUTO DEMO, ceremonia de hito, beat de reintento, métricas, bloom y shaders GLSL están implementados. La integración real con agentes está preparada (modelo de eventos, puente Tauri, esqueleto PTY), pero no conectada.

### Lenguaje visual

| Estado | Escena | Tarjeta |
|---|---|---|
| READY | sólo la **semilla**: doble cuadrado fino inclinado en el vacío; pocos fragmentos de datos | 待機 Standing by |
| LISTENING | la semilla se despliega, la luz fluye hacia dentro, aparece la red de líneas | 聴取 Listening |
| ANALYZING | un **iris** se abre; túnel, bandas armilares, sello completo, **kanji flotando** en profundidad, fondo lleno (fragmentos, polvo, red de líneas punteadas, arcos) | 解析 Analyzing |
| EXECUTING | más velocidad, bandas en pasos mecánicos, sellos de módulo (READ…TEST), fragmentos volando | 実行 Executing |
| QUESTION | todo se congela; **▸YES / NO** en serif (←/→, Enter, Esc) | 問 Question |
| QUESTION peligrosa | el sello "se pone serio": entorno a negro, anillo de escritura a pasos pesados, cuenta atrás ámbar, rombo 告 fijo | 告 Warning |
| COMPLETE | convergencia, flash, lluvia de luz y **reporte 報告** que suma resultados uno a uno | 報告 |
| WARNING | pulsos ámbar que transforman la escena por tramos, bandas que oscilan | 警告 Warning |
| CRITICAL | **interludio de datos corruptos**, luego inversión a papel y rojo, datamosh, fragmentación | 失敗 Failed |
| retry | ciclo completo: glitch → 失敗 → 再度実行 → nuevo intento; desde el 3.º seguido, montaje en cuadrícula | 再度実行 |
| milestone | **inmersión en blanco** y ceremonia dorada: anillo ornamentado, dodecágono, rayos | 獲得 Ultimate skill |
| arranque | **identidad**: nace el rombo, se ensambla el kanji (`src/config/identity.ts`, por defecto 叡) y se teclea el nombre | 叡 |

Emblemas: el **disco blanco** (kanji negros) es la forma de Gran Sabio para respuestas y confirmaciones; el **rombo** se reserva para advertencias (告). El texto de cada tarjeta se **ensambla** carácter a carácter, con sonido sincronizado.

---

## Stack

| Capa | Tecnología | Rol |
|---|---|---|
| Shell nativo | **Tauri 2 + Rust** | ventana, comandos, eventos semánticos; PTY en el futuro |
| UI | **React 19 + TypeScript + Vite** | paneles, texto, controles. **Nunca** renderiza frames |
| Estado | **XState v5 + @xstate/react** | máquina de estados paralela (agente + ceremonias) |
| Render | **Three.js (WebGL2) + EffectComposer** | escena 3D real, Line2, instancing, UnrealBloom |
| UI motion | **Motion for React** | tarjetas, voz, paneles y overlays |
| Shaders | **GLSL** (ShaderMaterial / ShaderPass) | nebulosa, túnel, lluvia, paneles, puntos, anillo de escritura, composite |
| Tipografía | Hiragino Mincho (sistema macOS) + Baskerville | kanji y voz en serif; sin fuentes externas |

La v1 usaba PixiJS (2D/2.5D). Se migró a Three.js porque la referencia vive de **profundidad real** (túnel, bandas inclinadas) y **luz** (bloom HDR), que es justo lo que Three.js + postprocessing resuelven bien.

## Ejecutar

```bash
npm install
npm run app:dev        # app Tauri con hot reload (abre la ventana macOS)
npm run dev            # sólo frontend en http://localhost:1420 (navegador)
npm run app:build      # bundle release → src-tauri/target/release/bundle/macos/Sage Interface.app
```

Verificación:

```bash
npm run typecheck      # tsc -b
npm run lint           # eslint
npm test               # vitest (máquina de estados)
npm run build          # build web de producción
cd src-tauri && cargo test   # serialización de AgentEvent en Rust
```

### Controles

| Tecla | Acción |
|---|---|
| `1`–`8` | READY · LISTENING · ANALYZING · EXECUTING · QUESTION · COMPLETE · WARNING · CRITICAL |
| `4` repetido | rota el módulo activo (READ → WRITE → EXEC → BUILD → TEST) |
| `A` | AUTO DEMO (READY 2s → LISTENING 2s → ANALYZING 5s → EXECUTING 4s → COMPLETE → READY) |
| `T` | FULL TOUR (incluye QUESTION, WARNING y MILESTONE) |
| `M` | MILESTONE / SKILL ACQUIRED |
| `R` | beat de reintento (`agent.retry`) |
| `S` | sonido on/off (el volumen está en el panel de controles) |
| `9` | pregunta peligrosa (`agent.question` con `danger: true`) |
| `I` | repetir la secuencia de identidad |
| `←/→`, `Enter`, `Esc` | elegir YES/NO, confirmar, responder NO (en QUESTION) |
| `D` / `C` / `H` | debug / controles / ocultar toda la UI |
| `Q` | cicla calidad LOW → MEDIUM → HIGH → ULTRA |
| `F` | pantalla completa |

---

## Arquitectura

```
React (UI, 0 renders por frame)
 ├── SageActor (XState)  ← AgentEvents ←  AgentBridge ─┬─ MockAgentBridge (scripts)
 │        │                                             └─ TauriAgentBridge ← Rust `sage://agent-event`
 │        │ actor.subscribe (no React state)
 │        ▼
 └── VisualEngine (Three.js, setAnimationLoop propio)
       ├── ParamController   — targets por estado, easing por parámetro
       ├── PaletteField      — color = f(rol, radio); onda de color desde el núcleo
       ├── TransitionController — coreografías, inversión, datamosh, cuadrícula de reintento, ceremonia dorada
       ├── ShaderManager     — ensambla GLSL (chunks) y declara uniforms
       ├── Composer: RenderPass → UnrealBloom (resolución reducida) → SageComposite → OutputPass
       └── Systems: Background (nebulosa + estrellas) · Tunnel (líneas + paneles) · Rain · Seal (semilla,
                    círculos, rombo, anillo de escritura) · Modules · Armillary · Shockwaves · Milestone
                    · Core (luz, estrella, streak) · Motes (CPU) · Flares (halos prismáticos)
```

```
src/
  audio/          AudioEngine (síntesis Web Audio), profiles (diseño sonoro por estado)
  app/            App.tsx, estilos, catálogo de estados (copy UI), fullscreen
  machine/        events.ts (AgentEvent), sageMachine.ts, selectors.ts, tests
  agent/          AgentBridge, MockAgentBridge, TauriAgentBridge, scenarios
  hooks/          sageActor, useVisualEngine, useAgentBridges, useKeyboardControls
  components/     SageOverlay (tarjetas kanji, voz, estado, QUESTION), MilestoneOverlay, StateControls, DebugPanel
  visual/
    VisualEngine.ts
    core/         params, PaletteField, TransitionController, CameraDirector, Metrics, math, textures, glyphs, lines, types
    systems/      un archivo por sistema visual
    states/       un archivo por estado (datos puros) + index
    shaders/      nebula, streak, panel, points, script, composite (.vert/.frag), noise.glsl, ShaderManager.ts
    config/       palettes (incl. GOLD), quality, visualConfig (layout del mundo)
src-tauri/src/
  lib.rs          builder + handlers
  agent/          AgentEvent (serde, espejo de TS) + emit()
  commands/       app_info, emit_agent_event, run_mock_sequence, pty_spawn (stub)
  pty/            diseño PTY: PtyRegistry, PtyChunk (Channel), trait AgentAdapter
```

### Decisiones de estructura

- **Sólo `VisualEngine`** (sin `SageRenderer` aparte): una clase dueña del renderer y el composer.
- **`SealSystem`** concentra la narrativa de construcción: semilla → círculo → rombo → círculo interior → anillos de vértice → anillo de escritura. Cada trazo se "escribe" limitando los segmentos instanciados de un `Line2` (coste cero por frame).
- **`ArmillarySystem`**: cintas 3D (cilindros abiertos texturizados) en ejes propios; `armAlign` las lleva a un plano frontal (resolución = simetría).
- **Un solo pass de composite** después del bloom (refracción de onda, datamosh, aberración, inversión, cuadrícula de reintento, flash, grano, viñeta) en vez de encadenar filtros.
- **Máquina paralela.** Región `agent` (8 estados) + región `overlay` (milestone). `agent.retry` sólo incrementa un contador (no cambia de estado).
- **Estados como datos.** `visual/states/*.ts` declaran parámetros, paleta y ondas de color; no contienen lógica.
- **`CameraDirector`** (`core/CameraDirector.ts`): la cámara es la suma de una base por estado (`camDolly`, `camOrbit`, `camSway`, `camShake`), *movimientos* cortos disparados por las transiciones (empujones, retrocesos, giros secos, golpes de FOV, sacudidas) y el parallax del puntero. Los sistemas nunca mueven la cámara.
- **Ritmo de montaje:** `TransitionController.flashCut()` produce cortes de 1–2 fotogramas de luz sólida (composite `uCut`), contados en fotogramas, no en tiempo.
- **Marcos de fallo** (`SageOverlay` → `FailureFrame`): en CRITICAL y en reintentos, kanji gigantes flanquean el centro (失 | Failed | 敗, 再度 | Repeating attempt | 実行) con la palabra «FAILURE»/«RETRY» desbordando arriba y espejada abajo.
- **Profundidad de campo simulada:** paneles y líneas del túnel se desenfocan según su distancia al plano focal (mip bias + ensanchamiento en el shader), sin pase de post extra.
- **El texto vive en React** (tarjetas kanji, voz): nítido a cualquier escala y animado con Motion; el canvas sólo dibuja luz y geometría.

### Cómo funciona una transición

1. La máquina cambia de estado → `useVisualEngine` llama a `engine.setState()` (suscripción directa, sin React).
2. `TransitionController.enter(from, to)`:
   - fija los **targets** de ~45 parámetros continuos (velocidad del túnel, despliegue del sello, bandas, convergencia, fragmentación, inversión…); cada uno se interpola con su propio rate → nada cambia de golpe;
   - lanza la **onda de paleta**: los elementos se recolorean según su radio cuando la onda los alcanza (WARNING usa 3 tramos: cada pulso ámbar transforma más segmentos);
   - programa **cues** (flash, shockwaves, overrides temporales) y **movimientos de cámara / cortes**. Ej. COMPLETE: el túnel desacelera → la luz converge → las bandas se alinean en un plano → flash → onda radial → lluvia de luz → (UI) tarjeta 了 a los 1.25 s, sincronizada con el subestado `complete.resolved` de la máquina.

---

## Sonido

Todo el audio es **procedural** (Web Audio API): no hay archivos de sonido, ~25 KB de código y <1 % de CPU. Vive en `src/audio/`:

- `AudioEngine.ts` — drone ambiental (5 voces → filtro con LFO → saturación opcional), reverb con respuesta al impulso generada, compresor, y efectos sintetizados: campanilla FM (cada línea de voz), golpe grave (tarjetas), fizz (cortes), whoosh (golpes de cámara), boom (ondas), glitch (fallos/reintentos), latido (QUESTION), arpegio y acorde (milestone).
- `profiles.ts` — el diseño sonoro por estado: notas del drone, filtro, aire, chispas (pensar), ticks mecánicos (actuar), saturación (fallo).
- **Sincronía:** el motor visual emite *cues* semánticos al fotograma exacto (`VisualEngine.onCue`: `cut`, `punch`, `shock`, `pulse`, `retryStep`, `milestone`, `heartbeat`…). El audio sólo escucha esos cues; el motor visual no sabe nada de sonido.
- El navegador/WebView exige un gesto del usuario para iniciar audio: arranca con la primera tecla o clic. Volumen y silencio se guardan en `localStorage`.

## Cómo añadir un nuevo estado

1. `src/machine/events.ts`: añade el nombre a `SageState`/`SAGE_STATES` y, si es necesario, un `AgentEvent` nuevo.
2. `src/machine/sageMachine.ts`: añade el estado bajo `agent.states` y la transición en `agent.on`. Mapea la clave en `selectors.ts` (`MAP`).
3. `src/visual/config/palettes.ts`: añade su `Palette`.
4. Crea `src/visual/states/miEstadoVisual.ts` (copia uno existente: `params`, `rates`, `wave`) y regístralo en `states/index.ts`.
5. (Opcional) coreografía de entrada en `TransitionController.enter`.
6. UI: kanji, línea de voz y textos en `app/stateCatalog.ts`; color CSS en `app.css` (`.app[data-state=…]`).

TypeScript señalará cada `Record<SageState, …>` incompleto.

## Cómo añadir un sistema visual

1. Crea `src/visual/systems/MiSistema.ts` implementando `VisualSystem` (`core/types.ts`): `update(ctx)` obligatorio; `resize`, `setQuality`, `onStateChange`, `stats`, `destroy` opcionales.
2. Reglas del hot path: **no asignar memoria en `update`** (pools prealocados, typed arrays, animación en shader cuando se pueda), leer sólo `ctx.params`, colorear con `ctx.palette.at(ROLE.x, radio)` (radio en unidades de mundo), usar `ctx.rng` en vez de `Math.random()`.
3. Materiales que brillan: aditivos, `depthWrite: false`, orden con `renderOrder`. Líneas gruesas con `core/lines.ts` (`makeLine` / `setProgress`).
4. Si necesita un parámetro nuevo, añádelo a `VisualParams` + `BASE_PARAMS` (`core/params.ts`) y dale valores en los estados.
5. Instáncialo en `VisualEngine.init()` (añadiéndolo a `ctx.scene`, al grupo del sello o a la cámara) y agrégalo a `this.systems`.

## Cómo enviar un AgentEvent

Desde el frontend:

```ts
mock.emit({ type: "tool.started", tool: "cargo build" });   // MockAgentBridge
actor.send({ type: "agent.warning", message: "CONTEXT 87%" }); // directo a la máquina
```

Desde Rust (lo que harán los adaptadores reales):

```rust
agent::emit(&app_handle, &AgentEvent::ToolStarted { tool: "npm test".into() })?;
```

El evento viaja como `sage://agent-event` → `TauriAgentBridge` → máquina → motor. En la app Tauri, el panel muestra **NATIVE BRIDGE (RUST)**: *ECHO EVENT* hace round-trip por Rust y *RUST SEQUENCE* emite una secuencia desde un hilo nativo.

`tool.started` mapea nombres arbitrarios a los cinco módulos visuales con `toolToModule()` (`events.ts`). `agent.retry` (opcional `attempt`) dispara el beat de reintento sin cambiar de estado.

## Calidad gráfica

`src/visual/config/quality.ts` define LOW / MEDIUM / HIGH (por defecto) / ULTRA. Cada nivel controla: DPR máximo, motas CPU, ráfagas, estrellas, líneas del túnel, paneles, lluvia, bloom (on/off y resolución interna), MSAA del composer, octavas de la nebulosa y halos prismáticos.

- En runtime: botones del panel DEBUG, tecla `Q` o `engine.setQuality("MEDIUM")`.
- **ADAPTIVE QUALITY** (opcional): baja un nivel si el frame medio supera 21 ms durante 3 s seguidos. Nunca sube automáticamente.
- Cambiar de calidad reconstruye los pools y el composer (MSAA incluido) sin recrear el renderer.

## Cómo añadir un shader

1. Escribe `src/visual/shaders/mi.vert` / `mi.frag` (GLSL de `ShaderMaterial`: Three inyecta `projectionMatrix`, `modelViewMatrix`, `position`, `uv`).
2. En `ShaderManager.ts` crea una fábrica que devuelva un `ShaderMaterial` (o una definición para `ShaderPass` si es post-proceso). Usa `withNoise()` si necesitas `fbm`/`hash12`.
3. Para muchos elementos: `InstancedBufferGeometry` + atributos por instancia y animación en el vertex shader a partir de un escalar acumulado (como `TunnelSystem`).
4. Escribe uniforms desde un sistema en `update()`.

Para WebGPU habría que portar a TSL / `WebGPURenderer`; hoy se usa `WebGLRenderer`.

---

## Decisiones de rendimiento

- **React fuera del bucle.** El motor se suscribe al actor de XState directamente; React sólo re-renderiza en cambios de estado y el panel de métricas hace polling a 4 Hz.
- **Geometría construida una vez.** Sello, bandas, rayos y anillos de escritura se crean al inicio; la "escritura" progresiva limita el número de segmentos instanciados.
- **Animación en GPU.** Túnel, paneles, lluvia y estrellas (miles de instancias) se mueven en el vertex shader a partir de un único escalar; coste CPU O(1).
- **Motas y ráfagas** en `Points` con `Float32Array` y `DynamicDrawUsage`; pools fijos, sin objetos por frame.
- **Bloom a resolución reducida** (0.35–0.7× según calidad) en render target `HalfFloat`; luego un único composite.
- **Inversión, datamosh y aberración** sólo en ráfagas (transiciones, reintentos, CRITICAL), nunca como filtro permanente.
- **Paleta por LUT** (32 buckets × 7 roles por frame), **dt limitado**, **PRNG propio**, `setAnimationLoop` detenido con la ventana oculta, DPR acotado por calidad.
- **Texturas procedurales** (glows, estrella, halo prismático, paneles, cintas, anillos de escritura) generadas una vez con Canvas2D.

Medido en Chrome (Metal) a 2880×1800, DPR 2, calidad HIGH: **60 FPS** en los 8 estados y con cambios de estado cada 250 ms (un único frame de 33 ms al entrar por primera vez en ANALYZING); **CPU 0.3–0.6 ms/frame**; **26–62 draw calls**; ~3.8k elementos en READY y ~5k en ANALYZING. ULTRA también se mantiene a 60 FPS (~7.8k elementos). Sigue pendiente medirlo en el WKWebView de la app Tauri (el panel DEBUG lo muestra).

---

## Qué sigue siendo mock

- Todos los eventos del agente (`MockAgentBridge`, `scenarios.ts`).
- ACCEPT/REJECT sólo cambian el estado de la máquina.
- `pty_spawn` devuelve error (sin `portable-pty` todavía); `run_mock_sequence` es un guion en Rust.
- Payloads de WARNING/CRITICAL y del milestone.

## Siguientes pasos: integrar Codex / Claude Code

1. **PTY:** añadir `portable-pty`, implementar `PtyRegistry::spawn` (openpty + hilo lector) y enviar bytes por `tauri::ipc::Channel<PtyChunk>`; comandos `pty_write` / `pty_resize` / `pty_kill`.
2. **Terminal:** panel React con `@xterm/xterm` + `@xterm/addon-fit` conectado a ese Channel.
3. **Adaptadores (`AgentAdapter`):** traducir la salida de cada CLI a `AgentEvent`. Preferir canales estructurados cuando existan (p. ej. salida JSON/stream o hooks del agente) antes que parsear texto ANSI.
4. **Aprobaciones reales:** `ui.accept`/`ui.reject` → comando Rust que responde al prompt del agente.
5. **Más retroalimentación del agente:** mapear progreso real (archivos leídos, tests pasando) a parámetros (`unfold`, densidad de paneles) para que la escena refleje el trabajo, no sólo el estado.
6. **Voz:** frases fijas pregeneradas («Notice.», «Answer.», «Understood.»…) con tratamiento de "sistema", disparadas por los mismos cues que el sonido.
