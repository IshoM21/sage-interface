/**
 * Semantic event model.
 *
 * `AgentEvent` is the ONLY vocabulary agents (mock, Rust, Codex, Claude Code…)
 * use to talk to the interface. Rust mirrors it in `src-tauri/src/agent/mod.rs`.
 * Neither the state machine nor the visual engine know which agent is behind it.
 */

export type ToolModule = "read" | "write" | "exec" | "build" | "test";

export const TOOL_MODULES: readonly ToolModule[] = ["read", "write", "exec", "build", "test"];

export type AgentEvent =
  | { type: "agent.ready" }
  | { type: "agent.listening" }
  | { type: "agent.analyzing" }
  | { type: "tool.started"; tool: string }
  | { type: "tool.completed"; tool: string }
  /** `danger`: the agent asks to run something destructive (rm -rf, force push…). */
  | { type: "agent.question"; message: string; danger?: boolean }
  | { type: "agent.warning"; message: string }
  | { type: "agent.completed"; summary?: string }
  | { type: "agent.failed"; error: string }
  | { type: "agent.retry"; attempt?: number }
  | { type: "agent.milestone"; title: string; subtitle: string };

/** Events produced by the local UI (user decisions, settings). */
export type UiEvent =
  | { type: "ui.accept" }
  | { type: "ui.reject" }
  | { type: "ui.setAutoReturn"; value: boolean };

export type SageEvent = AgentEvent | UiEvent;

export type SageState =
  | "READY"
  | "LISTENING"
  | "ANALYZING"
  | "EXECUTING"
  | "QUESTION"
  | "COMPLETE"
  | "WARNING"
  | "CRITICAL";

export const SAGE_STATES: readonly SageState[] = [
  "READY",
  "LISTENING",
  "ANALYZING",
  "EXECUTING",
  "QUESTION",
  "COMPLETE",
  "WARNING",
  "CRITICAL",
];

/** Maps arbitrary tool names reported by agents onto the five visual modules. */
export function toolToModule(tool: string): ToolModule {
  const t = tool.toLowerCase();
  if (/(write|edit|patch|apply|create|save)/.test(t)) return "write";
  if (/(build|compile|bundle|cargo|tsc)/.test(t)) return "build";
  if (/(test|spec|vitest|jest|pytest)/.test(t)) return "test";
  if (/(read|open|cat|grep|search|glob|ls|view|fetch)/.test(t)) return "read";
  return "exec";
}
