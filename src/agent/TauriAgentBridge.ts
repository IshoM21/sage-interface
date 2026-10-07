import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AgentEvent } from "../machine/events";
import { EventHub, type AgentBridge, type AgentEventListener } from "./AgentBridge";

/** Must match `agent::AGENT_EVENT` in Rust. */
export const AGENT_EVENT_CHANNEL = "sage://agent-event";

/**
 * Receives semantic events emitted by the Rust backend.
 *
 * Today Rust only re-emits events (`emit_agent_event`) or plays a native mock
 * sequence (`run_mock_sequence`). Later, PTY adapters for Codex CLI / Claude
 * Code will call `agent::emit` and this bridge will not change.
 */
export class TauriAgentBridge implements AgentBridge {
  readonly id = "tauri";
  private hub = new EventHub();
  private unlisten: UnlistenFn | null = null;

  static available(): boolean {
    return isTauri();
  }

  async connect(): Promise<void> {
    if (!isTauri() || this.unlisten) return;
    this.unlisten = await listen<AgentEvent>(AGENT_EVENT_CHANNEL, (e) => this.hub.emit(e.payload));
  }

  disconnect(): void {
    this.unlisten?.();
    this.unlisten = null;
  }

  subscribe(listener: AgentEventListener) {
    return this.hub.subscribe(listener);
  }

  /** Round-trip an event through Rust (validates the native pipeline). */
  echo(event: AgentEvent): Promise<void> {
    return invoke("emit_agent_event", { event });
  }

  runNativeSequence(): Promise<void> {
    return invoke("run_mock_sequence");
  }
}
