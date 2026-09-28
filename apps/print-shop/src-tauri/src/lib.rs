mod agent;
mod commands;

use agent::AgentBridge;
use tauri::Manager;
use commands::{
    agent_ping, cancel_job, enqueue_job, get_agent_status, get_job, get_printer, list_jobs,
    list_printers, refresh_printers, shutdown_agent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AgentBridge::new())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                agent::log::write("app", "setup: spawning print agent boot task");
                if let Err(error) = agent::boot(handle.clone()).await {
                    agent::log::write("app", format!("print agent failed to start: {error}"));
                    handle.state::<AgentBridge>().fail(error).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            agent_ping,
            get_agent_status,
            list_printers,
            get_printer,
            refresh_printers,
            enqueue_job,
            list_jobs,
            get_job,
            cancel_job,
            shutdown_agent
        ])
        .run(tauri::generate_context!())
        .expect("error while running CtrlP Print Shop");
}
