import { AnimatePresence } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { AUTO_DEMO, FULL_TOUR, MILESTONE_SAMPLE, WARNING_SAMPLES } from "../agent/scenarios";
import { DebugPanel } from "../components/DebugPanel";
import { MilestoneOverlay } from "../components/MilestoneOverlay";
import { StateControls } from "../components/StateControls";
import { SageOverlay } from "../components/SageOverlay";
import { SageActor } from "../hooks/sageActor";
import { useAgentBridges } from "../hooks/useAgentBridges";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { useVisualEngine } from "../hooks/useVisualEngine";
import { SAGE_STATES, type SageState, type ToolModule } from "../machine/events";
import { selectAgentState } from "../machine/selectors";
import { DEFAULT_QUALITY, QUALITY_LEVELS, type QualityLevel } from "../visual/config/quality";
import { toggleFullscreen } from "./fullscreen";
import { eventForState } from "./stateCatalog";

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const actor = SageActor.useActorRef();
  const state = SageActor.useSelector(selectAgentState);
  const [quality, setQuality] = useState<QualityLevel>(DEFAULT_QUALITY);
  const [adaptive, setAdaptive] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [hideUi, setHideUi] = useState(false);
  const [warning, setWarning] = useState<string>(WARNING_SAMPLES[0]);

  const { engine, error: engineError } = useVisualEngine(hostRef, actor, DEFAULT_QUALITY, setQuality);
  const { mock, tauri, demoRunning } = useAgentBridges(actor);

  const select = useCallback(
    (s: SageState, module?: ToolModule) => {
      mock.stop();
      mock.emit(eventForState(s, { warning, module }));
    },
    [mock, warning],
  );
  const autoDemo = useCallback(() => (mock.playing ? mock.stop() : mock.play(AUTO_DEMO)), [mock]);
  const fullTour = useCallback(() => mock.play(FULL_TOUR), [mock]);
  const milestone = useCallback(() => mock.emit(MILESTONE_SAMPLE), [mock]);
  const retry = useCallback(() => mock.emit({ type: "agent.retry" }), [mock]);
  const changeQuality = useCallback(
    (q: QualityLevel) => {
      engine?.setQuality(q);
      setQuality(q);
    },
    [engine],
  );
  const changeAdaptive = useCallback(
    (v: boolean) => {
      engine?.setAdaptive(v);
      setAdaptive(v);
    },
    [engine],
  );

  const keys: Record<string, () => void> = {
    a: autoDemo,
    t: fullTour,
    m: milestone,
    r: retry,
    d: () => setShowDebug((v) => !v),
    c: () => setShowControls((v) => !v),
    h: () => setHideUi((v) => !v),
    f: () => void toggleFullscreen(),
    q: () => changeQuality(QUALITY_LEVELS[(QUALITY_LEVELS.indexOf(quality) + 1) % QUALITY_LEVELS.length]),
    Enter: () => state === "QUESTION" && actor.send({ type: "ui.accept" }),
    Escape: () => state === "QUESTION" && actor.send({ type: "ui.reject" }),
  };
  SAGE_STATES.forEach((s, i) => (keys[String(i + 1)] = () => select(s)));
  useKeyboardControls(keys);

  const native = tauri
    ? {
        echo: () => void tauri.echo({ type: "agent.warning", message: "ROUND-TRIP VIA RUST" }),
        sequence: () => {
          mock.stop();
          void tauri.runNativeSequence();
        },
      }
    : null;

  return (
    <div className={`app ${hideUi ? "app--bare" : ""}`} data-state={state}>
      <div ref={hostRef} className="stage" />
      <div className="ui">
        <div className="brand" data-tauri-drag-region>
          <span className="brand__name">SAGE</span>
          <span className="brand__meta">
            INTERFACE · {tauri ? "NATIVE + MOCK BRIDGE" : "MOCK BRIDGE"} · {quality}
          </span>
        </div>
        {engineError && <div className="engine-error">RENDERER UNAVAILABLE · {engineError}</div>}
        <SageOverlay />
        <MilestoneOverlay />
        <AnimatePresence>
          {showDebug && (
            <DebugPanel
              key="debug"
              engine={engine}
              quality={quality}
              onQuality={changeQuality}
              adaptive={adaptive}
              onAdaptive={changeAdaptive}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showControls && (
            <StateControls
              key="controls"
              onSelect={select}
              onAutoDemo={autoDemo}
              onFullTour={fullTour}
              onMilestone={milestone}
              onRetry={retry}
              demoRunning={demoRunning}
              warning={warning}
              onWarning={setWarning}
              native={native}
            />
          )}
        </AnimatePresence>
        <div className="hints">
          1–8 states · A demo · T tour · M milestone · R retry · D debug · C controls · H hide · F fullscreen · Q quality
        </div>
      </div>
    </div>
  );
}
