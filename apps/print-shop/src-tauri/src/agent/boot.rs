use super::{bridge, framing, AgentBridge};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

pub async fn boot(app: AppHandle) -> Result<(), String> {
    let pipe = format!("ctrlp-print-agent-{}", Uuid::new_v4().simple());
    let token = Uuid::new_v4().to_string();
    let parent_pid = std::process::id().to_string();
    let args = [
        "--pipe",
        pipe.as_str(),
        "--token",
        token.as_str(),
        "--parent-pid",
        parent_pid.as_str(),
    ];

    // Tauri copies externalBin next to the app EXE as `ctrlp-print-agent.exe`.
    // `sidecar("binaries/...")` looks under target/debug/binaries, which `tauri dev` does not create.
    let names = ["ctrlp-print-agent", "binaries/ctrlp-print-agent"];
    let mut last_error = "no sidecar name tried".to_string();
    let mut spawned = None;

    for name in names {
        match app.shell().sidecar(name) {
            Ok(command) => match command.args(args).spawn() {
                Ok(pair) => {
                    spawned = Some(pair);
                    break;
                }
                Err(error) => last_error = format!("{name}: {error}"),
            },
            Err(error) => last_error = format!("{name}: {error}"),
        }
    }

    let (mut rx, child) =
        spawned.ok_or_else(|| format!("failed to spawn print agent: {last_error}"))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    eprintln!("agent stdout: {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("agent stderr: {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("agent exited: {:?}", payload.code);
                    break;
                }
                CommandEvent::Error(error) => eprintln!("agent error: {error}"),
                _ => {}
            }
        }
    });

    let stream = bridge::connect_pipe(&pipe)
        .await
        .map_err(|err| format!("could not connect to print agent pipe: {err}"))?;
    let (mut reader, mut writer) = bridge::split_pipe(stream);

    let hello = json!({
        "jsonrpc": "2.0",
        "id": "hello",
        "method": "agent.hello",
        "params": { "token": token, "client": "print-shop" }
    });
    let payload = serde_json::to_vec(&hello).map_err(|err| err.to_string())?;
    framing::write_frame(&mut writer, &payload)
        .await
        .map_err(|err| err.to_string())?;
    let response = framing::read_frame(&mut reader)
        .await
        .map_err(|err| err.to_string())?;
    let value: Value = serde_json::from_slice(&response).map_err(|err| err.to_string())?;
    if let Some(error) = value.get("error") {
        return Err(error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("agent hello failed")
            .to_string());
    }

    app.state::<AgentBridge>()
        .become_ready(child, writer, reader, app.clone())
        .await;
    Ok(())
}
