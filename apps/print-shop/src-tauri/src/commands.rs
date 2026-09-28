use crate::agent::AgentBridge;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub async fn agent_ping(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    bridge.call("agent.ping", json!({})).await
}

#[tauri::command]
pub async fn get_agent_status(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    match bridge.call("agent.status", json!({})).await {
        Ok(value) => Ok(value),
        Err(_) => Ok(bridge.snapshot().await),
    }
}

#[tauri::command]
pub async fn list_printers(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    bridge.call("printers.list", json!({})).await
}

#[tauri::command]
pub async fn get_printer(bridge: State<'_, AgentBridge>, id: String) -> Result<Value, String> {
    bridge.call("printers.get", json!({ "id": id })).await
}

#[tauri::command]
pub async fn refresh_printers(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    bridge.call("printers.refresh", json!({})).await
}

#[tauri::command]
pub async fn enqueue_job(
    bridge: State<'_, AgentBridge>,
    printer_id: Option<String>,
    document_path: Option<String>,
    document_name: Option<String>,
    copies: Option<u32>,
) -> Result<Value, String> {
    bridge
        .call(
            "jobs.enqueue",
            json!({
                "printerId": printer_id,
                "documentPath": document_path,
                "documentName": document_name,
                "copies": copies.unwrap_or(1),
            }),
        )
        .await
}

#[tauri::command]
pub async fn list_jobs(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    bridge.call("jobs.list", json!({})).await
}

#[tauri::command]
pub async fn get_job(bridge: State<'_, AgentBridge>, id: String) -> Result<Value, String> {
    bridge.call("jobs.get", json!({ "id": id })).await
}

#[tauri::command]
pub async fn cancel_job(bridge: State<'_, AgentBridge>, id: String) -> Result<Value, String> {
    bridge.call("jobs.cancel", json!({ "id": id })).await
}

#[tauri::command]
pub async fn shutdown_agent(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    bridge.call("agent.shutdown", json!({})).await
}
