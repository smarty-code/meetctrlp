use super::{bridge, framing, log, AgentBridge};
use serde_json::{json, Value};
use std::fs;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

pub async fn boot(app: AppHandle) -> Result<(), String> {
    let pipe = "ctrlp-print-agent".to_string();
    let token = persistent_agent_token(&app)?;
    log::write(
        "boot",
        format!("start pipe={pipe} tokenLen={}", token.len()),
    );
    let args = ["--pipe", pipe.as_str(), "--token", token.as_str()];

    // Tauri copies externalBin next to the app EXE as `ctrlp-print-agent.exe`.
    // `sidecar("binaries/...")` looks under target/debug/binaries, which `tauri dev` does not create.
    let names = ["ctrlp-print-agent", "binaries/ctrlp-print-agent"];
    let mut last_error = "no sidecar name tried".to_string();
    let mut spawned = None;

    for name in names {
        log::write("boot", format!("sidecar try name={name}"));
        match app.shell().sidecar(name) {
            Ok(command) => match command.args(args).spawn() {
                Ok(pair) => {
                    log::write("boot", format!("sidecar spawned name={name}"));
                    spawned = Some(pair);
                    break;
                }
                Err(error) => {
                    last_error = format!("{name}: {error}");
                    log::write("boot", format!("sidecar spawn failed {last_error}"));
                }
            },
            Err(error) => {
                last_error = format!("{name}: {error}");
                log::write("boot", format!("sidecar resolve failed {last_error}"));
            }
        }
    }

    let (mut rx, child) =
        spawned.ok_or_else(|| format!("failed to spawn print agent: {last_error}"))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    log::write(
                        "agent-stdout",
                        String::from_utf8_lossy(&line).trim_end().to_string(),
                    );
                }
                CommandEvent::Stderr(line) => {
                    log::write(
                        "agent-stderr",
                        String::from_utf8_lossy(&line).trim_end().to_string(),
                    );
                }
                CommandEvent::Terminated(payload) => {
                    log::write("boot", format!("agent exited code={:?}", payload.code));
                    break;
                }
                CommandEvent::Error(error) => log::write("boot", format!("agent error: {error}")),
                _ => {}
            }
        }
    });

    log::write("boot", format!("connecting named pipe={pipe}"));
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
    log::write("boot", format!("hello write bytes={}", payload.len()));
    framing::write_frame(&mut writer, &payload)
        .await
        .map_err(|err| err.to_string())?;
    let response = framing::read_frame(&mut reader)
        .await
        .map_err(|err| err.to_string())?;
    log::write("boot", format!("hello read bytes={}", response.len()));
    let value: Value = serde_json::from_slice(&response).map_err(|err| err.to_string())?;
    if let Some(error) = value.get("error") {
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("agent hello failed")
            .to_string();
        log::write("boot", format!("hello failed {value}"));
        return Err(message);
    }

    log::write("boot", format!("hello ok {value}"));
    app.state::<AgentBridge>()
        .become_ready(child, writer, reader, app.clone())
        .await;
    Ok(())
}

fn persistent_agent_token(app: &AppHandle) -> Result<String, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("resolve agent data directory: {error}"))?;
    let token_path = directory.join("agent.pipe-token");
    if let Ok(existing) = fs::read_to_string(&token_path) {
        let token = existing.trim().to_string();
        if !token.is_empty() {
            return Ok(token);
        }
    }

    fs::create_dir_all(&directory).map_err(|error| format!("create agent data directory: {error}"))?;
    let token = Uuid::new_v4().to_string();
    fs::write(&token_path, &token).map_err(|error| format!("persist agent token: {error}"))?;
    Ok(token)
}
