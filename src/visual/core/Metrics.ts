export interface EngineMetrics {
  fps: number;
  /** Average interval between frames (ms). */
  frameMs: number;
  /** CPU time spent in simulation + render submission (ms). */
  cpuMs: number;
  particles: number;
  drawCalls: number;
  triangles: number;
  width: number;
  height: number;
  resolution: number;
  devicePixelRatio: number;
  renderer: string;
}

/** Rolling frame metrics, averaged over ~0.5 s windows. */
export class Metrics {
  private frames = 0;
  private acc = 0;
  private cpuAcc = 0;
  fps = 0;
  frameMs = 0;
  cpuMs = 0;
  drawCalls = 0;
  triangles = 0;

  endFrame(frameIntervalMs: number, cpuMs: number): void {
    this.frames++;
    this.acc += frameIntervalMs;
    this.cpuAcc += cpuMs;
    if (this.acc >= 500) {
      this.fps = (this.frames * 1000) / this.acc;
      this.frameMs = this.acc / this.frames;
      this.cpuMs = this.cpuAcc / this.frames;
      this.frames = 0;
      this.acc = 0;
      this.cpuAcc = 0;
    }
  }
}
