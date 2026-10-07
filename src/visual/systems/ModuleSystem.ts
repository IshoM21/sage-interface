import { CanvasTexture, Group, Sprite, SpriteMaterial, AdditiveBlending } from "three";
import type { SageState, ToolModule } from "../../machine/events";
import { TOOL_MODULES } from "../../machine/events";
import { ROLE } from "../config/palettes";
import { MODULE_ANGLES, MODULE_LABELS, SEAL } from "../config/visualConfig";
import { disposeLine, makeLine, polygonPoints, setProgress, type SageLine } from "../core/lines";
import { clamp, damp } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";

export const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Songti SC", Georgia, serif';

function labelTexture(text: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.font = `600 64px ${SERIF}`;
  g.textBaseline = "middle";
  // Manual tracking (letterSpacing support varies across WebKit versions).
  const spacing = 18;
  const widths = [...text].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = (512 - total) / 2;
  [...text].forEach((ch, i) => {
    g.fillText(ch, x, 64);
    x += widths[i] + spacing;
  });
  const t = new CanvasTexture(c);
  t.generateMipmaps = true;
  return t;
}

interface Sigil {
  id: ToolModule;
  group: Group;
  frame: SageLine;
  inner: SageLine;
  label: Sprite;
  level: number;
  appear: number;
  ping: number;
}

/**
 * EXECUTING: five action sigils (READ / WRITE / EXEC / BUILD / TEST) on an
 * arc of the seal. They are written in sequence; the active one ignites.
 */
export class ModuleSystem implements VisualSystem {
  readonly name = "modules";
  private root = new Group();
  private sigils: Sigil[] = [];
  private bootT = 0;
  private lastActive: ToolModule | null = null;

  constructor(parent: Group) {
    MODULE_LABELS.forEach((text, i) => {
      const a = MODULE_ANGLES[i];
      const group = new Group();
      group.position.set(Math.cos(a) * SEAL.moduleRadius, Math.sin(a) * SEAL.moduleRadius, 0);
      const frame = makeLine(polygonPoints(0.2, 4, Math.PI / 2, 8), 1.6);
      const inner = makeLine(polygonPoints(0.09, 4, Math.PI / 2, 4), 1.2);
      const label = new Sprite(
        new SpriteMaterial({ map: labelTexture(text), transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending }),
      );
      label.scale.set(0.9, 0.225, 1);
      label.position.set(0, 0.36, 0);
      group.add(frame.line, inner.line, label);
      this.root.add(group);
      this.sigils.push({ id: TOOL_MODULES[i], group, frame, inner, label, level: 0, appear: 0, ping: 0 });
    });
    parent.add(this.root);
  }

  onStateChange(_from: SageState, to: SageState): void {
    if (to === "EXECUTING") this.bootT = 0;
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, palette, signals, bus, time } = ctx;
    this.root.visible = p.modules > 0.01;
    if (!this.root.visible) return;
    this.bootT += dt;
    const active = signals.activeModule;
    if (active !== this.lastActive) {
      this.lastActive = active;
      const s = this.sigils.find((x) => x.id === active);
      if (s && p.modules > 0.5) {
        s.ping = 1;
        bus.burst(s.group.position.x, s.group.position.y, 30, 1.6, ROLE.accent, 0.7);
      }
    }
    const lit = palette.at(ROLE.accent, SEAL.moduleRadius);
    const base = palette.at(ROLE.primary, SEAL.moduleRadius);
    this.sigils.forEach((s, i) => {
      const boot = clamp((this.bootT - i * 0.1) / 0.4);
      s.appear = damp(s.appear, boot * p.modules, 8, dt);
      const isActive = s.id === active;
      const done = signals.completedModules.includes(s.id);
      s.level = damp(s.level, isActive ? 1 : done ? 0.4 : 0, 6, dt);
      s.ping = Math.max(0, s.ping - dt * 1.5);
      setProgress(s.frame, s.appear);
      setProgress(s.inner, s.level);
      const pulse = 0.8 + 0.2 * Math.sin(time * 9);
      const op = s.appear * Math.min(1.2, p.energy);
      s.frame.material.color.setHex(s.level > 0.5 ? lit : base);
      s.frame.material.opacity = op * (0.5 + 0.5 * s.level);
      s.inner.material.color.setHex(lit);
      s.inner.material.opacity = op * s.level * pulse;
      s.group.scale.setScalar(1 + s.level * 0.25 + s.ping * 0.3);
      s.group.rotation.z = s.level * time * 0.6;
      s.label.material.color.setHex(s.level > 0.5 ? lit : base);
      s.label.material.opacity = op * (0.45 + 0.55 * s.level);
      s.label.rotation.set(0, 0, 0);
    });
  }

  destroy(): void {
    this.root.parent?.remove(this.root);
    for (const s of this.sigils) {
      disposeLine(s.frame);
      disposeLine(s.inner);
      s.label.material.map?.dispose();
      s.label.material.dispose();
    }
  }
}
