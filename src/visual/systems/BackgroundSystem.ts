import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, Mesh, Points, type ShaderMaterial } from "three";
import { BACKGROUND, ROLE } from "../config/palettes";
import type { EngineContext, VisualSystem } from "../core/types";
import { nebulaMaterial, pointsMaterial } from "../shaders/ShaderManager";

/**
 * The void: a full-screen nebula shader (blue/green clouds that intensify with
 * thought) and a GPU-only starfield far behind the seal for real parallax.
 */
export class BackgroundSystem implements VisualSystem {
  readonly name = "background";
  private nebula: Mesh<BufferGeometry, ShaderMaterial>;
  private stars!: Points<BufferGeometry, ShaderMaterial>;
  private starGroup = new Group();
  private starCount = 0;

  constructor(private ctx0: EngineContext) {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.nebula = new Mesh(geo, nebulaMaterial());
    this.nebula.frustumCulled = false;
    this.nebula.renderOrder = -100;
    this.nebula.material.uniforms.uDeep.value.setHex(BACKGROUND.deep);
    ctx0.scene.add(this.nebula, this.starGroup);
    this.buildStars(ctx0);
  }

  private buildStars(ctx: EngineContext): void {
    if (this.stars) {
      this.starGroup.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    }
    const n = ctx.quality.stars;
    this.starCount = n;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const alpha = new Float32Array(n);
    const { rng } = ctx;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rng.range(-70, 70);
      pos[i * 3 + 1] = rng.range(-45, 45);
      pos[i * 3 + 2] = rng.range(-90, -12);
      const warm = rng.next();
      col[i * 3] = 0.7 + 0.3 * warm;
      col[i * 3 + 1] = 0.85;
      col[i * 3 + 2] = 1;
      size[i] = 0.15 + rng.next() ** 3 * 0.7;
      alpha[i] = 0.3 + rng.next() * 0.7;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new BufferAttribute(col, 3));
    geo.setAttribute("aSize", new BufferAttribute(size, 1));
    geo.setAttribute("aAlpha", new BufferAttribute(alpha, 1));
    const mat = pointsMaterial(ctx.textures.dot);
    mat.uniforms.uTwinkle.value = 0.6;
    this.stars = new Points(geo, mat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -90;
    this.starGroup.add(this.stars);
  }

  setQuality(ctx: EngineContext): void {
    this.buildStars(ctx);
  }

  update(ctx: EngineContext): void {
    const { params: p, palette, view } = ctx;
    const u = this.nebula.material.uniforms;
    u.uTime.value = ctx.time;
    u.uAspect.value = view.aspect;
    u.uCenter.value.set(0.5 - ctx.pointer.x * 0.01, 0.5 + ctx.pointer.y * 0.01);
    u.uField.value.setHex(palette.core(ROLE.field));
    u.uField2.value.setHex(palette.core(ROLE.field2));
    u.uCore.value.setHex(palette.core(ROLE.primary));
    u.uIntensity.value = p.nebula * p.energy;
    u.uSwirl.value = p.nebulaSwirl;
    u.uDetail.value = ctx.quality.nebulaDetail;
    const front = palette.frontRadius;
    u.uWave.value = front < 0 ? -1 : (front / view.halfH) * 1.0;

    const s = this.stars.material.uniforms;
    s.uTime.value = ctx.time;
    s.uPixelRatio.value = view.pixelRatio;
    s.uOpacity.value = p.stars * Math.min(1, p.energy);
    this.starGroup.rotation.z += ctx.dt * 0.004 * (0.3 + p.tunnelSpeed);
  }

  stats() {
    return { particles: this.starCount };
  }

  destroy(): void {
    this.ctx0.scene.remove(this.nebula, this.starGroup);
    this.nebula.geometry.dispose();
    this.nebula.material.dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();
  }
}
