import { AdditiveBlending, Sprite, SpriteMaterial } from "three";
import { CAMERA } from "../config/visualConfig";
import type { EngineContext, VisualSystem } from "../core/types";

const DEPTH = 6;

/**
 * Prismatic lens halos (dispersion arcs) in screen space — attached to the
 * camera so they behave like optics, not like objects in the scene.
 */
export class FlareSystem implements VisualSystem {
  readonly name = "flares";
  private halos: { s: Sprite; x: number; y: number; size: number; alpha: number; drift: number }[] = [];

  constructor(ctx: EngineContext) {
    const defs = [
      { x: 1.32, y: 0.05, size: 0.9, alpha: 0.3, drift: 0.7 },
      { x: -1.22, y: -1.05, size: 0.55, alpha: 0.2, drift: -0.5 },
      { x: -0.32, y: 0.46, size: 0.07, alpha: 0.18, drift: 1.2 },
    ];
    for (const d of defs) {
      const s = new Sprite(
        new SpriteMaterial({ map: ctx.textures.prism, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending }),
      );
      s.renderOrder = 60;
      ctx.camera.add(s);
      this.halos.push({ s, ...d });
    }
  }

  update(ctx: EngineContext): void {
    const { params: p, view, time } = ctx;
    const show = ctx.quality.flares && p.flare > 0.01;
    const halfH = Math.tan((CAMERA.fov * Math.PI) / 360) * DEPTH;
    const halfW = halfH * view.aspect;
    for (const h of this.halos) {
      h.s.visible = show;
      if (!show) continue;
      // Flares slide opposite to the pointer, like real lens ghosts.
      const px = -ctx.pointer.x * 0.08 * h.drift;
      const py = ctx.pointer.y * 0.08 * h.drift;
      h.s.position.set((h.x + px) * halfW, (h.y + py + Math.sin(time * 0.1 + h.drift) * 0.02) * halfH, -DEPTH);
      h.s.scale.setScalar(h.size * Math.min(halfH, halfW) * 2);
      h.s.material.opacity = p.flare * h.alpha * Math.min(1, p.energy);
      h.s.material.rotation = time * 0.02 * h.drift;
    }
  }

  destroy(): void {
    for (const h of this.halos) {
      h.s.parent?.remove(h.s);
      h.s.material.dispose();
    }
  }
}
