import type { UiCue } from "../app/uiCues";
import type { SageState } from "../machine/events";
import type { VisualCue } from "../visual/core/types";
import {
  AMBIENT,
  CHIME,
  COMPUTE,
  GRAIN_NOTES,
  PAD,
  SPARKLE_NOTES,
  type AmbientProfile,
  type ComputeProfile,
  type PadProfile,
} from "./profiles";

const VOICES = 5;
/** Pad: up to 6 chord tones × 2 detuned saws. */
const PAD_NOTES = 6;
const PAD_ROOT = 110; // A2
/** Lookahead scheduler for rhythmic textures (classic Web Audio pattern). */
const SCHEDULE_MS = 50;
const LOOKAHEAD_S = 0.15;

/**
 * Procedural sound for Sage Interface — no audio files, everything is
 * synthesized with the Web Audio API.
 *
 *   ambient drone ──┐
 *   atmosphere pad ─┤  (chorus)
 *   supercomputer ──┼─► buses ─► dry + reverb ─► compressor ─► master ─► out
 *   textures ───────┤
 *   one-shot sfx ───┘
 *
 * It listens to the same semantic cues the renderer emits (VisualEngine.onCue),
 * so every cut, punch and shockwave sounds on the exact frame it is seen.
 * Browsers start audio suspended until a user gesture: call `unlock()` from
 * the first key/click.
 */
