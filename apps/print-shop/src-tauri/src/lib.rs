mod agent;
mod commands;

use agent::AgentBridge;
use tauri::Manager;
use commands::{
    agent_ping, cancel_job, clear_refresh_token, enqueue_job, export_agent_log, get_agent_status,
    get_host_identity, get_host_telemetry, get_job, get_printer, get_refresh_token, list_jobs,
    list_printers, print_test_page, refresh_printers, retry_job, set_agent_cloud_credential,
    set_refresh_token, shutdown_agent,
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
            print_test_page,
            enqueue_job,
            list_jobs,
            get_job,
            cancel_job,
            retry_job,
            shutdown_agent,
            get_refresh_token,
            set_refresh_token,
            set_agent_cloud_credential,
            clear_refresh_token,
            get_host_identity,
            get_host_telemetry,
            export_agent_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running CtrlP Print Shop");
}
