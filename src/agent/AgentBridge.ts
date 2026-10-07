import type { AgentEvent } from "../machine/events";

export type AgentEventListener = (event: AgentEvent) => void;
export type Unsubscribe = () => void;

/**
 * A source of semantic agent events.
 *
 * Implementations: `MockAgentBridge` (scripted, in-browser) and
 * `TauriAgentBridge` (events emitted by Rust; later produced by PTY adapters
 * wrapping Codex CLI / Claude Code). Consumers never know which one is active.
 */
export interface AgentBridge {
  readonly id: string;
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(listener: AgentEventListener): Unsubscribe;
}

/** Shared listener bookkeeping for bridge implementations. */
export class EventHub {
  private listeners = new Set<AgentEventListener>();

  subscribe(listener: AgentEventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: AgentEvent): void {
    for (const l of this.listeners) l(event);
  }
}
