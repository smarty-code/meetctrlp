mod commands;
mod domain;
mod printer;
mod queue;
mod state;

use std::sync::Arc;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = state::AppState::new(state::default_store_path())
        .expect("could not initialize the local agent queue");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(|app| {
            let handle = app.handle().clone();
            app.state::<state::AppState>()
                .set_event_sink(Arc::new(move |receipt| {
                    let _ = handle.emit("job:changed", receipt);
                }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_printers,
            commands::get_agent_status,
            commands::select_printer,
            commands::create_test_job,
            commands::get_job,
            commands::validate_document_job
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
