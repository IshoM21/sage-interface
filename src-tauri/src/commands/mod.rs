//! Request/response commands exposed to the frontend.

use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;

use crate::agent::{self, AgentEvent};

#[derive(Serialize)]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub os: &'static str,
    pub arch: &'static str,
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: "Sage Interface",
        version: env!("CARGO_PKG_VERSION"),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

/// Round-trips an event through Rust: proves the native → visual pipeline.
#[tauri::command]
pub fn emit_agent_event(app: AppHandle, event: AgentEvent) -> Result<(), String> {
    agent::emit(&app, &event).map_err(|e| e.to_string())
}

/// Emits a short scripted sequence from a native thread, the same way a real
/// agent adapter will (events arrive asynchronously, not from the UI).
#[tauri::command]
pub fn run_mock_sequence(app: AppHandle) {
    std::thread::spawn(move || {
        let steps: [(AgentEvent, u64); 6] = [
            (AgentEvent::Listening, 1500),
            (AgentEvent::Analyzing, 4000),
            (AgentEvent::ToolStarted { tool: "read".into() }, 1200),
            (AgentEvent::ToolStarted { tool: "build".into() }, 1500),
            (AgentEvent::ToolStarted { tool: "test".into() }, 1500),
            (AgentEvent::Completed { summary: Some("NATIVE SEQUENCE".into()) }, 0),
        ];
        for (event, wait_ms) in steps {
            if agent::emit(&app, &event).is_err() {
                return;
            }
            std::thread::sleep(Duration::from_millis(wait_ms));
        }
    });
}

/// Placeholder for the future PTY integration (see `pty` module).
#[tauri::command]
pub fn pty_spawn(
    registry: tauri::State<'_, crate::pty::PtyRegistry>,
    request: crate::pty::PtySpawnRequest,
) -> Result<u32, String> {
    registry.spawn(request)
}
