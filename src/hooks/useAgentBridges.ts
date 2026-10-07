import { useEffect, useMemo, useState } from "react";
import type { Actor } from "xstate";
import { MockAgentBridge } from "../agent/MockAgentBridge";
import { TauriAgentBridge } from "../agent/TauriAgentBridge";
import type { sageMachine } from "../machine/sageMachine";

/**
 * Connects every available AgentBridge to the machine. Bridges only emit
 * semantic AgentEvents; the machine is the single place they are interpreted.
 */
export function useAgentBridges(actor: Actor<typeof sageMachine>) {
  const mock = useMemo(() => new MockAgentBridge(), []);
  const tauri = useMemo(() => (TauriAgentBridge.available() ? new TauriAgentBridge() : null), []);
  const [demoRunning, setDemoRunning] = useState(false);

  useEffect(() => {
    mock.setScenarioListener(setDemoRunning);
    const bridges = [mock, ...(tauri ? [tauri] : [])];
    const subs = bridges.map((b) => b.subscribe((event) => actor.send(event)));
    bridges.forEach((b) => void b.connect());
    return () => {
      subs.forEach((u) => u());
      bridges.forEach((b) => b.disconnect());
    };
  }, [actor, mock, tauri]);

  return { mock, tauri, demoRunning };
}
