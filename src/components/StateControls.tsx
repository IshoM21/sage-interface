import { motion } from "motion/react";
import { MILESTONE_SAMPLE, WARNING_SAMPLES } from "../agent/scenarios";
import { STATE_KEYS } from "../app/stateCatalog";
import { SageActor } from "../hooks/sageActor";
import { SAGE_STATES, TOOL_MODULES, type SageState, type ToolModule } from "../machine/events";
import { selectActiveModule, selectAgentState, selectAutoReturn } from "../machine/selectors";

interface Props {
  onSelect: (state: SageState, module?: ToolModule) => void;
  onAutoDemo: () => void;
  onFullTour: () => void;
  onMilestone: () => void;
  onRetry: () => void;
  onDanger: () => void;
  sound: { muted: boolean; volume: number; toggleMuted: () => void; setVolume: (v: number) => void };
  demoRunning: boolean;
  warning: string;
  onWarning: (w: string) => void;
  native: { echo: () => void; sequence: () => void } | null;
}

/** Development panel: manual state selection, scenarios and mock payloads. */
export function StateControls(p: Props) {
  const state = SageActor.useSelector(selectAgentState);
  const activeModule = SageActor.useSelector(selectActiveModule);
  const autoReturn = SageActor.useSelector(selectAutoReturn);
  const actor = SageActor.useActorRef();

  return (
    <motion.aside
      className="panel controls"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.35 }}
    >
      <header className="panel__head">STATES</header>
      <div className="controls__grid">
        {SAGE_STATES.map((s) => (
          <button key={s} className={`chip ${state === s ? "chip--on" : ""}`} data-state={s} onClick={() => p.onSelect(s)}>
            <kbd>{STATE_KEYS[s]}</kbd>
            {s}
          </button>
        ))}
      </div>

      <header className="panel__head">MODULE</header>
      <div className="controls__row">
        {TOOL_MODULES.map((m) => (
          <button
            key={m}
            className={`chip chip--small ${state === "EXECUTING" && activeModule === m ? "chip--on" : ""}`}
            onClick={() => p.onSelect("EXECUTING", m)}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <header className="panel__head">WARNING PAYLOAD</header>
      <select className="select" value={p.warning} onChange={(e) => p.onWarning(e.target.value)}>
        {WARNING_SAMPLES.map((w) => (
          <option key={w}>{w}</option>
        ))}
      </select>

      <header className="panel__head">SCENARIOS</header>
      <div className="controls__row">
        <button className={`btn btn--wide ${p.demoRunning ? "btn--live" : ""}`} onClick={p.onAutoDemo}>
          {p.demoRunning ? "■ STOP" : "▶ AUTO DEMO"} <kbd>A</kbd>
        </button>
      </div>
      <div className="controls__row">
        <button className="btn" onClick={p.onFullTour}>
          FULL TOUR <kbd>T</kbd>
        </button>
        <button className="btn" onClick={p.onMilestone} title={`${MILESTONE_SAMPLE.type}`}>
          MILESTONE <kbd>M</kbd>
        </button>
      </div>
      <div className="controls__row">
        <button className="btn" onClick={p.onRetry} title="agent.retry">
          RETRY <kbd>R</kbd>
        </button>
        <button className="btn" onClick={p.onDanger} title="agent.question { danger: true }">
          DANGER <kbd>9</kbd>
        </button>
      </div>
      <header className="panel__head">SOUND</header>
      <div className="controls__row controls__sound">
        <button className={`chip chip--small ${p.sound.muted ? "" : "chip--on"}`} onClick={p.sound.toggleMuted}>
          <kbd>S</kbd>
          {p.sound.muted ? "OFF" : "ON"}
        </button>
        <input
          className="range"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={p.sound.volume}
          aria-label="Volume"
          onChange={(e) => p.sound.setVolume(Number(e.target.value))}
        />
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={autoReturn}
          onChange={(e) => actor.send({ type: "ui.setAutoReturn", value: e.target.checked })}
        />
        COMPLETE → READY
      </label>

      {p.native && (
        <>
          <header className="panel__head">NATIVE BRIDGE (RUST)</header>
          <div className="controls__row">
            <button className="btn" onClick={p.native.echo}>ECHO EVENT</button>
            <button className="btn" onClick={p.native.sequence}>RUST SEQUENCE</button>
          </div>
        </>
      )}
    </motion.aside>
  );
}
