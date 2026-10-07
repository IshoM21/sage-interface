import { AdditiveBlending, Color, ShaderMaterial, Vector2, type Texture } from "three";
import basicVert from "./basic.vert?raw";
import compositeFrag from "./composite.frag?raw";
import fullscreenVert from "./fullscreen.vert?raw";
import nebulaFrag from "./nebula.frag?raw";
import noise from "./noise.glsl?raw";
import panelFrag from "./panel.frag?raw";
import panelVert from "./panel.vert?raw";
import pointsFrag from "./points.frag?raw";
import pointsVert from "./points.vert?raw";
import scriptFrag from "./script.frag?raw";
import streakFrag from "./streak.frag?raw";
import streakVert from "./streak.vert?raw";

/**
 * Central place where custom GLSL programs are assembled (chunks such as
 * `noise.glsl` are prepended) and their uniforms declared. Systems only write
 * uniform values; programs compile once and are cached by Three.
 */
const withNoise = (src: string) => noise + "\n" + src;

/** Shared flags for every glowing, layered element (additive, no depth). */
const glowing = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: AdditiveBlending,
} as const;

export function nebulaMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: withNoise(nebulaFrag),
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uCenter: { value: new Vector2(0.5, 0.5) },
      uField: { value: new Color() },
      uField2: { value: new Color() },
      uCore: { value: new Color() },
      uDeep: { value: new Color() },
      uIntensity: { value: 0.4 },
      uSwirl: { value: 0.1 },
      uDetail: { value: 4 },
      uWave: { value: -1 },
    },
  });
}

/** mode 0 = tunnel speed lines, 1 = falling light rain. */
export function streakMaterial(mode: 0 | 1): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: streakVert,
    fragmentShader: streakFrag,
    ...glowing,
    uniforms: {
      uTravel: { value: 0 },
      uWidth: { value: 0.03 },
      uStretch: { value: 1 },
      uMode: { value: mode },
      uFocus: { value: -4 },
      uRange: { value: new Vector2() },
      uColor: { value: new Color() },
      uOpacity: { value: 0 },
    },
  });
}

export function panelMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: panelVert,
    fragmentShader: panelFrag,
    ...glowing,
    uniforms: {
      uTravel: { value: 0 },
      uRange: { value: new Vector2() },
      uMap: { value: map },
      uColor: { value: new Color() },
      uOpacity: { value: 0 },
      uFocus: { value: -4 },
    },
  });
}

export function pointsMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: pointsVert,
    fragmentShader: pointsFrag,
    ...glowing,
    uniforms: {
      uMap: { value: map },
      uPixelRatio: { value: 1 },
      uScale: { value: 300 },
      uTime: { value: 0 },
      uTwinkle: { value: 0 },
      uOpacity: { value: 1 },
    },
  });
}

export function scriptMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: basicVert,
    fragmentShader: scriptFrag,
    ...glowing,
    uniforms: {
      uMap: { value: map },
      uColor: { value: new Color() },
      uOpacity: { value: 0 },
      uReveal: { value: 0 },
      uStart: { value: Math.PI / 2 },
    },
  });
}

/** Composite post pass definition (consumed by ShaderPass). */
export function compositeShader() {
  return {
    name: "SageComposite",
    vertexShader: basicVert,
    fragmentShader: withNoise(compositeFrag),
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uCenter: { value: new Vector2(0.5, 0.5) },
      uTiles: { value: 1 },
      uShockR: { value: -1 },
      uShockWidth: { value: 0.05 },
      uShockStrength: { value: 0 },
      uAberration: { value: 0 },
      uGlitch: { value: 0 },
      uInvert: { value: 0 },
      uInvertInk: { value: new Color(0xd0202e) },
      uFlash: { value: 0 },
      uCut: { value: 0 },
      uCutColor: { value: new Color(1, 1, 1) },
      uFlashColor: { value: new Color() },
      uGrain: { value: 0.02 },
      uVignette: { value: 0.7 },
    },
  };
}
