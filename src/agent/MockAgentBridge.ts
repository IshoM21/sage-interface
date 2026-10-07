import type { AgentEvent } from "../machine/events";
import { EventHub, type AgentBridge, type AgentEventListener } from "./AgentBridge";
import type { ScenarioStep } from "./scenarios";

/**
 * In-browser fake agent. Emits the exact same `AgentEvent`s a real agent
 * adapter will, either on demand (`emit`) or from a timed script (`play`).
 */
export class MockAgentBridge implements AgentBridge {
  readonly id = "mock";
  private hub = new EventHub();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onScenarioChange?: (running: boolean) => void;

  async connect(): Promise<void> {}

  disconnect(): void {
    this.stop();
  }

  subscribe(listener: AgentEventListener) {
    return this.hub.subscribe(listener);
  }

  emit(event: AgentEvent): void {
    this.hub.emit(event);
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  setScenarioListener(cb: (running: boolean) => void): void {
    this.onScenarioChange = cb;
  }

  play(steps: ScenarioStep[]): void {
    this.stop();
    let i = 0;
    const next = () => {
      const step = steps[i++];
      if (!step) {
        this.timer = null;
        this.onScenarioChange?.(false);
        return;
      }
      this.hub.emit(step.event);
      this.timer = setTimeout(next, step.holdMs);
    };
    this.timer = setTimeout(next, 0);
    this.onScenarioChange?.(true);
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
      this.onScenarioChange?.(false);
    }
  }
}
