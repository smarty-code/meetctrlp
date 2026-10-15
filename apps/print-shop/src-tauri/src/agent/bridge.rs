use super::framing;
use super::log;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, UserAttentionType};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_shell::process::CommandChild;
use tokio::io::{split, ReadHalf, WriteHalf};
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

#[cfg(windows)]
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};

type Pending = HashMap<String, oneshot::Sender<Result<Value, String>>>;

enum BridgeState {
    Starting,
    Failed(String),
    Ready(ReadyState),
}

struct ReadyState {
    writer: WriteHalf<PipeStream>,
    pending: Pending,
    _child: CommandChild,
}

#[cfg(windows)]
type PipeStream = NamedPipeClient;

#[cfg(not(windows))]
type PipeStream = tokio::net::TcpStream;

pub struct AgentBridge {
    inner: Mutex<BridgeState>,
    call_lock: Mutex<()>,
}

impl AgentBridge {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(BridgeState::Starting),
            call_lock: Mutex::new(()),
        }
    }

    pub async fn fail(&self, error: String) {
        log::write("bridge", format!("state=failed error={error}"));
        *self.inner.lock().await = BridgeState::Failed(error);
    }

    pub async fn snapshot(&self) -> Value {
        match &*self.inner.lock().await {
            BridgeState::Starting => json!({ "state": "starting" }),
            BridgeState::Failed(error) => json!({ "state": "disconnected", "error": error }),
            BridgeState::Ready(_) => json!({ "state": "connected" }),
        }
    }

    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let _rpc = self.call_lock.lock().await;
        let id = Uuid::new_v4().to_string();
        let started = Instant::now();
        if !is_quiet_rpc(method) {
            log::write(
                "rpc",
                format!(
                    "begin method={method} id={id} params={}",
                    redact_params(method, &params)
                ),
            );
        }
        let (tx, rx) = oneshot::channel();
        {
            let mut guard = self.inner.lock().await;
            match &mut *guard {
                BridgeState::Ready(ready) => {
                    ready.pending.insert(id.clone(), tx);
                    let request = json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "method": method,
                        "params": params,
                    });
                    let payload = serde_json::to_vec(&request).map_err(|err| err.to_string())?;
                    if !is_quiet_rpc(method) {
                        log::write(
                            "rpc",
                            format!("write method={method} id={id} bytes={}", payload.len()),
                        );
                    }
                    framing::write_frame(&mut ready.writer, &payload)
                        .await
                        .map_err(|err| {
                            let message = err.to_string();
                            log::write(
                                "rpc",
                                format!("write-fail method={method} id={id} error={message}"),
                            );
                            message
                        })?;
                }
                BridgeState::Failed(error) => {
                    log::write(
                        "rpc",
                        format!("skip method={method} id={id} state=failed error={error}"),
                    );
                    return Err(error.clone());
                }
                BridgeState::Starting => {
                    log::write(
                        "rpc",
                        format!("skip method={method} id={id} state=starting"),
                    );
                    return Err("Print agent is still starting.".into());
                }
            }
        }

        let result = tokio::time::timeout(Duration::from_secs(20), rx)
            .await
            .map_err(|_| {
                log::write(
                    "rpc",
                    format!(
                        "timeout method={method} id={id} elapsedMs={}",
                        started.elapsed().as_millis()
                    ),
                );
                "Print agent request timed out.".to_string()
            })?
            .map_err(|_| {
                log::write(
                    "rpc",
                    format!(
                        "cancelled method={method} id={id} elapsedMs={}",
                        started.elapsed().as_millis()
                    ),
                );
                "Print agent request was cancelled.".to_string()
            })?;

        match &result {
            Ok(value) if !is_quiet_rpc(method) => log::write(
                "rpc",
                format!(
                    "ok method={method} id={id} elapsedMs={} result={}",
                    started.elapsed().as_millis(),
                    summarize_rpc_value(method, value)
                ),
            ),
            Ok(_) => {}
            Err(error) => log::write(
                "rpc",
                format!(
                    "err method={method} id={id} elapsedMs={} error={error}",
                    started.elapsed().as_millis()
                ),
            ),
        }

        result
    }

    /// One-way JSON-RPC frame (no `id`, so the agent sends no reply). Takes only the `inner` mutex,
    /// which guards the writer, never `call_lock`, which a pending `call` holds for up to 20 s.
    /// A silent no-op until the bridge is ready: the UI sends its notifications again on `agent:ready`.
    pub async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        let mut guard = self.inner.lock().await;
        let BridgeState::Ready(ready) = &mut *guard else {
            log::write(
                "rpc",
                format!("notify skipped method={method}: agent not ready"),
            );
            return Ok(());
        };
        let frame = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        let payload = serde_json::to_vec(&frame).map_err(|err| err.to_string())?;
        framing::write_frame(&mut ready.writer, &payload)
            .await
            .map_err(|err| {
                let message = err.to_string();
                log::write(
                    "rpc",
                    format!("notify write-fail method={method} error={message}"),
                );
                message
            })?;
        log::write(
            "rpc",
            format!(
                "notify method={method} bytes={} params={}",
                payload.len(),
                redact_params(method, &params)
            ),
        );
        Ok(())
    }

    pub async fn become_ready(
        &self,
        child: CommandChild,
        writer: WriteHalf<PipeStream>,
        reader: ReadHalf<PipeStream>,
        app: AppHandle,
    ) {
        log::write("bridge", "state=ready");
        *self.inner.lock().await = BridgeState::Ready(ReadyState {
            writer,
            pending: HashMap::new(),
            _child: child,
        });

        // The bridge never reconnects, so this fires once per app start. The UI answers it with
        // cloud.configure and cloud.session.
        if let Err(error) = app.emit("agent:ready", json!({})) {
            log::write("bridge", format!("agent:ready emit failed: {error}"));
        }

        tauri::async_runtime::spawn(async move {
            read_loop(reader, app).await;
        });
    }
}

