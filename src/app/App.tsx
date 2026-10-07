import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_DEMO, FULL_TOUR, MILESTONE_SAMPLE, WARNING_SAMPLES } from "../agent/scenarios";
import { DebugPanel } from "../components/DebugPanel";
import { IdentityIntro } from "../components/IdentityIntro";
import { IDENTITY } from "../config/identity";
import { MilestoneOverlay } from "../components/MilestoneOverlay";
import { StateControls } from "../components/StateControls";
import { SageOverlay } from "../components/SageOverlay";
import { SageActor } from "../hooks/sageActor";
import { useAgentBridges } from "../hooks/useAgentBridges";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { useVisualEngine } from "../hooks/useVisualEngine";
import { SAGE_STATES, type SageState, type ToolModule } from "../machine/events";
import { selectAgentState } from "../machine/selectors";
import { DEFAULT_QUALITY, QUALITY_LEVELS, type QualityLevel } from "../visual/config/quality";
import { toggleFullscreen } from "./fullscreen";
import { DANGER_QUESTION, eventForState } from "./stateCatalog";

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const actor = SageActor.useActorRef();
  const state = SageActor.useSelector(selectAgentState);
  const [quality, setQuality] = useState<QualityLevel>(DEFAULT_QUALITY);
  const [adaptive, setAdaptive] = useState(false);
  // Dev panels start hidden in narrow (companion-size) windows; D / C toggle them.
  const roomy = typeof window !== "undefined" && window.innerWidth >= 1000;
  const [showDebug, setShowDebug] = useState(roomy);
  const [showControls, setShowControls] = useState(roomy);
  const [hideUi, setHideUi] = useState(false);
  const [warning, setWarning] = useState<string>(WARNING_SAMPLES[0]);
  // Identity sequence: plays once at boot (and on demand with I).
  const [identityRun, setIdentityRun] = useState(1);
  const [showIdentity, setShowIdentity] = useState(true);
  const appRef = useRef<HTMLDivElement>(null);

  const { engine, error: engineError } = useVisualEngine(hostRef, actor, DEFAULT_QUALITY, setQuality);
  const { mock, tauri, demoRunning } = useAgentBridges(actor);
  const sound = useAudioEngine(engine);

  // Scene glitch bursts also tear the text (class toggled on the DOM, no React render).
  useEffect(() => {
    if (!engine) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = engine.onCue((c) => {
      if (c.type !== "glitch" && c.type !== "retry") return;
      const el = appRef.current;
      if (!el) return;
      el.classList.remove("text-glitch");
      void el.offsetWidth; // restart the CSS animation
      el.classList.add("text-glitch");
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove("text-glitch"), 180);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [engine]);

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
  const dangerQuestion = useCallback(() => {
    mock.stop();
    mock.emit(DANGER_QUESTION);
  }, [mock]);
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
    "9": dangerQuestion,
    s: sound.toggleMuted,
    i: () => {
      setIdentityRun((n) => n + 1);
      setShowIdentity(true);
    },
    d: () => setShowDebug((v) => !v),
    c: () => setShowControls((v) => !v),
    h: () => setHideUi((v) => !v),
    f: () => void toggleFullscreen(),
    q: () => changeQuality(QUALITY_LEVELS[(QUALITY_LEVELS.indexOf(quality) + 1) % QUALITY_LEVELS.length]),
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
    <div ref={appRef} className={`app ${hideUi ? "app--bare" : ""}`} data-state={state}>
      <div ref={hostRef} className="stage" />
      <div className="ui">
        {/* The title bar is hidden (overlay style): this strip is the window's drag handle. */}
        <div className="drag-strip" data-tauri-drag-region />
        <div className="brand">
          <span className="brand__name">{IDENTITY.brand}</span>
          <span className="brand__meta">
            INTERFACE · {tauri ? "NATIVE + MOCK BRIDGE" : "MOCK BRIDGE"} · {quality} ·{" "}
            {sound.muted ? "SOUND OFF" : sound.running ? "SOUND ON" : "SOUND · PRESS ANY KEY"}
          </span>
        </div>
        {engineError && <div className="engine-error">RENDERER UNAVAILABLE · {engineError}</div>}
        <SageOverlay />
        <MilestoneOverlay />
        <AnimatePresence>
          {showIdentity && <IdentityIntro key={identityRun} onDone={() => setShowIdentity(false)} />}
        </AnimatePresence>
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
              onDanger={dangerQuestion}
              sound={sound}
              demoRunning={demoRunning}
              warning={warning}
              onWarning={setWarning}
              native={native}
            />
          )}
        </AnimatePresence>
        <div className="hints">
          1–8 states · 9 danger · A demo · T tour · M milestone · R retry · S sound · I identity · D debug · C controls · H hide · F fullscreen · Q quality
        </div>
      </div>
    </div>
  );
}