export class AudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private sfxBus: GainNode;
  private ambientBus: GainNode;
  private reverbSend: GainNode;
  private grit: WaveShaperNode;
  private gritMix: GainNode;
  private cleanMix: GainNode;
  private filter: BiquadFilterNode;
  private lfoGain: GainNode;
  private lfo: OscillatorNode;
  private voices: { osc: OscillatorNode; gain: GainNode }[] = [];
  private airGain: GainNode;
  private noise: AudioBuffer;
  private profile: AmbientProfile = AMBIENT.READY;
  private state: SageState = "READY";
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextSparkle = 0;
  private nextTick = 0;
  private tickCount = 0;
  // Atmosphere (pad).
  private pad: PadProfile = PAD.READY;
  private padVoices: { a: OscillatorNode; b: OscillatorNode; gain: GainNode }[] = [];
  private padFilter!: BiquadFilterNode;
  private padAmp!: GainNode;
  private padTremDepth!: GainNode;
  private padTrem!: OscillatorNode;
  private chordIndex = 0;
  private nextChord = 0;
  // Supercomputer.
  private compute: ComputeProfile = COMPUTE.READY;
  private computeBus!: GainNode;
  private whirGain!: GainNode;
  private whirBand!: BiquadFilterNode;
  private hissGain!: GainNode;
  private crushCurve!: Float32Array<ArrayBuffer>;
  private nextGrain = 0;
  private grainClock = 0;
  private nextPacket = 0;
  private nextCrush = 0;
  private volume = 0.6;
  private muted = false;
  private started = false;

  constructor() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC({ latencyHint: "interactive" });
    this.ctx = ctx;

    // Output chain.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    comp.connect(this.master).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(3.2, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.55;
    this.reverbSend.connect(reverb).connect(comp);

    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(comp);
    this.sfxBus.connect(this.reverbSend);

    // Ambient: voices → filter (LFO) → clean / saturated mix → bus.
    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = 0;
    this.ambientBus.connect(comp);
    const ambSend = ctx.createGain();
    ambSend.gain.value = 0.35;
    this.ambientBus.connect(ambSend).connect(this.reverbSend);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.8;
    this.filter.frequency.value = this.profile.cutoff;
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = this.profile.lfoRate;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = this.profile.lfoDepth;
    this.lfo.connect(this.lfoGain).connect(this.filter.frequency);

    this.grit = ctx.createWaveShaper();
    this.grit.curve = this.distortionCurve(28);
    this.grit.oversample = "2x";
    this.gritMix = ctx.createGain();
    this.gritMix.gain.value = 0;
    this.cleanMix = ctx.createGain();
    this.filter.connect(this.cleanMix).connect(this.ambientBus);
    this.filter.connect(this.grit).connect(this.gritMix).connect(this.ambientBus);

    for (let i = 0; i < VOICES; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.detune.value = (i % 2 ? 1 : -1) * (3 + i * 2);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.filter);
      this.voices.push({ osc, gain });
    }

    // Air: looped noise through a band-pass (the rush of the tunnel).
    this.noise = this.noiseBuffer(2);
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const airBand = ctx.createBiquadFilter();
    airBand.type = "bandpass";
    airBand.frequency.value = 1800;
    airBand.Q.value = 0.6;
    this.airGain = ctx.createGain();
    this.airGain.gain.value = 0;
    air.connect(airBand).connect(this.airGain).connect(this.ambientBus);

    this.lfo.start();
    for (const v of this.voices) v.osc.start();
    air.start();
    this.buildPad(comp);
    this.buildCompute(comp);
    this.applyProfile(this.profile, 0.01);
    this.applyPad(PAD.READY, 0.01, true);
    this.applyCompute(COMPUTE.READY, 0.01);
  }

  /** Wide chorused pad: saws → low-pass → tremolo → stereo chorus → bus (+ reverb). */
  private buildPad(out: AudioNode): void {
    const ctx = this.ctx;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.Q.value = 0.7;
    this.padAmp = ctx.createGain();
    this.padAmp.gain.value = 1;
    this.padTrem = ctx.createOscillator();
    this.padTrem.type = "sine";
    this.padTremDepth = ctx.createGain();
    this.padTremDepth.gain.value = 0;
    this.padTrem.connect(this.padTremDepth).connect(this.padAmp.gain);
    this.padTrem.start();
    // Slow filter drift so the pad breathes.
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.06;
    const driftDepth = ctx.createGain();
    driftDepth.gain.value = 350;
    drift.connect(driftDepth).connect(this.padFilter.frequency);
    drift.start();

    for (let i = 0; i < PAD_NOTES; i++) {
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = b.type = "sawtooth";
      a.detune.value = -9;
      b.detune.value = 9;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      a.connect(gain);
      b.connect(gain);
      gain.connect(this.padFilter);
      a.start();
      b.start();
      this.padVoices.push({ a, b, gain });
    }
    this.padFilter.connect(this.padAmp);

    // Stereo chorus: two modulated delays hard-panned, plus the dry centre.
    const merger = ctx.createChannelMerger(2);
    for (let ch = 0; ch < 2; ch++) {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = ch ? 0.019 : 0.013;
      const mod = ctx.createOscillator();
      mod.frequency.value = ch ? 0.27 : 0.33;
      const modDepth = ctx.createGain();
      modDepth.gain.value = 0.0035;
      mod.connect(modDepth).connect(delay.delayTime);
      mod.start();
      this.padAmp.connect(delay).connect(merger, 0, ch);
    }
    const padBus = ctx.createGain();
    padBus.gain.value = 0.9;
    this.padAmp.connect(padBus);
    merger.connect(padBus);
    padBus.connect(out);
    const send = ctx.createGain();
    send.gain.value = 0.6;
    padBus.connect(send).connect(this.reverbSend);
  }

  /** Computation layer bus (high-passed, slightly reverberant) + the continuous "whir". */
  private buildCompute(out: AudioNode): void {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 700;
    this.computeBus = ctx.createGain();
    this.computeBus.gain.value = 1.5;
    this.computeBus.connect(hp).connect(out);
    const send = ctx.createGain();
    send.gain.value = 0.25;
    hp.connect(send).connect(this.reverbSend);

    // Whir: noise → narrow band-pass → amplitude-modulated at ~38 Hz (machine flutter).
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.whirBand = ctx.createBiquadFilter();
    this.whirBand.type = "bandpass";
    this.whirBand.Q.value = 5;
    this.whirBand.frequency.value = 1400;
    const am = ctx.createGain();
    am.gain.value = 0.6;
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 38;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.4;
    flutter.connect(flutterDepth).connect(am.gain);
    flutter.start();
    this.whirGain = ctx.createGain();
    this.whirGain.gain.value = 0;
    src.connect(this.whirBand).connect(am).connect(this.whirGain).connect(this.computeBus);
    src.start();

    // Data hiss: high band of noise with a slow, uneven swell.
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = this.noise;
    hissSrc.loop = true;
    hissSrc.playbackRate.value = 0.93;
    const hissBand = ctx.createBiquadFilter();
    hissBand.type = "bandpass";
    hissBand.frequency.value = 7000;
    hissBand.Q.value = 0.7;
    const hissSwell = ctx.createGain();
    hissSwell.gain.value = 0.7;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.19;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.3;
    swell.connect(swellDepth).connect(hissSwell.gain);
    swell.start();
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    hissSrc.connect(hissBand).connect(hissSwell).connect(this.hissGain).connect(this.computeBus);
    hissSrc.start();

    // Staircase curve = bit-depth reduction (crushed digital texture).
    const n = 1024;
    this.crushCurve = new Float32Array(n);
    const steps = 6;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      this.crushCurve[i] = Math.round(x * steps) / steps;
    }
  }

  private applyPad(p: PadProfile, tau: number, immediate = false): void {
    const t = this.ctx.currentTime;
    this.padFilter.frequency.setTargetAtTime(p.cutoff, t, tau);
    this.padTrem.frequency.setTargetAtTime(Math.max(0.01, p.tremolo), t, tau);
    this.padTremDepth.gain.setTargetAtTime(p.tremolo > 0 ? 0.45 : 0, t, tau);
    this.padAmp.gain.setTargetAtTime(p.tremolo > 0 ? 0.55 : 1, t, tau);
    this.chordIndex = 0;
    this.setChord(p.chords[0], immediate ? 0.01 : p.glide, p.gain);
    this.nextChord = t + p.cycle;
  }

  private setChord(chord: number[], glide: number, gain: number): void {
    const t = this.ctx.currentTime;
    this.padVoices.forEach((v, i) => {
      const semi = chord[i];
      if (semi === undefined) {
        v.gain.gain.setTargetAtTime(0, t, glide);
        return;
      }
      const f = PAD_ROOT * 2 ** (semi / 12);
      v.a.frequency.setTargetAtTime(f, t, glide / 3);
      v.b.frequency.setTargetAtTime(f, t, glide / 3);
      // Upper chord tones sit a little lower so the voicing stays warm.
      v.gain.gain.setTargetAtTime(gain / (1 + i * 0.25), t, glide);
    });
  }

  private applyCompute(c: ComputeProfile, tau: number): void {
    const t = this.ctx.currentTime;
    this.whirGain.gain.setTargetAtTime(c.whir, t, tau);
    this.whirBand.frequency.setTargetAtTime(c.whirFreq, t, tau);
    this.hissGain.gain.setTargetAtTime(c.hiss, t, tau);
    this.nextPacket = c.packets > 0 ? t + c.packets * 0.5 : 0;
  }

  // ───────────────────────────────── lifecycle / controls

  /** Must be called from a user gesture (first key/click). Idempotent. */
  async unlock(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume().catch(() => undefined);
    if (!this.started && this.ctx.state === "running") {
      this.started = true;
      this.timer = setInterval(() => this.schedule(), SCHEDULE_MS);
      this.ambientBus.gain.setTargetAtTime(1, this.ctx.currentTime, 1.2);
      this.applyMaster();
    }
  }

  get running(): boolean {
    return this.started && this.ctx.state === "running";
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyMaster();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMaster();
  }

  private applyMaster(): void {
    const target = this.muted ? 0 : this.volume * this.volume; // perceptual curve
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  /** Dev/analysis only: a MediaStream of the master output (for recording and comparison). */
  debugTap(): MediaStream {
    const dest = this.ctx.createMediaStreamDestination();
    this.master.connect(dest);
    return dest.stream;
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    void this.ctx.close();
  }

  // ───────────────────────────────── cues from the renderer

  handle(c: VisualCue): void {
    if (!this.running) {
      if (c.type === "state") this.setState(c.to);
      return;
    }
    switch (c.type) {
      case "state":
        this.setState(c.to);
        if (c.to !== "COMPLETE") this.chime(CHIME[c.to], 0.12);
        // The weight of the entry now comes from the card assembly lock (UiCue).
        if (c.to === "CRITICAL") this.slam(0.8);
        break;
      case "resolve":
        this.chime(CHIME.COMPLETE, 0.02);
        this.boom(0.9);
        this.shimmer(1.6);
        break;
      case "cut":
        this.fizz(0.25);
        break;
      case "punch":
        this.whoosh(Math.min(1, c.amount * 3));
        break;
      case "shock":
        this.boom(c.strength * 0.6);
        break;
      case "flash":
        if (c.amount > 0.8) this.shimmer(0.6);
        break;
      case "pulse":
        this.thump(0.5 + c.strength * 0.4, 48);
        break;
      case "glitch":
        this.glitch(0.4 + c.amount * 0.4, 0.18);
        break;
      case "retry":
        this.glitch(0.9, 0.32);
        this.chime(CHIME.CRITICAL, 0.08);
        break;
      case "retryStep":
        this.glitch(0.6, 0.16);
        this.thump(0.55, c.step === 4 ? 70 : 55);
        break;
      case "milestone":
        if (c.phase === "start") this.ascend(1.85);
        else {
          this.boom(1);
          this.chord([A4 / 2, A4, CS5, E5, A4 * 2, CS5 * 2], 4.5, 0.11);
          this.chime([1760, 2217.5], 0.05);
        }
        break;
      case "module":
        this.blip(1760, 2350, 0.12);
        break;
      case "corrupt":
        this.dataDump(c.duration);
        break;
      case "whiteout":
        this.whiteout(c.rise, c.hold, c.fall);
        break;
      case "danger":
        this.setMachine(c.on);
        if (c.on) this.whoosh(0.6);
        break;
      case "gear":
        this.clunk(c.heavy);
        break;
      case "heartbeat":
        this.thump(0.55, 52);
        this.pending(0.225, () => this.thump(0.33, 46));
        break;
    }
  }

  // ───────────────────────────────── assembly (UiCues from the overlay)

  /**
   * Text being assembled, as in the show: each glyph is "printed" with a short
   * digital buzz — high noise chopped at ~110–130 Hz (measured in the reference:
   * ~125 pulses/s, ~140 ms per burst) — and the word locks with a clack-ping.
   */
  handleUi(c: UiCue): void {
    if (!this.running) return;
    switch (c.type) {
      case "cardFrame":
        this.frameSweep();
        break;
      case "glyph":
        this.zip(c.index, c.tone);
        break;
      case "cardLock":
        this.lock(c.tone);
        break;
      case "key":
        this.keystroke(c.wrong);
        break;
      case "iris":
        this.iris();
        break;
    }
  }

  /** Aperture opening: a fast dry ratchet of blades + an air release. */
  private iris(): void {
    const t = this.now();
    for (let k = 0; k < 8; k++) this.noiseHit(t + k * 0.028, 0.009, 1400 + k * 140, "bandpass", 0.12);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(3800, t + 0.5);
    const g = this.ctx.createGain();
    this.env(g, t, 0.14, 0.18, 0.4);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + 0.7);
  }

  /** A typed latin letter: a dry type-bar click (a wrong key buzzes). */
  private keystroke(wrong: boolean): void {
    const t = this.now();
    this.noiseHit(t, 0.012, wrong ? 2200 : 5200, "bandpass", wrong ? 0.22 : 0.16);
    const [, g] = this.voice(wrong ? "sawtooth" : "square", wrong ? 310 : 2900 + Math.random() * 400, t, 0.03);
    this.env(g, t, wrong ? 0.05 : 0.018, 0.001, wrong ? 0.05 : 0.02);
    g.connect(this.sfxBus);
  }

  /**
   * The frame opening. Besides a soft upward sweep, a "computation" sequence
   * plays while the frame is traced — measured in the show (S2E11 ~11:28.4):
   * flat, gated tones of 30–180 ms on G5/D6/G6/A6/D7, staggered on a fast
   * grid. It is the ethereal, thinking layer under the assembly.
   */
  private frameSweep(): void {
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + 0.16);
    const g = this.ctx.createGain();
    this.env(g, t, 0.06, 0.03, 0.15);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + 0.3);
    this.computeSequence(t, 0.95);
  }

  /** Gated, flat sine tones in a staggered polyrhythm (data being "read"). */
  private computeSequence(t0: number, dur: number): void {
    const notes = [784, 1175, 1568, 1760, 2349];
    const step = 0.045;
    const bus = this.ctx.createGain();
    bus.gain.value = 1;
    const send = this.ctx.createGain();
    send.gain.value = 0.9; // generous reverb: ethereal, not dry
    bus.connect(this.sfxBus);
    bus.connect(send).connect(this.reverbSend);
    notes.forEach((f, voiceIdx) => {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = (voiceIdx / (notes.length - 1)) * 1.2 - 0.6;
      pan.connect(bus);
      // Each voice has its own rhythm: start offset and note lengths differ.
      let t = t0 + voiceIdx * step * (voiceIdx % 2 ? 1 : 0.5);
      while (t < t0 + dur) {
        const len = step * (1 + Math.floor(Math.random() * 4));
        if (Math.random() < 0.62) {
          const osc = this.ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = f;
          const g = this.ctx.createGain();
          const peak = 0.026 / (1 + voiceIdx * 0.15);
          // Flat gate with tiny ramps (no bell decay).
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(peak, t + 0.006);
          g.gain.setValueAtTime(peak, t + len - 0.008);
          g.gain.linearRampToValueAtTime(0, t + len);
          osc.connect(g).connect(pan);
          osc.start(t);
          osc.stop(t + len + 0.01);
        }
        t += len + step * Math.floor(Math.random() * 3);
      }
    });
  }

  /**
   * One glyph printed: a dry, chopped burst (mechanical, not metallic) with a
   * soft mid "tick" of a mechanism engaging, and one flat tone of the chord.
   */
  private zip(index: number, tone: string): void {
    const t = this.now();
    const failure = tone === "failure" || tone === "retry";
    const dur = 0.11 + Math.random() * 0.06;
    const rate = failure ? 70 + Math.random() * 20 : 112 + Math.random() * 18;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = failure ? 1800 : 2800;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = failure ? 5000 : 7000;
    lp.Q.value = 0.5;
    const chop = this.ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = this.ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = rate;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth).connect(chop.gain);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.006);
    g.gain.setValueAtTime(0.2, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.5;
    src.connect(hp).connect(lp).connect(chop).connect(g).connect(pan).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);

    // Mechanism engaging: a short, woody mid click (no ringing partials).
    this.noiseHit(t, 0.014, failure ? 1100 : 1700, "bandpass", 0.2);

    // One flat tone of the chord, climbing glyph by glyph.
    const scale = failure ? [466.2, 440, 415.3, 392] : [1175, 1568, 1760, 2349, 2637];
    const f = scale[Math.min(index, scale.length - 1)];
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0, t);
    tg.gain.linearRampToValueAtTime(failure ? 0.045 : 0.03, t + 0.006);
    tg.gain.setValueAtTime(failure ? 0.045 : 0.03, t + 0.12);
    tg.gain.linearRampToValueAtTime(0, t + 0.14);
    osc.connect(tg).connect(this.sfxBus);
    tg.connect(this.reverbSend);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /** The word locks into place: a dry mechanical clack + a soft thud + a held chord tone. */
  private lock(tone: string): void {
    const t = this.now();
    const failure = tone === "failure" || tone === "retry";
    this.noiseHit(t, 0.01, failure ? 1400 : 2200, "bandpass", 0.32);
    const [thunk, tg] = this.voice("sine", failure ? 130 : 170, t, 0.12);
    thunk.frequency.exponentialRampToValueAtTime(failure ? 60 : 90, t + 0.07);
    this.env(tg, t, 0.38, 0.002, 0.1);
    tg.connect(this.sfxBus);
    // A held, flat tone (G6 / failure: B♭5) blooming into the reverb — mystical, not a bell.
    const f = failure ? 932.3 : tone === "warning" ? 1760 : 1568;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const pg = this.ctx.createGain();
    pg.gain.setValueAtTime(0, t);
    pg.gain.linearRampToValueAtTime(0.045, t + 0.01);
    pg.gain.setValueAtTime(0.045, t + 0.32);
    pg.gain.linearRampToValueAtTime(0, t + 0.42);
    osc.connect(pg).connect(this.sfxBus);
    pg.connect(this.reverbSend);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  /**
   * Corrupted-data interlude: the ambience drops out, a teletype rattles while
   * lines are written, a tape-scrub drags them away, then near silence before
   * the camera whip (its whoosh comes from the punch cue).
   */
  private dataDump(duration: number): void {
    const t0 = this.now();
    const writeEnd = t0 + duration * 0.45;
    const smearEnd = t0 + duration * 0.8;
    // Duck the ambience for the whole interlude.
    this.ambientBus.gain.cancelScheduledValues(t0);
    this.ambientBus.gain.setTargetAtTime(0.12, t0, 0.04);
    this.ambientBus.gain.setTargetAtTime(1, t0 + duration, 0.3);
    // Teletype: dense dry clicks while lines are written.
    for (let t = t0 + duration * 0.12; t < writeEnd; t += 0.018 + Math.random() * 0.02) {
      this.noiseHit(t, 0.008, 3000 + Math.random() * 5000, "bandpass", 0.12 + Math.random() * 0.1);
    }
    // Data stream under the typing.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(4200, t0);
    // Tape-scrub: the band slides down while the lines are dragged.
    bp.frequency.setValueAtTime(4200, writeEnd);
    bp.frequency.exponentialRampToValueAtTime(260, smearEnd);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + duration * 0.2);
    g.gain.setValueAtTime(0.09, writeEnd);
    g.gain.exponentialRampToValueAtTime(0.16, writeEnd + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, smearEnd + 0.06);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random());
    src.stop(smearEnd + 0.1);
  }

  /**
   * White immersion: a bright crescendo while the light rises, near silence
   * in the pure white, and the world fading back in as the white falls away.
   */
  private whiteout(rise: number, hold: number, fall: number): void {
    const t0 = this.now();
    const peak = t0 + rise;
    // Rising air: high-passed noise sweeping up and swelling.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(1500, t0);
    hp.frequency.exponentialRampToValueAtTime(9000, peak);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2, peak);
    g.gain.exponentialRampToValueAtTime(0.0001, peak + 0.12);
    src.connect(hp).connect(g).connect(this.sfxBus);
    src.start(t0);
    src.stop(peak + 0.2);
    // A cluster of high partials swelling with it.
    [1760, 2637, 3520, 5274].forEach((f, i) => {
      const [osc, pg] = this.voice("sine", f, t0, rise + 0.2);
      osc.detune.value = (i - 1.5) * 7;
      pg.gain.setValueAtTime(0.0001, t0);
      pg.gain.exponentialRampToValueAtTime(0.03, peak);
      pg.gain.exponentialRampToValueAtTime(0.0001, peak + 0.15);
      pg.connect(this.sfxBus);
    });
    // Pure white: the world holds its breath.
    this.ambientBus.gain.cancelScheduledValues(t0);
    this.ambientBus.gain.setTargetAtTime(0.05, peak, 0.05);
    this.ambientBus.gain.setTargetAtTime(1, peak + hold, fall * 0.6);
  }

  // ───────────────────────────────── the mechanical seal

  private machine: GainNode | null = null;

  /** Deep metallic drone while a dangerous decision is pending. */
  private setMachine(on: boolean): void {
    const t = this.now();
    if (on && !this.machine) {
      const out = this.ctx.createGain();
      out.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      out.connect(lp).connect(this.sfxBus);
      // Low fundamental + inharmonic "large metal body" partials, slowly beating.
      [
        [41.2, 0.5, "sine"],
        [41.6, 0.35, "sine"],
        [113.7, 0.12, "triangle"],
        [222.5, 0.06, "sine"],
        [346.1, 0.035, "sine"],
      ].forEach(([f, a, type]) => {
        const osc = this.ctx.createOscillator();
        osc.type = type as OscillatorType;
        osc.frequency.value = f as number;
        const g = this.ctx.createGain();
        g.gain.value = a as number;
        osc.connect(g).connect(out);
        osc.start(t);
      });
      out.gain.setTargetAtTime(0.32, t, 0.6);
      this.machine = out;
    } else if (!on && this.machine) {
      const m = this.machine;
      m.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => m.disconnect(), 1500);
      this.machine = null;
    }
  }

  /** One mechanical step of the dial: thud + metal ring + ratchet teeth. */
  private clunk(heavy: boolean): void {
    if (!this.running) return;
    const t = this.now();
    const [thud, tg] = this.voice("sine", heavy ? 95 : 140, t, 0.3);
    thud.frequency.exponentialRampToValueAtTime(heavy ? 38 : 60, t + 0.12);
    this.env(tg, t, heavy ? 0.55 : 0.3, 0.003, heavy ? 0.28 : 0.16);
    tg.connect(this.sfxBus);
    // Metal ring: inharmonic partials with a short decay.
    [1, 2.76, 5.4].forEach((m, i) => {
      const [, g] = this.voice("sine", (heavy ? 410 : 620) * m, t + 0.005, 0.7);
      this.env(g, t + 0.005, (heavy ? 0.05 : 0.035) / (1 + i), 0.002, 0.6 / (1 + i * 0.5));
      g.connect(this.sfxBus);
    });
    // Ratchet: a few quick teeth before the stop.
    for (let k = 0; k < (heavy ? 4 : 2); k++) {
      this.noiseHit(t - 0.09 + k * 0.022, 0.01, 2600, "bandpass", 0.14);
    }
    this.noiseHit(t, 0.05, 900, "lowpass", heavy ? 0.3 : 0.15);
  }

  /** UI feedback (accept / reject / toggles). */
  uiClick(positive = true): void {
    if (!this.running) return;
    this.blip(positive ? 1320 : 660, positive ? 1760 : 440, 0.1);
  }

  // ───────────────────────────────── ambient

  private setState(s: SageState): void {
    if (s === this.state) return;
    this.state = s;
    this.profile = AMBIENT[s];
    const tau = s === "QUESTION" ? 0.25 : s === "CRITICAL" ? 0.12 : 0.6;
    this.applyProfile(this.profile, tau);
    this.pad = PAD[s];
    this.applyPad(this.pad, tau);
    this.compute = COMPUTE[s];
    this.applyCompute(this.compute, tau);
  }

  private applyProfile(p: AmbientProfile, tau: number): void {
    const t = this.ctx.currentTime;
    this.voices.forEach((v, i) => {
      const f = p.notes[i];
      if (f) v.osc.frequency.setTargetAtTime(f, t, tau);
      // Higher voices are quieter; the root carries the weight.
      v.gain.gain.setTargetAtTime(f ? p.gain / (1 + i * 0.55) : 0, t, tau);
    });
    this.filter.frequency.setTargetAtTime(p.cutoff, t, tau);
    this.lfo.frequency.setTargetAtTime(p.lfoRate, t, tau);
    this.lfoGain.gain.setTargetAtTime(p.lfoDepth, t, tau);
    this.airGain.gain.setTargetAtTime(p.air, t, tau);
    this.gritMix.gain.setTargetAtTime(p.grit * 0.35, t, tau);
    this.cleanMix.gain.setTargetAtTime(1 - p.grit * 0.4, t, tau);
  }

  /** Rhythmic textures, scheduled slightly ahead for sample-accurate timing. */
  private schedule(): void {
    const now = this.ctx.currentTime;
    const horizon = now + LOOKAHEAD_S;
    const p = this.profile;
    if (p.sparkle > 0) {
      if (this.nextSparkle < now) this.nextSparkle = now + Math.random() / p.sparkle;
      while (this.nextSparkle < horizon) {
        const f = SPARKLE_NOTES[(Math.random() * SPARKLE_NOTES.length) | 0];
        this.pluck(f, this.nextSparkle, 0.05 + Math.random() * 0.05);
        this.nextSparkle += (0.4 + Math.random() * 1.2) / p.sparkle;
      }
    }
    if (p.tick > 0) {
      if (this.nextTick < now) this.nextTick = now;
      while (this.nextTick < horizon) {
        this.tick(this.nextTick, this.tickCount++ % 4 === 0);
        this.nextTick += 1 / p.tick;
      }
    }

    // Atmosphere: chord progression.
    const pad = this.pad;
    if (pad.chords.length > 1 && now >= this.nextChord) {
      this.chordIndex = (this.chordIndex + 1) % pad.chords.length;
      this.setChord(pad.chords[this.chordIndex], pad.glide, pad.gain);
      this.nextChord = now + pad.cycle;
    }

    // Supercomputer: data chatter (free for thought, clocked for action).
    const c = this.compute;
    if (c.grains > 0) {
      if (c.quantize > 0) {
        if (this.nextGrain < now) this.nextGrain = now;
        while (this.nextGrain < horizon) {
          const step = this.grainClock++;
          // Fire on a fraction of clock steps, accents on the downbeat.
          if (step % 4 === 0 || Math.random() < c.grains / c.quantize / 2) this.grain(this.nextGrain, step % 4 === 0 ? 1 : 0.6);
          this.nextGrain += 1 / c.quantize;
        }
      } else {
        if (this.nextGrain < now) this.nextGrain = now + Math.random() / c.grains;
        while (this.nextGrain < horizon) {
          this.grain(this.nextGrain, 0.4 + Math.random() * 0.6);
          // Bursty: grains clump together like real data traffic.
          this.nextGrain += (Math.random() < 0.7 ? 0.25 : 2.2) * (Math.random() / c.grains) * 2;
        }
      }
    }
    if (c.packets > 0 && this.nextPacket > 0 && now >= this.nextPacket - LOOKAHEAD_S) {
      this.packet(Math.max(now, this.nextPacket));
      this.nextPacket = Math.max(now, this.nextPacket) + c.packets * (0.6 + Math.random() * 0.8);
    }
    if (c.crush > 0) {
      if (this.nextCrush < now) this.nextCrush = now + Math.random() / c.crush;
      while (this.nextCrush < horizon) {
        this.crush(this.nextCrush, 0.04 + Math.random() * 0.12);
        this.nextCrush += (0.3 + Math.random() * 1.4) / c.crush;
      }
    }
  }

  /** One tiny computation blip: in-tune high partial, panned, sometimes a square "bit". */
  private grain(t: number, amount: number): void {
    const f = GRAIN_NOTES[(Math.random() * GRAIN_NOTES.length) | 0] * (Math.random() < 0.15 ? 2 : 1);
    const len = 0.006 + Math.random() * 0.03;
    const [, g] = this.voice(Math.random() < 0.35 ? "square" : "sine", f, t, len);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.8 - 0.9;
    this.env(g, t, 0.08 * amount, 0.001, len);
    g.connect(pan).connect(this.computeBus);
    // Half the grains carry a bright noise tick: the "crunch" of computation.
    if (Math.random() < 0.6) this.noiseHit(t, len * 1.6, 3500 + Math.random() * 5500, "bandpass", 0.32 * amount, pan);
  }

  /** Data packet: a quick run of alternating tones, like a modem handshake. */
  private packet(t0: number): void {
    const n = 6 + ((Math.random() * 10) | 0);
    const lo = 1200 + Math.random() * 600;
    const hi = lo * (1.5 + Math.random() * 0.5);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.2 - 0.6;
    pan.connect(this.computeBus);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.045;
      const [, g] = this.voice("square", Math.random() < 0.5 ? lo : hi, t, 0.035);
      this.env(g, t, 0.022, 0.002, 0.03);
      g.connect(pan);
    }
  }

  /** Bit-crushed noise burst (stress, failure). */
  private crush(t: number, dur: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900 + Math.random() * 3000;
    bp.Q.value = 1.5;
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.crushCurve;
    const g = this.ctx.createGain();
    this.env(g, t, 0.16, 0.002, dur);
    src.connect(bp).connect(shaper).connect(g).connect(this.computeBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ───────────────────────────────── synthesis primitives

  private now(delay = 0): number {
    return this.ctx.currentTime + delay;
  }

  private pending(delay: number, fn: () => void): void {
    setTimeout(fn, delay * 1000);
  }

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number): void {
    const g = gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private voice(type: OscillatorType, f: number, t: number, dur: number): [OscillatorNode, GainNode] {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    const g = this.ctx.createGain();
    osc.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return [osc, g];
  }

  /** Crystalline FM bell — the sound of a voice line appearing. */
  private chime(freqs: number[], delay: number): void {
    freqs.forEach((f, i) => {
      const t = this.now(delay + i * 0.11);
      const [car, g] = this.voice("sine", f, t, 2.6);
      const [mod, mg] = this.voice("sine", f * 3.51, t, 2.6);
      mg.gain.setValueAtTime(f * 1.2, t);
      mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
      mod.disconnect();
      mod.connect(mg).connect(car.frequency);
      const [, g2] = this.voice("sine", f * 2.76, t, 1.4);
      this.env(g, t, 0.13, 0.004, 2.4);
      this.env(g2, t, 0.035, 0.002, 1.1);
      g.connect(this.sfxBus);
      g2.connect(this.sfxBus);
    });
  }

  /** Deep pitch-dropping hit — a kanji card slamming in. */
  private slam(amount: number): void {
    const t = this.now(0.02);
    const [osc, g] = this.voice("sine", 150, t, 0.6);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    this.env(g, t, 0.55 * amount, 0.004, 0.5);
    g.connect(this.sfxBus);
    this.noiseHit(t, 0.03, 2500, "lowpass", 0.25 * amount);
  }

  /** Low impact with sub tail — shockwaves and releases. */
  private boom(amount: number): void {
    if (amount < 0.05) return;
    const t = this.now();
    const [osc, g] = this.voice("sine", 70, t, 1.4);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.1);
    this.env(g, t, 0.5 * amount, 0.006, 1.2);
    g.connect(this.sfxBus);
    this.noiseHit(t, 0.9, 260, "lowpass", 0.18 * amount);
  }

  private thump(amount: number, f: number): void {
    const t = this.now();
    const [osc, g] = this.voice("sine", f * 1.8, t, 0.3);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    this.env(g, t, 0.45 * amount, 0.003, 0.22);
    g.connect(this.sfxBus);
  }

  /** Bright fizz — the white frame of an editing cut. */
  private fizz(amount: number): void {
    this.noiseHit(this.now(), 0.07, 5200, "highpass", amount);
  }

  /** Filtered noise sweep — the camera being thrown. */
  private whoosh(amount: number): void {
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + 0.28);
    const g = this.ctx.createGain();
    this.env(g, t, 0.3 * amount, 0.09, 0.32);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + 0.5);
  }

  /** Airy high shimmer — light, flash, resolution. */
  private shimmer(dur: number): void {
    const t = this.now();
    [2637, 3520, 4186].forEach((f, i) => {
      const [osc, g] = this.voice("sine", f, t + i * 0.04, dur);
      osc.detune.value = (i - 1) * 9;
      this.env(g, t + i * 0.04, 0.025, 0.2, dur);
      g.connect(this.sfxBus);
    });
  }

  /** Digital failure: random square blips and noise chops. */
  private glitch(amount: number, dur: number): void {
    const t0 = this.now();
    const n = Math.round(6 + dur * 30);
    for (let i = 0; i < n; i++) {
      const t = t0 + (i / n) * dur;
      const f = 180 + Math.random() * 2200;
      const len = 0.012 + Math.random() * 0.03;
      const [, g] = this.voice(Math.random() < 0.5 ? "square" : "sawtooth", f, t, len);
      this.env(g, t, 0.06 * amount, 0.001, len);
      g.connect(this.sfxBus);
      if (Math.random() < 0.4) this.noiseHit(t, len, 3000, "bandpass", 0.12 * amount);
    }
  }

  private blip(f0: number, f1: number, amount: number): void {
    const t = this.now();
    const [osc, g] = this.voice("triangle", f0, t, 0.15);
    osc.frequency.exponentialRampToValueAtTime(f1, t + 0.06);
    this.env(g, t, amount, 0.003, 0.12);
    g.connect(this.sfxBus);
  }

  /** Sparse high pluck (thinking texture), panned. */
  private pluck(f: number, t: number, amount: number): void {
    const [, g] = this.voice("sine", f, t, 1);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    this.env(g, t, amount, 0.003, 0.7);
    g.connect(pan).connect(this.sfxBus);
  }

  /** Mechanical clock tick (accented on the beat). */
  private tick(t: number, accent: boolean): void {
    this.noiseHit(t, 0.012, accent ? 2600 : 4200, "bandpass", accent ? 0.16 : 0.08);
    const [, g] = this.voice("square", accent ? 1200 : 2400, t, 0.03);
    this.env(g, t, accent ? 0.02 : 0.01, 0.001, 0.02);
    g.connect(this.sfxBus);
  }

  /** Rising arpeggio while the gold seal is inscribed. */
  private ascend(dur: number): void {
    const notes = [A4 / 2, CS5 / 2, E5 / 2, A4, CS5, E5, A4 * 2, CS5 * 2, E5 * 2];
    notes.forEach((f, i) => {
      const t = this.now((i / notes.length) * dur);
      this.pluck(f, t, 0.06 + (i / notes.length) * 0.05);
    });
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.2);
  }

  private chord(freqs: number[], dur: number, amount: number): void {
    const t = this.now();
    freqs.forEach((f, i) => {
      const [osc, g] = this.voice(i % 2 ? "triangle" : "sine", f, t, dur);
      osc.detune.value = (Math.random() - 0.5) * 8;
      this.env(g, t, amount / (1 + i * 0.3), 0.02, dur);
      g.connect(this.sfxBus);
    });
  }

  private noiseHit(t: number, dur: number, f: number, type: BiquadFilterType, amount: number, dest: AudioNode = this.sfxBus): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    const g = this.ctx.createGain();
    this.env(g, t, amount, 0.002, dur);
    src.connect(filt).connect(g).connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ───────────────────────────────── buffers

  private noiseBuffer(seconds: number): AudioBuffer {
    const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /** Procedural stereo impulse response: decaying noise (a soft, large room). */
  private impulse(seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return b;
  }

  private distortionCurve(k: number): Float32Array<ArrayBuffer> {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}

const A4 = 440;
const CS5 = 554.37;
const E5 = 659.25;
