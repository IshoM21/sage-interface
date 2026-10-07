import { useCallback, useEffect, useRef, useState } from "react";
import { uiCues } from "../app/uiCues";
import { AudioEngine } from "../audio/AudioEngine";
import type { VisualEngine } from "../visual/VisualEngine";

const PREFS_KEY = "sage.audio";

interface AudioPrefs {
  muted: boolean;
  volume: number;
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { muted: false, volume: 0.8, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable: use defaults */
  }
  return { muted: false, volume: 0.8 };
}

function savePrefs(p: AudioPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/**
 * Owns the AudioEngine and wires it to the renderer's semantic cues, so sound
 * is frame-synced with the visuals without React in the loop. Audio starts on
 * the first user gesture (browser/WebView autoplay policy).
 */
export function useAudioEngine(engine: VisualEngine | null) {
  const audioRef = useRef<AudioEngine | null>(null);
  const [prefs, setPrefs] = useState<AudioPrefs>(loadPrefs);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const audio = new AudioEngine();
    audioRef.current = audio;
    if (import.meta.env.DEV) (window as unknown as { __sageAudio?: AudioEngine }).__sageAudio = audio;
    const p = loadPrefs();
    audio.setVolume(p.volume);
    audio.setMuted(p.muted);
    const unlock = () => {
      void audio.unlock().then(() => setRunning(audio.running));
    };
    const offUi = uiCues.on((c) => audio.handleUi(c));
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      offUi();
      audio.destroy();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!engine) return;
    return engine.onCue((c) => audioRef.current?.handle(c));
  }, [engine]);

  const update = useCallback((next: Partial<AudioPrefs>) => {
    setPrefs((cur) => {
      const p = { ...cur, ...next };
      audioRef.current?.setMuted(p.muted);
      audioRef.current?.setVolume(p.volume);
      savePrefs(p);
      return p;
    });
  }, []);

  return {
    muted: prefs.muted,
    volume: prefs.volume,
    running,
    setMuted: (muted: boolean) => update({ muted }),
    toggleMuted: () => update({ muted: !prefs.muted }),
    setVolume: (volume: number) => update({ volume }),
  };
}
