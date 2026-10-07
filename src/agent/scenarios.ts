import type { AgentEvent } from "../machine/events";

/** One scripted step: emit `event`, then wait `holdMs` before the next. */
export interface ScenarioStep {
  event: AgentEvent;
  holdMs: number;
}

/** READY 2s → LISTENING 2s → ANALYZING 5s → EXECUTING 4s → COMPLETE 3s → READY. */
export const AUTO_DEMO: ScenarioStep[] = [
  { event: { type: "agent.ready" }, holdMs: 2000 },
  { event: { type: "agent.listening" }, holdMs: 2000 },
  { event: { type: "agent.analyzing" }, holdMs: 5000 },
  { event: { type: "tool.started", tool: "read_file" }, holdMs: 1000 },
  { event: { type: "tool.started", tool: "apply_patch" }, holdMs: 1000 },
  { event: { type: "tool.started", tool: "cargo build" }, holdMs: 1000 },
  { event: { type: "tool.started", tool: "npm test" }, holdMs: 1000 },
  { event: { type: "agent.completed", summary: "ANALYSIS COMPLETE" }, holdMs: 4500 },
  { event: { type: "agent.ready" }, holdMs: 0 },
];

/** Longer tour that also shows QUESTION, WARNING and the milestone ceremony. */
export const FULL_TOUR: ScenarioStep[] = [
  { event: { type: "agent.ready" }, holdMs: 2000 },
  { event: { type: "agent.listening" }, holdMs: 2200 },
  { event: { type: "agent.analyzing" }, holdMs: 5000 },
  { event: { type: "tool.started", tool: "read_file" }, holdMs: 1400 },
  { event: { type: "agent.question", message: "ALLOW: rm -rf ./build ?" }, holdMs: 3200 },
  { event: { type: "tool.started", tool: "exec" }, holdMs: 1400 },
  { event: { type: "tool.started", tool: "npm test" }, holdMs: 1400 },
  { event: { type: "agent.retry", attempt: 1 }, holdMs: 3200 },
  { event: { type: "agent.retry", attempt: 2 }, holdMs: 3200 },
  { event: { type: "agent.warning", message: "TEST FAILURE" }, holdMs: 3500 },
  { event: { type: "agent.analyzing" }, holdMs: 3000 },
  { event: { type: "tool.started", tool: "apply_patch" }, holdMs: 1200 },
  { event: { type: "tool.started", tool: "cargo build" }, holdMs: 1200 },
  { event: { type: "agent.completed", summary: "ANALYSIS COMPLETE" }, holdMs: 2600 },
  { event: { type: "agent.milestone", title: "IMPLEMENTATION COMPLETE", subtitle: "JWT AUTH SYSTEM" }, holdMs: 6500 },
  { event: { type: "agent.ready" }, holdMs: 0 },
];

export const WARNING_SAMPLES = ["CONTEXT 87%", "TEST FAILURE", "DESTRUCTIVE OPERATION", "DEPENDENCY CONFLICT"] as const;

export const MILESTONE_SAMPLE: AgentEvent = {
  type: "agent.milestone",
  title: "IMPLEMENTATION COMPLETE",
  subtitle: "JWT AUTH SYSTEM",
};
