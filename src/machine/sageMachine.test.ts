import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { COMPLETE_CONVERGE_MS, COMPLETE_HOLD_MS, sageMachine } from "./sageMachine";
import { selectAgentState, selectCompleteResolved, selectMilestone } from "./selectors";
import { toolToModule } from "./events";

const start = () => createActor(sageMachine).start();

describe("sageMachine", () => {
  it("starts READY", () => {
    expect(selectAgentState(start().getSnapshot())).toBe("READY");
  });

  it("follows the nominal flow", () => {
    const a = start();
    a.send({ type: "agent.listening" });
    expect(selectAgentState(a.getSnapshot())).toBe("LISTENING");
    a.send({ type: "agent.analyzing" });
    expect(selectAgentState(a.getSnapshot())).toBe("ANALYZING");
    a.send({ type: "tool.started", tool: "cargo build" });
    expect(selectAgentState(a.getSnapshot())).toBe("EXECUTING");
    expect(a.getSnapshot().context.activeModule).toBe("build");
    a.send({ type: "agent.completed" });
    expect(selectAgentState(a.getSnapshot())).toBe("COMPLETE");
  });

  it("question accept resumes execution, reject returns to ready", () => {
    const a = start();
    a.send({ type: "agent.question", message: "Run rm -rf build?" });
    expect(selectAgentState(a.getSnapshot())).toBe("QUESTION");
    expect(a.getSnapshot().context.message).toBe("Run rm -rf build?");
    a.send({ type: "ui.accept" });
    expect(selectAgentState(a.getSnapshot())).toBe("EXECUTING");
    a.send({ type: "agent.question", message: "?" });
    a.send({ type: "ui.reject" });
    expect(selectAgentState(a.getSnapshot())).toBe("READY");
  });

  it("ignores accept outside QUESTION", () => {
    const a = start();
    a.send({ type: "ui.accept" });
    expect(selectAgentState(a.getSnapshot())).toBe("READY");
  });

  it("COMPLETE converges, resolves, then auto-returns", () => {
    vi.useFakeTimers();
    const a = start();
    a.send({ type: "agent.completed", summary: "DONE" });
    expect(selectCompleteResolved(a.getSnapshot())).toBe(false);
    vi.advanceTimersByTime(COMPLETE_CONVERGE_MS + 1);
    expect(selectCompleteResolved(a.getSnapshot())).toBe(true);
    vi.advanceTimersByTime(COMPLETE_HOLD_MS + 1);
    expect(selectAgentState(a.getSnapshot())).toBe("READY");
    vi.useRealTimers();
  });

  it("milestone runs in a parallel region without changing the agent state", () => {
    const a = start();
    a.send({ type: "agent.analyzing" });
    a.send({ type: "agent.milestone", title: "IMPLEMENTATION COMPLETE", subtitle: "JWT AUTH SYSTEM" });
    expect(selectAgentState(a.getSnapshot())).toBe("ANALYZING");
    expect(selectMilestone(a.getSnapshot())?.subtitle).toBe("JWT AUTH SYSTEM");
  });

  it("failure and warning carry messages", () => {
    const a = start();
    a.send({ type: "agent.warning", message: "CONTEXT 87%" });
    expect(selectAgentState(a.getSnapshot())).toBe("WARNING");
    a.send({ type: "agent.failed", error: "SEGFAULT" });
    expect(selectAgentState(a.getSnapshot())).toBe("CRITICAL");
    expect(a.getSnapshot().context.message).toBe("SEGFAULT");
  });
});

describe("retry", () => {
  it("counts retries without leaving the current state", () => {
    const a = start();
    a.send({ type: "tool.started", tool: "npm test" });
    a.send({ type: "agent.retry", attempt: 2 });
    a.send({ type: "agent.retry" });
    expect(a.getSnapshot().context.retries).toBe(2);
    expect(selectAgentState(a.getSnapshot())).toBe("EXECUTING");
  });
});

describe("toolToModule", () => {
  it("classifies tool names", () => {
    expect(toolToModule("Read")).toBe("read");
    expect(toolToModule("apply_patch")).toBe("write");
    expect(toolToModule("npm test")).toBe("test");
    expect(toolToModule("bash")).toBe("exec");
  });
});
