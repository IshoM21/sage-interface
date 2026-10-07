import type { SnapshotFrom } from "xstate";
import type { SageState } from "./events";
import type { sageMachine } from "./sageMachine";

export type SageSnapshot = SnapshotFrom<typeof sageMachine>;

const MAP: Record<string, SageState> = {
  ready: "READY",
  listening: "LISTENING",
  analyzing: "ANALYZING",
  executing: "EXECUTING",
  question: "QUESTION",
  complete: "COMPLETE",
  warning: "WARNING",
  critical: "CRITICAL",
};

export function selectAgentState(s: SageSnapshot): SageState {
  const value = s.value as { agent: string | Record<string, string> };
  const key = typeof value.agent === "string" ? value.agent : Object.keys(value.agent)[0];
  return MAP[key] ?? "READY";
}

export const selectCompleteResolved = (s: SageSnapshot) => s.matches({ agent: { complete: "resolved" } });
export const selectMilestone = (s: SageSnapshot) => (s.matches({ overlay: "milestone" }) ? s.context.milestone : null);
export const selectMessage = (s: SageSnapshot) => s.context.message;
export const selectSummary = (s: SageSnapshot) => s.context.summary;
export const selectActiveModule = (s: SageSnapshot) => s.context.activeModule;
export const selectAutoReturn = (s: SageSnapshot) => s.context.autoReturn;
export const selectRetries = (s: SageSnapshot) => s.context.retries;
