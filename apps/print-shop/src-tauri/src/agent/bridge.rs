use super::framing;
use super::log;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
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
        log::write(
            "rpc",
            format!("begin method={method} id={id} params={params}"),
        );
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
                    log::write(
                        "rpc",
                        format!("write method={method} id={id} bytes={}", payload.len()),
                    );
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
            Ok(value) => log::write(
                "rpc",
                format!(
                    "ok method={method} id={id} elapsedMs={} result={value}",
                    started.elapsed().as_millis()
                ),
            ),
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

        log::write("bridge", format!("frame recv bytes={}", payload.len()));
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
                    log::write(
                        "bridge",
                        format!(
                            "dispatch id={id} pending={} {}",
                            ready.pending.len(),
                            if result.is_ok() { "result" } else { "error" }
                        ),
                    );
                    let _ = tx.send(result);
                } else {
                    log::write("bridge", format!("orphan response id={id}"));
                }
            }
        } else if value.get("method").is_some() {
            log::write("bridge", format!("event {}", value));
            let _ = app.emit("agent:event", value);
        } else {
            log::write("bridge", format!("ignored frame {value}"));
        }
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
