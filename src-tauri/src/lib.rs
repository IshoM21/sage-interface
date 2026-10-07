//! Sage Interface native shell.
//!
//! Rust never touches frame data. It only:
//! - answers request/response commands (`commands`),
//! - emits small *semantic* agent events (`agent`),
//! - (future) owns PTY sessions running Codex CLI / Claude Code (`pty`),
//!   streaming bytes to the frontend through Tauri Channels.

mod agent;
mod commands;
mod pty;

use tauri::{LogicalSize, Manager, PhysicalSize, WindowEvent};

/// Preferred window size (landscape, 16:9). Minimum is 720×720 (tauri.conf.json).
const PREFERRED: (f64, f64) = (1280.0, 720.0);
/// Fraction of the monitor the window may occupy at most on first open.
const MAX_SCREEN_FRACTION: f64 = 0.9;

/// Opens the main window at 1280×720, scaled down (keeping 16:9) when the
/// screen is smaller, centred, then shows it — so it never opens cut off.
fn fit_main_window(app: &tauri::App) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window("main") else { return Ok(()) };
    if let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) {
        let scale = monitor.scale_factor();
        let screen = monitor.size().to_logical::<f64>(scale);
        let k = (screen.height * MAX_SCREEN_FRACTION / PREFERRED.1)
            .min(screen.width * MAX_SCREEN_FRACTION / PREFERRED.0)
            .min(1.0);
        window.set_size(LogicalSize::new(PREFERRED.0 * k, PREFERRED.1 * k))?;
        window.center()?;
    }
    window.show()?;
    window.set_focus()?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            fit_main_window(app)?;
            Ok(())
        })
        // Always landscape or square: if a resize makes it taller than wide, square it.
        .on_window_event(|window, event| {
            if let WindowEvent::Resized(size) = event {
                if size.height > size.width {
                    let _ = window.set_size(PhysicalSize::new(size.width, size.width));
                }
            }
        })
        .manage(pty::PtyRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::emit_agent_event,
            commands::run_mock_sequence,
            commands::pty_spawn,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sage Interface");
}
