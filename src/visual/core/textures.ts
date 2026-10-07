import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { paintScriptRing } from "./glyphs";
import { SEAL } from "../config/visualConfig";
import { Rng, TAU } from "./math";

/**
 * Procedural textures generated ONCE at startup. Canvas2D is used only here,
 * never per frame. Everything that glows reuses these.
 */
export interface SharedTextures {
  dot: Texture;
  glow: Texture;
  star: Texture;
  prism: Texture;
  panel: Texture;
  band: Texture;
  bandSolid: Texture;
  script: Texture;
  scriptOrnate: Texture;
}

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function tex(c: HTMLCanvasElement, srgb = false): CanvasTexture {
  const t = new CanvasTexture(c);
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

function radial(size: number, stops: [number, number][]): HTMLCanvasElement {
  const [c, g] = canvas(size);
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  for (const [o, a] of stops) grad.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function createSharedTextures(): SharedTextures {
  const dot = radial(64, [[0, 1], [0.15, 0.9], [0.35, 0.35], [0.7, 0.06], [1, 0]]);
  const glow = radial(256, [[0, 1], [0.12, 0.6], [0.35, 0.18], [0.7, 0.04], [1, 0]]);

  // Four-point star with fine secondary rays.
  const [starC, sg] = canvas(512);
  sg.translate(256, 256);
  sg.globalCompositeOperation = "lighter";
  const ray = (len: number, wid: number, a: number) => {
    sg.save();
    sg.rotate(a);
    const grad = sg.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, `rgba(255,255,255,${a % (Math.PI / 2) === 0 ? 0.95 : 0.4})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    sg.fillStyle = grad;
    sg.beginPath();
    sg.moveTo(0, -wid);
    sg.lineTo(len, 0);
    sg.lineTo(0, wid);
    sg.fill();
    sg.restore();
  };
  for (let i = 0; i < 4; i++) ray(250, 7, (i * Math.PI) / 2);
  const rr = new Rng(7);
  for (let i = 0; i < 28; i++) ray(60 + rr.next() * 140, 1.2, rr.next() * TAU);
  const sglow = sg.createRadialGradient(0, 0, 0, 0, 0, 60);
  sglow.addColorStop(0, "rgba(255,255,255,1)");
  sglow.addColorStop(1, "rgba(255,255,255,0)");
  sg.fillStyle = sglow;
  sg.fillRect(-60, -60, 120, 120);

  // Prismatic halo: a thin rainbow ring (lens dispersion), colors baked in.
  const [prismC, pg] = canvas(512);
  pg.translate(256, 256);
  pg.globalCompositeOperation = "lighter";
  const hues = [0, 30, 55, 120, 190, 230, 275];
  hues.forEach((hue, i) => {
    const r = 170 + i * 9;
    const grad = pg.createRadialGradient(0, 0, r - 26, 0, 0, r + 26);
    grad.addColorStop(0, `hsla(${hue},100%,60%,0)`);
    grad.addColorStop(0.5, `hsla(${hue},100%,62%,0.32)`);
    grad.addColorStop(1, `hsla(${hue},100%,60%,0)`);
    pg.fillStyle = grad;
    pg.beginPath();
    pg.arc(0, 0, r + 26, 0, TAU);
    pg.arc(0, 0, Math.max(0, r - 26), 0, TAU, true);
    pg.fill();
  });

  // Translucent data panel: faint fill, bright border, a few "lines".
  const [panelC, ng] = canvas(256, 160);
  ng.fillStyle = "rgba(255,255,255,0.10)";
  ng.fillRect(0, 0, 256, 160);
  ng.strokeStyle = "rgba(255,255,255,0.95)";
  ng.lineWidth = 4;
  ng.strokeRect(2, 2, 252, 156);
  ng.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < 6; i++) ng.fillRect(18, 22 + i * 20, 60 + ((i * 53) % 150), 6);

  // Armillary ribbon: bright rims + segmented translucent blocks along U.
  const [bandC, bg] = canvas(1024, 64);
  bg.fillStyle = "rgba(255,255,255,0.2)";
  bg.fillRect(0, 0, 1024, 64);
  bg.fillStyle = "rgba(255,255,255,1)";
  bg.fillRect(0, 0, 1024, 8);
  bg.fillRect(0, 56, 1024, 8);
  const br = new Rng(11);
  for (let x = 0; x < 1024; ) {
    const w = 8 + br.int(40);
    if (br.next() < 0.55) {
      bg.fillStyle = `rgba(255,255,255,${0.5 + br.next() * 0.5})`;
      bg.fillRect(x, 14, w, 36);
    }
    x += w + 6 + br.int(18);
  }
  const [solidC, so] = canvas(64, 64);
  so.fillStyle = "rgba(255,255,255,0.18)";
  so.fillRect(0, 0, 64, 64);
  so.fillStyle = "#fff";
  so.fillRect(0, 0, 64, 10);
  so.fillRect(0, 54, 64, 10);

  // Script rings (inner/outer relative to the plane they are mapped on).
  const scriptSize = 2048;
  const [scriptC, scg] = canvas(scriptSize);
  paintScriptRing(scg, scriptSize, SEAL.scriptInner / SEAL.scriptOuter, 0.985, 0x51a6e, false);
  const [ornC, og] = canvas(scriptSize);
  paintScriptRing(og, scriptSize, 0.72, 0.985, 0xa11ce, true);

  const band = tex(bandC);
  band.wrapS = RepeatWrapping;
  const bandSolid = tex(solidC);
  bandSolid.wrapS = RepeatWrapping;
  return {
    dot: tex(dot),
    glow: tex(glow),
    star: tex(starC),
    prism: tex(prismC, true),
    panel: tex(panelC),
    band,
    bandSolid,
    script: tex(scriptC),
    scriptOrnate: tex(ornC),
  };
}
