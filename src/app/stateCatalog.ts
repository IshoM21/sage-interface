import type { AgentEvent, SageState, ToolModule } from "../machine/events";
import { TOOL_MODULES } from "../machine/events";

export interface StateCopy {
  title: string;
  /** Kanji shown on the state card (our own vocabulary, not the anime's skill names). */
  kanji: string;
  /** English line on the card. */
  card: string;
  caption: string;
}

/** Human copy for each state (UI only — the engine never reads this). */
export const STATE_COPY: Record<SageState, StateCopy> = {
  READY: { title: "READY", kanji: "待機", card: "Standing by", caption: "awaiting instruction" },
  LISTENING: { title: "LISTENING", kanji: "聴取", card: "Listening", caption: "receiving input" },
  ANALYZING: { title: "ANALYZING", kanji: "解析", card: "Analyzing", caption: "reading · relating · reasoning" },
  EXECUTING: { title: "EXECUTING", kanji: "実行", card: "Executing", caption: "acting on the workspace" },
  QUESTION: { title: "QUESTION", kanji: "問", card: "Question", caption: "user decision required" },
  COMPLETE: { title: "COMPLETE", kanji: "了", card: "Understood", caption: "result converged" },
  WARNING: { title: "WARNING", kanji: "警告", card: "Warning", caption: "attention required" },
  CRITICAL: { title: "CRITICAL", kanji: "失敗", card: "Failed", caption: "system exception" },
};

/** The voice: one short formal line per state («Notice.» / «Answer.» register). */
export function dialogueFor(state: SageState, ctx: { message: string; summary: string }): string {
  switch (state) {
    case "READY":
      return "Notice. Standing by.";
    case "LISTENING":
      return "Notice. Receiving input.";
    case "ANALYZING":
      return "Answer. Analyzing the request.";
    case "EXECUTING":
      return ctx.message ? `Executing: ${ctx.message}.` : "Executing.";
    case "QUESTION":
      return "Notice. User decision required.";
    case "COMPLETE":
      return `Understood. ${ctx.summary ? capitalize(ctx.summary) : "Analysis complete"}.`;
    case "WARNING":
      return `Warning. ${ctx.message || "Attention required"}.`;
    case "CRITICAL":
      return `Failed. ${ctx.message || "System exception"}`;
  }
}

function capitalize(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export const STATE_KEYS: Record<SageState, string> = {
  READY: "1",
  LISTENING: "2",
  ANALYZING: "3",
  EXECUTING: "4",
  QUESTION: "5",
  COMPLETE: "6",
  WARNING: "7",
  CRITICAL: "8",
};

const TOOL_NAMES: Record<ToolModule, string> = {
  read: "read_file",
  write: "apply_patch",
  exec: "exec_command",
  build: "cargo build",
  test: "npm test",
};

let moduleCursor = -1;

/** The mock AgentEvent that drives the machine into `state`. */
export function eventForState(state: SageState, opts: { warning: string; module?: ToolModule }): AgentEvent {
  switch (state) {
    case "READY":
      return { type: "agent.ready" };
    case "LISTENING":
      return { type: "agent.listening" };
    case "ANALYZING":
      return { type: "agent.analyzing" };
    case "EXECUTING": {
      const m = opts.module ?? TOOL_MODULES[(moduleCursor = (moduleCursor + 1) % TOOL_MODULES.length)];
      return { type: "tool.started", tool: TOOL_NAMES[m] };
    }
    case "QUESTION":
      return { type: "agent.question", message: "ALLOW · read 3 files in src/auth" };
    case "COMPLETE":
      return { type: "agent.completed", summary: "ANALYSIS COMPLETE" };
    case "WARNING":
      return { type: "agent.warning", message: opts.warning };
    case "CRITICAL":
      return { type: "agent.failed", error: "E_PANIC · thread 'main' panicked at src/auth/jwt.rs:88" };
  }
}

export { TOOL_NAMES };

/** Mock of a dangerous approval request (mechanical seal). */
export const DANGER_QUESTION = { type: "agent.question", message: "ALLOW COMMAND · rm -rf ./build", danger: true } as const;
