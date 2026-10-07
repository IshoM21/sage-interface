import { useEffect, useRef } from "react";

export type KeyHandlers = Record<string, (e: KeyboardEvent) => void>;

/** Global shortcuts; ignores typing in inputs. Handlers may change every render. */
export function useKeyboardControls(handlers: KeyHandlers): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const h = ref.current[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (h) {
        e.preventDefault();
        h(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
