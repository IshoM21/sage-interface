//! PTY integration — prepared, not implemented yet.
//!
//! Target architecture:
//!
//! ```text
//! xterm.js ──(invoke pty_write / pty_resize)──▶ Rust
//! xterm.js ◀──(tauri::ipc::Channel<PtyChunk>)── Rust ◀── portable-pty ◀── codex / claude
//!                                                 │
//!                                                 └─ AgentAdapter parses output ─▶ agent::emit(AgentEvent)
//! ```
//!
//! - Raw terminal bytes go through a per-session `Channel` (high volume, ordered).
//! - Semantic `AgentEvent`s go through `agent::emit` (small, infrequent).
//! - The visual engine never sees terminal bytes.
//!
//! Next step: add `portable-pty` and implement `PtyRegistry::spawn` using
//! `native_pty_system().openpty(...)`, a reader thread that pushes `PtyChunk`s
//! into the channel, and an `AgentAdapter` trait per CLI.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct PtySpawnRequest {
    /// Which agent to launch: "codex" | "claude" | "shell".
    pub agent: String,
    pub cwd: Option<String>,
    pub cols: u16,
    pub rows: u16,
}

/// A chunk of terminal output, streamed through a Tauri Channel (future).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct PtyChunk {
    pub session: u32,
    pub data: Vec<u8>,
}

/// Translates a CLI's output stream into semantic events (future).
#[allow(dead_code)]
pub trait AgentAdapter: Send {
    fn name(&self) -> &'static str;
    fn feed(&mut self, bytes: &[u8]) -> Vec<crate::agent::AgentEvent>;
}

#[derive(Default)]
pub struct PtyRegistry {
    next_id: Mutex<u32>,
}

impl PtyRegistry {
    pub fn spawn(&self, request: PtySpawnRequest) -> Result<u32, String> {
        let mut id = self.next_id.lock().map_err(|e| e.to_string())?;
        *id += 1;
        Err(format!(
            "PTY not implemented yet (requested agent '{}', session {}). See src-tauri/src/pty/mod.rs",
            request.agent, *id
        ))
    }
}
