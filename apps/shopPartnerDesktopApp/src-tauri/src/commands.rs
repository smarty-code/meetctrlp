use std::time::{SystemTime, UNIX_EPOCH};

use tauri::State;

use crate::{
    domain::{
        AgentStatus, JobReceipt, JobState, PrintJob, PrintTestJob, Printer, PrinterId, QueuedJob,
    },
    state::AppState,
};

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
pub fn create_test_job(
    state: State<'_, AppState>,
    job: PrintTestJob,
) -> Result<JobReceipt, String> {
    job.validate()?;

    let printer = state
        .backend
        .discover()?
        .into_iter()
        .find(|printer| printer.id == job.printer_id)
        .ok_or_else(|| format!("printer '{}' was not found", job.printer_id))?;

    let job_id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system clock is before the Unix epoch".to_string())?
        .as_millis()
        .to_string();

    let receipt = JobReceipt {
        id: job_id,
        printer_id: job.printer_id.clone(),
        state: JobState::Queued,
        message: "test job queued for the local printer backend".to_string(),
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
