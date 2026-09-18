use std::time::{SystemTime, UNIX_EPOCH};

use tauri::State;

use crate::{
    domain::{AgentStatus, JobReceipt, JobState, PrintJob, Printer, PrinterId, QueuedJob},
    state::AppState,
};

#[derive(serde::Deserialize)]
pub struct PrinterInventorySyncRequest {
    pub server_url: String,
    pub device_id: String,
    pub api_key: String,
}

#[tauri::command]
pub fn list_printers(state: State<'_, AppState>) -> Result<Vec<Printer>, String> {
    state.backend.discover()
}

#[tauri::command]
pub fn get_agent_status(state: State<'_, AppState>) -> Result<AgentStatus, String> {
    let selected_printer = state
        .selected_printer
        .lock()
        .map_err(|_| "agent state is unavailable".to_string())?
        .clone();

    let queue_length = *state
        .queue_length
        .lock()
        .map_err(|_| "queue is unavailable".to_string())?;

    Ok(AgentStatus {
        selected_printer,
        queue_length,
    })
}

#[tauri::command]
pub fn select_printer(state: State<'_, AppState>, printer_id: PrinterId) -> Result<(), String> {
    let printers = state.backend.discover()?;
    if !printers.iter().any(|printer| printer.id == printer_id) {
        return Err(format!("printer '{printer_id}' was not found"));
    }

    *state
        .selected_printer
        .lock()
        .map_err(|_| "agent state is unavailable".to_string())? = Some(printer_id);
    Ok(())
}

#[tauri::command]
pub fn create_print_job(
    state: State<'_, AppState>,
    mut job: PrintJob,
) -> Result<JobReceipt, String> {
    let job_id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system clock is before the Unix epoch".to_string())?
        .as_millis()
        .to_string();
    job.id = job_id.clone();
    job = job.into_staged(&state.staging_dir()?)?;
    job.validate()?;

    let printer = state
        .backend
        .discover()?
        .into_iter()
        .find(|printer| printer.id == job.printer_id)
        .ok_or_else(|| format!("printer '{}' was not found", job.printer_id))?;

    let receipt = JobReceipt {
        id: job_id,
        printer_id: job.printer_id.clone(),
        state: JobState::Queued,
        message: "document job queued for the local printer backend".to_string(),
    };
    state
        .jobs
        .lock()
        .map_err(|_| "job store is unavailable".to_string())?
        .insert(receipt.id.clone(), receipt.clone());
    state.enqueue(QueuedJob {
        receipt: receipt.clone(),
        request: job,
        printer,
    })?;

    Ok(receipt)
}

#[tauri::command]
pub fn print_document_job(state: State<'_, AppState>, job: PrintJob) -> Result<JobReceipt, String> {
    job.validate()?;
    let printer = state
        .backend
        .discover()?
        .into_iter()
        .find(|printer| printer.id == job.printer_id)
        .ok_or_else(|| format!("printer '{}' was not found", job.printer_id))?;

    state.backend.print_document(&printer, &job)?;
    Ok(JobReceipt {
        id: job.id,
        printer_id: job.printer_id,
        state: JobState::Completed,
        message: "document submitted to the selected printer".to_string(),
    })
}

#[tauri::command]
pub fn get_job(state: State<'_, AppState>, job_id: String) -> Result<Option<JobReceipt>, String> {
    Ok(state
        .jobs
        .lock()
        .map_err(|_| "job store is unavailable".to_string())?
        .get(&job_id)
        .cloned())
}

#[tauri::command]
pub fn validate_document_job(job: PrintJob) -> Result<(), String> {
    job.validate()
}

#[tauri::command]
pub fn sync_printer_inventory(
    state: State<'_, AppState>,
    request: PrinterInventorySyncRequest,
) -> Result<serde_json::Value, String> {
    if request.server_url.trim().is_empty()
        || request.device_id.trim().is_empty()
        || request.api_key.trim().is_empty()
    {
        return Err("server URL, device ID, and API key are required".to_string());
    }

    let printers = state.backend.discover()?;
    let payload = serde_json::json!({
        "deviceId": request.device_id,
        "capturedAt": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| format!("system clock error: {error}"))?
            .as_millis()
            .to_string(),
        "printers": printers,
    });
    let endpoint = format!(
        "{}/api/printers/inventory",
        request.server_url.trim_end_matches('/')
    );
    let response = reqwest::blocking::Client::new()
        .post(endpoint)
        .header("x-printer-inventory-key", request.api_key)
        .json(&payload)
        .send()
        .map_err(|error| format!("inventory sync failed: {error}"))?;

    let status = response.status();
    let body = response
        .json::<serde_json::Value>()
        .map_err(|error| format!("invalid inventory response: {error}"))?;
    if !status.is_success() {
        return Err(format!("inventory sync returned HTTP {status}: {body}"));
    }

    Ok(body)
}