async fn read_loop(mut reader: ReadHalf<PipeStream>, app: AppHandle) {
    let bridge = app.state::<AgentBridge>();
    log::write("bridge", "read_loop started");

    loop {
        let payload = match framing::read_frame(&mut reader).await {
            Ok(payload) => payload,
            Err(error) => {
                log::write("bridge", format!("read_loop pipe closed: {error}"));
                bridge.fail("Print agent pipe closed.".into()).await;
                break;
            }
        };

        let value: Value = match serde_json::from_slice(&payload) {
            Ok(value) => value,
            Err(error) => {
                log::write("bridge", format!("frame json parse failed: {error}"));
                continue;
            }
        };

        if let Some(id) = json_id(&value) {
            let mut guard = bridge.inner.lock().await;
            if let BridgeState::Ready(ready) = &mut *guard {
                if let Some(tx) = ready.pending.remove(&id) {
                    let result = if let Some(error) = value.get("error") {
                        Err(error
                            .get("message")
                            .and_then(Value::as_str)
                            .unwrap_or("Agent error")
                            .to_string())
                    } else {
                        Ok(value.get("result").cloned().unwrap_or(Value::Null))
                    };
                    let _ = tx.send(result);
                } else {
                    log::write("bridge", format!("orphan response id={id}"));
                }
            }
        } else if let Some(method) = value.get("method").and_then(Value::as_str) {
            log::write("bridge", format!("event {}", value));
            if method == "orders.attention" {
                // Raised here in Rust, because a minimized web view is throttled and may not run JS.
                raise_attention(&app, value.get("params"));
            }
            let _ = app.emit("agent:event", value);
        } else {
            log::write("bridge", format!("ignored frame {value}"));
        }
    }
}

