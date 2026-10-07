import { assign, setup } from "xstate";
import { toolToModule, type SageEvent, type ToolModule } from "./events";

export interface Milestone {
  title: string;
  subtitle: string;
}

export interface SageContext {
  /** Message for QUESTION / WARNING / CRITICAL. */
  message: string;
  summary: string;
  activeModule: ToolModule | null;
  completedModules: ToolModule[];
  milestone: Milestone | null;
  /** Monotonic retry counter (each `agent.retry` plays the "repeating attempt" beat). */
  retries: number;
  /** COMPLETE returns to READY automatically after a few seconds. */
  autoReturn: boolean;
}

/** Duration of the convergence choreography before COMPLETE text appears. */
export const COMPLETE_CONVERGE_MS = 1250;
export const COMPLETE_HOLD_MS = 3200;
export const MILESTONE_MS = 5600;

/**
 * Sage state machine.
 *
 * Parallel root:
 * - `agent`: the eight primary states. Every agent event is accepted from any
 *   state (agents are external and authoritative); the visual engine derives
 *   everything from the resulting state + context.
 * - `overlay`: rare, independent ceremonies (MILESTONE / SKILL ACQUIRED).
 */
export const sageMachine = setup({
  types: {
    context: {} as SageContext,
    events: {} as SageEvent,
  },
  actions: {
    clearTask: assign({ activeModule: null, completedModules: [], message: "" }),
  },
  guards: {
    autoReturn: ({ context }) => context.autoReturn,
  },
}).createMachine({
  id: "sage",
  type: "parallel",
  context: {
    message: "",
    summary: "",
    activeModule: null,
    completedModules: [],
    milestone: null,
    retries: 0,
    autoReturn: true,
  },
  on: {
    "ui.setAutoReturn": { actions: assign({ autoReturn: ({ event }) => event.value }) },
    "agent.retry": { actions: assign({ retries: ({ context }) => context.retries + 1 }) },
  },
  states: {
    agent: {
      initial: "ready",
      on: {
        "agent.ready": { target: ".ready", actions: "clearTask" },
        "agent.listening": { target: ".listening" },
        "agent.analyzing": { target: ".analyzing", actions: assign({ message: "" }) },
        "tool.started": {
          target: ".executing",
          actions: assign({
            activeModule: ({ event }) => toolToModule(event.tool),
            message: ({ event }) => event.tool,
          }),
        },
        "tool.completed": {
          actions: assign({
            completedModules: ({ context, event }) => {
              const m = toolToModule(event.tool);
              return context.completedModules.includes(m)
                ? context.completedModules
                : [...context.completedModules, m];
            },
          }),
        },
        "agent.question": { target: ".question", actions: assign({ message: ({ event }) => event.message }) },
        "agent.warning": { target: ".warning", actions: assign({ message: ({ event }) => event.message }) },
        "agent.failed": { target: ".critical", actions: assign({ message: ({ event }) => event.error }) },
        "agent.completed": {
          target: ".complete",
          actions: assign({ summary: ({ event }) => event.summary ?? "ANALYSIS COMPLETE" }),
        },
      },
      states: {
        ready: {},
        listening: {},
        analyzing: {},
        executing: {},
        question: {
          on: {
            "ui.accept": { target: "executing", actions: assign({ message: "" }) },
            "ui.reject": { target: "ready", actions: "clearTask" },
          },
        },
        complete: {
          initial: "converging",
          states: {
            converging: { after: { [COMPLETE_CONVERGE_MS]: "resolved" } },
            resolved: {
              after: {
                [COMPLETE_HOLD_MS]: { guard: "autoReturn", target: "#sage.agent.ready", actions: "clearTask" },
              },
            },
          },
        },
        warning: {},
        critical: {},
      },
    },
    overlay: {
      initial: "idle",
      states: {
        idle: {
          on: {
            "agent.milestone": {
              target: "milestone",
              actions: assign({ milestone: ({ event }) => ({ title: event.title, subtitle: event.subtitle }) }),
            },
          },
        },
        milestone: {
          after: { [MILESTONE_MS]: { target: "idle", actions: assign({ milestone: null }) } },
        },
      },
    },
  },
});
