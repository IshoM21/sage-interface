import { isTauri } from "@tauri-apps/api/core";

/** Toggles native fullscreen in Tauri, DOM fullscreen in a browser. */
export async function toggleFullscreen(): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.setFullscreen(!(await win.isFullscreen()));
    return;
  }
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}
