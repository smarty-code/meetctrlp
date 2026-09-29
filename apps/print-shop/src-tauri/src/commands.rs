use crate::agent::log;
use crate::agent::AgentBridge;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub async fn agent_ping(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    traced(&bridge, "agent_ping", "agent.ping", json!({})).await
}

#[tauri::command]
pub async fn get_agent_status(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    match traced(&bridge, "get_agent_status", "agent.status", json!({})).await {
        Ok(value) => Ok(value),
        Err(error) => {
            let snapshot = bridge.snapshot().await;
            log::write(
                "command",
                format!("get_agent_status fallback snapshot={snapshot} error={error}"),
            );
            Ok(snapshot)
        }
    }
}

#[tauri::command]
pub async fn list_printers(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    traced(&bridge, "list_printers", "printers.list", json!({})).await
}

#[tauri::command]
pub async fn get_printer(bridge: State<'_, AgentBridge>, id: String) -> Result<Value, String> {
    traced(
        &bridge,
        "get_printer",
        "printers.get",
        json!({ "id": id }),
    )
    .await
}

#[tauri::command]
pub async fn refresh_printers(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    traced(&bridge, "refresh_printers", "printers.refresh", json!({})).await
}

#[tauri::command]
pub async fn enqueue_job(
    bridge: State<'_, AgentBridge>,
    printer_id: Option<String>,
    document_path: Option<String>,
    document_name: Option<String>,
    copies: Option<u32>,
) -> Result<Value, String> {
    traced(
        &bridge,
        "enqueue_job",
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
    traced(&bridge, "list_jobs", "jobs.list", json!({})).await
}

#[tauri::command]
pub async fn get_job(bridge: State<'_, AgentBridge>, id: String) -> Result<Value, String> {
    traced(&bridge, "get_job", "jobs.get", json!({ "id": id })).await
}

#[tauri::command]
pub async fn cancel_job(bridge: State<'_, AgentBridge>, id: String) -> Result<Value, String> {
    traced(&bridge, "cancel_job", "jobs.cancel", json!({ "id": id })).await
}

#[tauri::command]
pub async fn retry_job(bridge: State<'_, AgentBridge>, id: String) -> Result<Value, String> {
    traced(&bridge, "retry_job", "jobs.retry", json!({ "id": id })).await
}

#[tauri::command]
pub async fn shutdown_agent(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    traced(&bridge, "shutdown_agent", "agent.shutdown", json!({})).await
}

#[tauri::command]
pub async fn get_refresh_token(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    traced(
        &bridge,
        "get_refresh_token",
        "secrets.getRefreshToken",
        json!({}),
    )
    .await
}

#[tauri::command]
pub async fn set_refresh_token(
    bridge: State<'_, AgentBridge>,
    refresh_token: String,
) -> Result<Value, String> {
    traced(
        &bridge,
        "set_refresh_token",
        "secrets.setRefreshToken",
        json!({ "refreshToken": refresh_token }),
    )
    .await
}

#[tauri::command]
pub async fn set_agent_cloud_credential(
    bridge: State<'_, AgentBridge>,
    server_base_url: String,
    shop_id: String,
    agent_id: String,
    credential: String,
) -> Result<Value, String> {
    traced(
        &bridge,
        "set_agent_cloud_credential",
        "secrets.setAgentCloudCredential",
        json!({
            "serverBaseUrl": server_base_url,
            "shopId": shop_id,
            "agentId": agent_id,
            "credential": credential,
        }),
    )
    .await
}

#[tauri::command]
pub async fn clear_refresh_token(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    traced(
        &bridge,
        "clear_refresh_token",
        "secrets.clearRefreshToken",
        json!({}),
    )
    .await
}

#[tauri::command]
pub async fn get_host_identity(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    traced(&bridge, "get_host_identity", "host.identity", json!({})).await
}

#[tauri::command]
pub async fn get_host_telemetry(bridge: State<'_, AgentBridge>) -> Result<Value, String> {
    traced(&bridge, "get_host_telemetry", "host.telemetry", json!({})).await
}

async fn traced(
    bridge: &AgentBridge,
    command: &str,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    log::write("command", format!("{command} invoke method={method}"));
    bridge.call(method, params).await
}
