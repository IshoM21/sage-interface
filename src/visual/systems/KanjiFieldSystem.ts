import { AdditiveBlending, CanvasTexture, Sprite, SpriteMaterial } from "three";
import { ROLE } from "../config/palettes";
import { Rng } from "../core/math";
import type { EngineContext, VisualSystem } from "../core/types";

/** Vocabulary of thought, after S1E1 ~9:50 (解析, 吸収, 並列…) — generic analysis terms. */
const WORDS = ["解析", "吸収", "並列", "演算", "照合", "推論", "構造", "参照", "検索", "統合", "記録", "変換", "分解", "抽出"];
const POOL = 16;
const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

function wordTexture(word: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 150px ${SERIF}`;
  g.shadowColor = "rgba(255,255,255,0.8)";
  g.shadowBlur = 18;
  g.fillText(word, 256, 136);
  const t = new CanvasTexture(c);
  t.generateMipmaps = true;
  return t;
}

interface Floater {
  sprite: Sprite;
  life: number;
  max: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

/**
 * Words of thought drifting through depth during analysis: kanji appear far
 * away, float toward the camera with a slight tumble and fade out. Textures
 * are rendered once per word and shared.
 */
export class KanjiFieldSystem implements VisualSystem {
  readonly name = "kanjiField";
  private textures = WORDS.map(wordTexture);
  private floaters: Floater[] = [];
  private acc = 0;
  private rng = new Rng(0x6a17);

  constructor(ctx: EngineContext) {
    for (let i = 0; i < POOL; i++) {
      const sprite = new Sprite(
        new SpriteMaterial({ map: this.textures[0], transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: AdditiveBlending }),
      );
      sprite.visible = false;
      sprite.renderOrder = 15;
      ctx.scene.add(sprite);
      this.floaters.push({ sprite, life: 0, max: 1, vx: 0, vy: 0, vz: 0, spin: 0 });
    }
  }

  private spawn(): void {
    const f = this.floaters.find((x) => x.life <= 0);
    if (!f) return;
    const r = this.rng;
    f.sprite.material.map = this.textures[r.int(this.textures.length)];
    f.sprite.material.needsUpdate = true;
    // Around the seal, not over it: pick an angle and a ring of distance.
    const a = r.next() * Math.PI * 2;
    const d = r.range(3.2, 6.5);
    f.sprite.position.set(Math.cos(a) * d * 1.5, Math.sin(a) * d * 0.85, r.range(-14, -6));
    const s = r.range(1.0, 1.9);
    f.sprite.scale.set(s, s * 0.5, 1);
    f.vx = Math.cos(a) * r.range(0.05, 0.25);
    f.vy = Math.sin(a) * r.range(0.05, 0.2);
    f.vz = r.range(1.6, 3.2);
    f.spin = r.range(-0.25, 0.25);
    f.max = f.life = r.range(2.4, 4.2);
    f.sprite.visible = true;
  }

  update(ctx: EngineContext): void {
    const { params: p, dt, palette } = ctx;
    const rate = p.kanjiField * 4.5;
    this.acc += dt * rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.spawn();
    }
    const color = palette.at(ROLE.primary, 5);
    for (const f of this.floaters) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.sprite.visible = false;
        continue;
      }
      const k = f.life / f.max;
      f.sprite.position.x += f.vx * dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.position.z += f.vz * dt * (0.5 + p.tunnelSpeed * 0.5);
      f.sprite.material.rotation += f.spin * dt;
      // Fade in from the depth, fade out as it passes by.
      const env = Math.min(1, (1 - k) * 4) * Math.min(1, k * 2.5);
      f.sprite.material.opacity = env * 0.55 * Math.min(1, p.energy) * Math.max(0.15, p.kanjiField);
      f.sprite.material.color.setHex(color);
    }
  }

  destroy(): void {
    for (const f of this.floaters) {
      f.sprite.parent?.remove(f.sprite);
      f.sprite.material.dispose();
    }
    for (const t of this.textures) t.dispose();
  }
}
