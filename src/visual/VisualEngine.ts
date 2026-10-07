import {
  HalfFloatType,
  PerspectiveCamera,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { SageState } from "../machine/events";
import { BACKGROUND, PALETTES, ROLE } from "./config/palettes";
import { DEFAULT_QUALITY, QUALITY, QUALITY_LEVELS, type QualityLevel } from "./config/quality";
import { CAMERA, ENGINE, FIELD } from "./config/visualConfig";
import { CameraDirector } from "./core/CameraDirector";
import { resizeLines } from "./core/lines";
import { damp, noise1, Rng, smoothstep } from "./core/math";
import { Metrics, type EngineMetrics } from "./core/Metrics";
import { PaletteField } from "./core/PaletteField";
import { ParamController } from "./core/params";
import { createSharedTextures } from "./core/textures";
import { TransitionController } from "./core/TransitionController";
import type { EngineContext, VisualBus, VisualCue, VisualSignals, VisualSystem } from "./core/types";
import { compositeShader } from "./shaders/ShaderManager";
import { ArmillarySystem } from "./systems/ArmillarySystem";
import { BackgroundSystem } from "./systems/BackgroundSystem";
import { CoreSystem } from "./systems/CoreSystem";
import { DataDumpSystem } from "./systems/DataDumpSystem";
import { KanjiFieldSystem } from "./systems/KanjiFieldSystem";
import { FieldSystem } from "./systems/FieldSystem";
import { FlareSystem } from "./systems/FlareSystem";
import { MilestoneSystem } from "./systems/MilestoneSystem";
import { ModuleSystem } from "./systems/ModuleSystem";
import { MoteSystem } from "./systems/MoteSystem";
import { RainSystem } from "./systems/RainSystem";
import { SealSystem } from "./systems/SealSystem";
import { ShockwaveSystem } from "./systems/ShockwaveSystem";
import { TunnelSystem } from "./systems/TunnelSystem";

export interface VisualEngineOptions {
  quality?: QualityLevel;
  adaptive?: boolean;
  onQualityChange?: (level: QualityLevel) => void;
}

/**
 * Real-time renderer (Three.js / WebGL2 + postprocessing).
 *
 * Public surface is small and semantic: `setState`, `setSignals`,
 * `playMilestone`, `setQuality`. It knows nothing about React, XState, Tauri,
 * Codex or Claude. Every per-frame operation happens in its own animation
 * loop; React never re-renders because of animation.
 *
 * Frame: RenderPass → UnrealBloom (reduced resolution) → SageComposite
 * (refraction, datamosh, inversion, retry grid, flash, grain) → OutputPass.
 */
export class VisualEngine {
  private renderer!: WebGLRenderer;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private composite!: ShaderPass;
  private scene = new Scene();
  private camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  private host!: HTMLElement;
  private resizeObserver!: ResizeObserver;

  private paramsCtl = new ParamController();
  private palette = new PaletteField(PALETTES.READY);
  private transitions!: TransitionController;
  private director = new CameraDirector();
  private metrics = new Metrics();
  private systems: VisualSystem[] = [];
  private ctx!: EngineContext;

  private core!: CoreSystem;
  private motes!: MoteSystem;
  private shockwaves!: ShockwaveSystem;
  private armillary!: ArmillarySystem;
  private milestoneSys!: MilestoneSystem;

  private pointerTarget = { x: 0, y: 0 };
  private cueListeners = new Set<(c: VisualCue) => void>();
  private lastGlitch = 0;
  private flashV = 0;
  private flashRole: number = ROLE.core;
  private lastRetries = 0;
  private adaptive: boolean;
  private slowSeconds = 0;
  private slowAcc = 0;
  private slowFrames = 0;
  private lastFrame = 0;
  private running = false;
  private destroyed = false;
  private onQualityChange?: (level: QualityLevel) => void;

  private constructor(opts: VisualEngineOptions) {
    this.adaptive = opts.adaptive ?? false;
    this.onQualityChange = opts.onQualityChange;
  }

  static async create(host: HTMLElement, opts: VisualEngineOptions = {}): Promise<VisualEngine> {
    const engine = new VisualEngine(opts);
    engine.init(host, opts.quality ?? DEFAULT_QUALITY);
    return engine;
  }

  private init(host: HTMLElement, level: QualityLevel): void {
    this.host = host;
    const quality = QUALITY[level];
    const renderer = new WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false });
    renderer.setClearColor(BACKGROUND.deep, 1);
    renderer.info.autoReset = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxDpr));
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene.add(this.camera); // camera-attached children (lens flares) render too
    this.camera.position.set(0, 0, 13);

    const bus: VisualBus = {
      cue: (c) => this.emit(c),
      shockwave: (o) => {
        this.emit({ type: "shock", strength: o.strength ?? 0.6 });
        this.shockwaves.spawn(o);
      },
      burst: (x, y, n, speed, role, life) => this.motes.burst(x, y, n, speed, role, life),
      flash: (amount, role = ROLE.core) => {
        this.emit({ type: "flash", amount });
        this.flashV = Math.min(1.4, this.flashV + amount);
        this.flashRole = role;
        this.core.flash(amount, role);
      },
    };
    this.transitions = new TransitionController(this.paramsCtl, this.palette, bus, this.director);

    this.ctx = {
      scene: this.scene,
      camera: this.camera,
      hud: this.camera,
      params: this.paramsCtl.live,
      palette: this.palette,
      quality,
      textures: createSharedTextures(),
      rng: new Rng(0x5a6e5a6e),
      view: { width: 1, height: 1, pixelRatio: renderer.getPixelRatio(), aspect: 1, halfW: FIELD.fitRadius, halfH: FIELD.fitRadius },
      pointer: { x: 0, y: 0 },
      time: 0,
      dt: 0,
      state: "READY",
      prevState: "READY",
      stateTime: 0,
      signals: { activeModule: null, completedModules: [], retries: 0, danger: false },
      bus,
    };
    const ctx = this.ctx;

    // Systems, in update order. Draw order is controlled by renderOrder.
    const background = new BackgroundSystem(ctx);
    const tunnel = new TunnelSystem(ctx);
    const rain = new RainSystem(ctx);
    const seal = new SealSystem(ctx);
    const modules = new ModuleSystem(seal.group);
    this.armillary = new ArmillarySystem(ctx);
    this.shockwaves = new ShockwaveSystem(ctx);
    this.milestoneSys = new MilestoneSystem(ctx);
    this.core = new CoreSystem(ctx);
    this.motes = new MoteSystem(ctx);
    const flares = new FlareSystem(ctx);
    const dataDump = new DataDumpSystem(ctx);
    const kanjiField = new KanjiFieldSystem(ctx);
    const field = new FieldSystem(ctx);
    this.cueListeners.add((c) => c.type === "corrupt" && dataDump.play(c.duration));
    this.director.onPunch = (amount) => this.emit({ type: "punch", amount });
    this.shockwaves.onPulse = (s) => {
      this.emit({ type: "pulse", strength: s });
      this.armillary.pulse(s);
      this.director.move({ channel: "shake", amount: 0.03 * s, attack: 0.03, release: 0.35, style: "punch" });
      if (ctx.params.expel > 0.3) bus.burst(0, 0, 50, 6, ROLE.secondary, 1);
    };
    this.systems = [
      background, tunnel, rain, seal, modules, this.armillary, this.shockwaves, this.milestoneSys, this.core, this.motes, flares, dataDump, kanjiField, field,
    ];

    this.buildComposer();
    this.transitions.enter("READY", "READY");
    this.paramsCtl.snap();
    this.handleResize();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(host);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.start();
  }

  private buildComposer(): void {
    const q = this.ctx.quality;
    this.composer?.dispose();
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: q.msaa });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.6, 0.4, 0.32);
    this.bloom.enabled = q.bloom;
    composer.addPass(this.bloom);
    this.composite = new ShaderPass(compositeShader());
    composer.addPass(this.composite);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  // ───────────────────────────────── public API

  setState(state: SageState): void {
    const ctx = this.ctx;
    if (!ctx || state === ctx.state) return;
    const from = ctx.state;
    ctx.prevState = from;
    ctx.state = state;
    ctx.stateTime = 0;
    this.emit({ type: "state", from, to: state });
    this.transitions.enter(from, state);
    for (const s of this.systems) s.onStateChange?.(from, state, ctx);
  }

  /** Subscribe to semantic visual cues (frame-accurate). Returns an unsubscribe. */
  onCue(listener: (c: VisualCue) => void): () => void {
    this.cueListeners.add(listener);
    return () => this.cueListeners.delete(listener);
  }

  private emit(c: VisualCue): void {
    for (const l of this.cueListeners) l(c);
  }

  setSignals(signals: VisualSignals): void {
    if (!this.ctx) return;
    if (signals.retries > this.lastRetries) this.transitions.retry();
    this.lastRetries = signals.retries;
    if (signals.danger !== this.ctx.signals.danger) {
      this.transitions.setDanger(signals.danger);
      this.emit({ type: "danger", on: signals.danger });
    }
    this.ctx.signals = signals;
  }

  playMilestone(): void {
    if (!this.ctx) return;
    this.transitions.milestone(() => this.milestoneSys.play());
  }

  get quality(): QualityLevel {
    return this.ctx?.quality.level ?? DEFAULT_QUALITY;
  }

  setQuality(level: QualityLevel): void {
    const ctx = this.ctx;
    if (!ctx || ctx.quality.level === level) return;
    ctx.quality = QUALITY[level];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ctx.quality.maxDpr));
    for (const s of this.systems) s.setQuality?.(ctx);
    this.buildComposer();
    this.handleResize();
    this.onQualityChange?.(level);
  }

  setAdaptive(on: boolean): void {
    this.adaptive = on;
    this.slowSeconds = 0;
  }

  getMetrics(): EngineMetrics {
    let particles = 0;
    for (const s of this.systems) particles += s.stats?.().particles ?? 0;
    const r = this.renderer;
    const size = r ? r.getDrawingBufferSize(new Vector2()) : new Vector2();
    return {
      fps: this.metrics.fps,
      frameMs: this.metrics.frameMs,
      cpuMs: this.metrics.cpuMs,
      particles,
      drawCalls: this.metrics.drawCalls,
      triangles: this.metrics.triangles,
      width: size.x,
      height: size.y,
      resolution: r?.getPixelRatio() ?? 1,
      devicePixelRatio: window.devicePixelRatio || 1,
      renderer: r ? (r.capabilities.isWebGL2 ? "WebGL2 · three" : "WebGL") : "—",
    };
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener("pointermove", this.onPointer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.resizeObserver?.disconnect();
    if (!this.renderer) return;
    this.renderer.setAnimationLoop(null);
    for (const s of this.systems) s.destroy();
    for (const t of Object.values(this.ctx.textures)) t.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ───────────────────────────────── internals

  private start(): void {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  private stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private onPointer = (e: PointerEvent): void => {
    this.pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointerTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  private onVisibility = (): void => {
    // Fully stop rendering while hidden: zero GPU work in the background.
    if (document.hidden) this.stop();
    else this.start();
  };

  private handleResize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    const pr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    // Bloom at a fraction of the canvas: it is low-frequency by nature.
    const br = this.ctx.quality.bloomResolution;
    this.bloom.setSize(Math.round(w * pr * br), Math.round(h * pr * br));

    const aspect = w / h;
    this.camera.aspect = aspect;
    // Fit a disc of FIELD.fitRadius in the shorter side.
    const tan = Math.tan((CAMERA.fov * Math.PI) / 360);
    const halfH = aspect >= 1 ? FIELD.fitRadius : FIELD.fitRadius / aspect;
    this.director.fitDistance = halfH / tan;
    this.camera.updateProjectionMatrix();

    const v = this.ctx.view;
    v.width = w;
    v.height = h;
    v.pixelRatio = pr;
    v.aspect = aspect;
    v.halfH = halfH;
    v.halfW = halfH * aspect;
    resizeLines(w, h, pr);
    for (const s of this.systems) s.resize?.(this.ctx);
  }

  private frame = (): void => {
    const now = performance.now();
    const interval = now - this.lastFrame;
    this.lastFrame = now;
    const ctx = this.ctx;
    const dt = Math.min(interval / 1000, ENGINE.maxDt);
    ctx.dt = dt;
    ctx.time += dt;
    ctx.stateTime += dt;

    // Camera parallax + slow autonomous drift: real depth between layers.
    const driftX = Math.sin(ctx.time * 0.07) * 0.25;
    const driftY = Math.cos(ctx.time * 0.05) * 0.2;
    ctx.pointer.x = damp(ctx.pointer.x, this.pointerTarget.x * 0.8 + driftX, 1.6, dt);
    ctx.pointer.y = damp(ctx.pointer.y, this.pointerTarget.y * 0.8 + driftY, 1.6, dt);
    this.transitions.update(dt);
    this.paramsCtl.update(dt);
    this.palette.update(dt);
    this.director.update(this.camera, ctx);
    for (let i = 0; i < this.systems.length; i++) this.systems[i].update(ctx);

    this.flashV = damp(this.flashV, 0, 4, dt);
    this.updatePost();

    this.renderer.info.reset();
    this.composer.render(dt);
    this.metrics.drawCalls = this.renderer.info.render.calls;
    this.metrics.triangles = this.renderer.info.render.triangles;

    this.metrics.endFrame(interval, performance.now() - now);
    if (this.adaptive) this.adapt(interval);
  };

  private updatePost(): void {
    const ctx = this.ctx;
    const p = ctx.params;
    const t = ctx.time;
    this.bloom.strength = (0.25 + p.bloom * 0.5) * Math.min(1.2, p.energy);
    this.bloom.radius = 0.3 + p.bloom * 0.2;

    const u = this.composite.uniforms;
    u.uTime.value = t;
    u.uAspect.value = ctx.view.aspect;
    const sw = this.shockwaves.strongest;
    u.uShockR.value = sw.r < 0 ? -1 : sw.r / ctx.view.halfH;
    u.uShockWidth.value = (sw.width / ctx.view.halfH) * 1.5;
    u.uShockStrength.value = sw.amount;
    // Aberration and glitch are occasional bursts, never a constant filter.
    const occasional = smoothstep(0.35, 0.85, noise1(t * 0.9, 11));
    const tr = this.transitions;
    u.uAberration.value = p.aberration * (0.15 + 0.85 * occasional) + tr.glitchKick * 0.8;
    u.uGlitch.value = p.glitch * smoothstep(0.6, 0.92, noise1(t * 1.7, 23)) + tr.glitchKick;
    // Occasional glitch bursts (CRITICAL) become cues as they start.
    const g = u.uGlitch.value;
    if (g > 0.35 && this.lastGlitch <= 0.35) this.emit({ type: "glitch", amount: Math.min(1, g) });
    this.lastGlitch = g;
    const invertPulse = p.invert > 0.01 ? p.invert * smoothstep(0.7, 0.95, noise1(t * 1.1, 31)) * 6 : 0;
    u.uInvert.value = Math.min(1, invertPulse + tr.invertKick);
    u.uTiles.value = tr.tiles;
    u.uTileInvert.value = tr.tileInvert;
    u.uFlash.value = this.flashV * 0.3;
    u.uCut.value = tr.cut;
    u.uWhite.value = tr.white;
    u.uDefocus.value = tr.defocus;
    u.uCutColor.value.setHex(this.palette.core(tr.cutRole));
    u.uFlashColor.value.setHex(this.palette.core(this.flashRole));
    u.uGrain.value = p.grain;
    u.uVignette.value = p.vignette;
  }

  /** Steps quality down when frames are consistently slow. Never steps up automatically. */
  private adapt(frameMs: number): void {
    this.slowAcc += frameMs;
    this.slowFrames++;
    if (this.slowAcc < 1000) return;
    const avg = this.slowAcc / this.slowFrames;
    this.slowAcc = 0;
    this.slowFrames = 0;
    this.slowSeconds = avg > ENGINE.adaptiveDowngradeMs ? this.slowSeconds + 1 : 0;
    if (this.slowSeconds >= ENGINE.adaptiveWindowS) {
      this.slowSeconds = 0;
      const i = QUALITY_LEVELS.indexOf(this.ctx.quality.level);
      if (i > 0) this.setQuality(QUALITY_LEVELS[i - 1]);
    }
  }
}
