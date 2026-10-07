//! Semantic agent event model shared with the frontend.
//!
//! The JSON shape mirrors `src/machine/events.ts` (`AgentEvent`). The visual
//! engine only ever reacts to these events — it knows nothing about Codex or
//! Claude. Future adapters (Codex CLI, Claude Code, Gemini CLI, OpenCode…)
//! translate their own output into this enum.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

/// Name of the Tauri event that carries `AgentEvent` payloads.
pub const AGENT_EVENT: &str = "sage://agent-event";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AgentEvent {
    #[serde(rename = "agent.ready")]
    Ready,
    #[serde(rename = "agent.listening")]
    Listening,
    #[serde(rename = "agent.analyzing")]
    Analyzing,
    #[serde(rename = "tool.started")]
    ToolStarted { tool: String },
    #[serde(rename = "tool.completed")]
    ToolCompleted { tool: String },
    #[serde(rename = "agent.question")]
    Question { message: String },
    #[serde(rename = "agent.warning")]
    Warning { message: String },
    #[serde(rename = "agent.completed")]
    Completed {
        #[serde(skip_serializing_if = "Option::is_none")]
        summary: Option<String>,
    },
    #[serde(rename = "agent.failed")]
    Failed { error: String },
    #[serde(rename = "agent.retry")]
    Retry {
        #[serde(skip_serializing_if = "Option::is_none")]
        attempt: Option<u32>,
    },
    #[serde(rename = "agent.milestone")]
    Milestone { title: String, subtitle: String },
}

/// Emits a semantic event to every webview.
pub fn emit(app: &AppHandle, event: &AgentEvent) -> tauri::Result<()> {
    app.emit(AGENT_EVENT, event)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_frontend_tags() {
        let json = serde_json::to_string(&AgentEvent::ToolStarted { tool: "build".into() }).unwrap();
        assert_eq!(json, r#"{"type":"tool.started","tool":"build"}"#);
        let json = serde_json::to_string(&AgentEvent::Completed { summary: None }).unwrap();
        assert_eq!(json, r#"{"type":"agent.completed"}"#);
    }

    #[test]
    fn deserializes_frontend_payload() {
        let ev: AgentEvent = serde_json::from_str(r#"{"type":"agent.warning","message":"CONTEXT 87%"}"#).unwrap();
        assert!(matches!(ev, AgentEvent::Warning { message } if message == "CONTEXT 87%"));
    }
}