/// A Windows notification ("New order ORD-1234") plus a taskbar flash for `orders.attention`.
fn raise_attention(app: &AppHandle, params: Option<&Value>) {
    let text = |key: &str| params.and_then(|p| p.get(key)).and_then(Value::as_str);
    let label = text("orderNumber")
        .or_else(|| text("orderId"))
        .unwrap_or_default();
    let title = match text("type") {
        Some("order_paid") => format!("Paid order {label}"),
        _ => format!("New order {label}"),
    };

    if let Err(error) = app
        .notification()
        .builder()
        .title(title.trim_end())
        .body("Open CtrlP Print Shop to review it.")
        .show()
    {
        log::write("bridge", format!("attention notification failed: {error}"));
    }

    match app.get_webview_window("main") {
        Some(window) => {
            if let Err(error) =
                window.request_user_attention(Some(UserAttentionType::Informational))
            {
                log::write("bridge", format!("attention flash failed: {error}"));
            }
        }
        None => log::write("bridge", "attention flash skipped: no main window"),
    }
}

fn json_id(value: &Value) -> Option<String> {
    match value.get("id")? {
        Value::String(id) => Some(id.clone()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

#[cfg(windows)]
pub async fn connect_pipe(name: &str) -> std::io::Result<NamedPipeClient> {
    let path = format!(r"\\.\pipe\{name}");
    let deadline = tokio::time::Instant::now() + Duration::from_secs(45);
    let mut attempts = 0_u32;
    log::write("pipe", format!("connecting path={path}"));

    loop {
        attempts += 1;
        match ClientOptions::new().open(&path) {
            Ok(client) => {
                log::write("pipe", format!("connected path={path} attempts={attempts}"));
                return Ok(client);
            }
            Err(error)
                if error.kind() == std::io::ErrorKind::NotFound
                    || error.raw_os_error() == Some(2)
                    || error.raw_os_error() == Some(231) =>
            {
                if attempts == 1 || attempts % 40 == 0 {
                    log::write(
                        "pipe",
                        format!(
                            "waiting path={path} attempt={attempts} os={:?} error={error}",
                            error.raw_os_error()
                        ),
                    );
                }
                if tokio::time::Instant::now() >= deadline {
                    log::write(
                        "pipe",
                        format!("timeout path={path} attempts={attempts} error={error}"),
                    );
                    return Err(error);
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
            Err(error) => {
                log::write(
                    "pipe",
                    format!(
                        "open-fail path={path} os={:?} error={error}",
                        error.raw_os_error()
                    ),
                );
                return Err(error);
            }
        }
    }
}

#[cfg(not(windows))]
pub async fn connect_pipe(_name: &str) -> std::io::Result<tokio::net::TcpStream> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "the print agent IPC is Windows-only",
    ))
}

pub fn split_pipe(stream: PipeStream) -> (ReadHalf<PipeStream>, WriteHalf<PipeStream>) {
    split(stream)
}

fn is_quiet_rpc(method: &str) -> bool {
    matches!(
        method,
        "agent.status"
            | "agent.ping"
            | "printers.list"
            | "host.telemetry"
            | "jobs.list"
            | "cloud.getIdToken"
    )
}

/// Methods whose params or results carry a refresh token or an ID token.
fn carries_secrets(method: &str) -> bool {
    method.starts_with("secrets.") || method == "cloud.session" || method == "cloud.getIdToken"
}

fn redact_params(method: &str, params: &Value) -> String {
    if carries_secrets(method) {
        "{redacted}".to_string()
    } else {
        params.to_string()
    }
}

fn summarize_rpc_value(method: &str, value: &Value) -> String {
    if carries_secrets(method) {
        return "{redacted}".to_string();
    }
    if let Some(printers) = value.get("printers").and_then(Value::as_array) {
        return format!("{{\"printers\":{}}}", printers.len());
    }
    if let Some(jobs) = value.get("jobs").and_then(Value::as_array) {
        return format!("{{\"jobs\":{}}}", jobs.len());
    }
    let rendered = value.to_string();
    if rendered.len() > 400 {
        format!("{}…", &rendered[..400])
    } else {
        rendered
    }
}
