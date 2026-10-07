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

pub fn run() {
    tauri::Builder::default()
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
