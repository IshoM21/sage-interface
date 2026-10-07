import { AdditiveBlending, Group, Sprite, SpriteMaterial, type Texture } from "three";
import { ROLE } from "../config/palettes";
import { damp, noise1, TAU } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";

function glowSprite(map: Texture): Sprite {
  const s = new Sprite(new SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending }));
  s.renderOrder = 20;
  return s;
}

/**
 * The light at the centre: a white core that can blow out (bloom does the
 * rest), a four-point star with fine rays and an anamorphic streak. Breathes
 * through a phase accumulator so rate changes never jump.
 */
export class CoreSystem implements VisualSystem {
  readonly name = "core";
  private root = new Group();
  private halo: Sprite;
  private inner: Sprite;
  private pin: Sprite;
  private star: Sprite;
  private streak: Sprite;
  private phase = 0;
  private flashV = 0;
  private flashRole: number = ROLE.core;

  constructor(ctx: EngineContext) {
    const t = ctx.textures;
    this.halo = glowSprite(t.glow);
    this.inner = glowSprite(t.glow);
    this.pin = glowSprite(t.dot);
    this.star = glowSprite(t.star);
    this.streak = glowSprite(t.glow);
    this.root.add(this.halo, this.streak, this.star, this.inner, this.pin);
    ctx.scene.add(this.root);
  }

  flash(amount: number, role: number = ROLE.core): void {
    this.flashV = Math.min(1.6, this.flashV + amount);
    this.flashRole = role;
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, time, palette } = ctx;
    this.phase += dt * p.coreBreathRate * TAU;
    // Heartbeat: lub-dub every 1.6 s.
    const hbT = (time % 1.6) / 1.6;
    const beat = p.heartbeat * (Math.exp(-(((hbT - 0.02) * 16) ** 2)) + 0.6 * Math.exp(-(((hbT - 0.16) * 16) ** 2)));
    const breath = 1 + Math.sin(this.phase) * p.coreBreathAmp + beat * 0.22;
    this.flashV = damp(this.flashV, 0, 3, dt);
    const f = this.flashV;

    const shake = p.coreShake;
    this.root.position.set(shake * noise1(time * 9, 1) * 0.08, shake * noise1(time * 9, 2) * 0.08, 0.2);
    const flicker = shake > 0.01 ? 1 - shake * 0.4 * Math.max(0, noise1(time * 14, 4)) : 1;
    const e = p.energy * flicker;
    const core = palette.core(ROLE.core);
    const prim = palette.core(ROLE.primary);

    this.halo.scale.setScalar((1.6 + p.coreGlow * 1.8 + f * 5) * breath);
    this.halo.material.opacity = Math.min(1, (0.12 + p.coreGlow * 0.16 + f * 0.45 + beat * 0.25) * e);
    this.halo.material.color.setHex(prim);

    this.inner.scale.setScalar((0.5 + p.coreGlow * 0.55 + f * 1.4) * breath);
    this.inner.material.opacity = Math.min(1, (0.45 + p.coreGlow * 0.3) * e);
    this.inner.material.color.setHex(f > 0.05 ? palette.core(this.flashRole) : core);

    this.pin.scale.setScalar(0.28 + p.coreGlow * 0.25 + f * 0.4);
    this.pin.material.opacity = Math.min(1, e + f);
    this.pin.material.color.setHex(core);

    const starAmt = p.flare * 0.45 + p.coreGlow * 0.15 + f * 0.8;
    this.star.scale.setScalar((1.2 + p.coreGlow * 1.6 + f * 3) * breath);
    this.star.material.rotation = time * 0.03;
    this.star.material.opacity = Math.min(1, starAmt * e);
    this.star.material.color.setHex(core);

    this.streak.scale.set(6 + p.flare * 8 + f * 8, 0.08 + f * 0.1, 1);
    this.streak.material.opacity = Math.min(1, (p.flare * 0.25 + f * 0.6) * e);
    this.streak.material.color.setHex(prim);
  }

  destroy(): void {
    this.root.parent?.remove(this.root);
    for (const s of [this.halo, this.inner, this.pin, this.star, this.streak]) s.material.dispose();
  }
}
