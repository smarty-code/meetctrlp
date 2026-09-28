use super::framing;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
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
}

impl AgentBridge {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(BridgeState::Starting),
        }
    }

    pub async fn fail(&self, error: String) {
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
        let id = Uuid::new_v4().to_string();
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
                    framing::write_frame(&mut ready.writer, &payload)
                        .await
                        .map_err(|err| err.to_string())?;
                }
                BridgeState::Failed(error) => return Err(error.clone()),
                BridgeState::Starting => return Err("Print agent is still starting.".into()),
            }
        }

        tokio::time::timeout(Duration::from_secs(20), rx)
            .await
            .map_err(|_| "Print agent request timed out.".to_string())?
            .map_err(|_| "Print agent request was cancelled.".to_string())?
    }

    pub async fn become_ready(
        &self,
        child: CommandChild,
        writer: WriteHalf<PipeStream>,
        reader: ReadHalf<PipeStream>,
        app: AppHandle,
    ) {
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

    loop {
        let payload = match framing::read_frame(&mut reader).await {
            Ok(payload) => payload,
            Err(_) => {
                bridge.fail("Print agent pipe closed.".into()).await;
                break;
            }
        };

        let value: Value = match serde_json::from_slice(&payload) {
            Ok(value) => value,
            Err(_) => continue,
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
                }
            }
        } else if value.get("method").is_some() {
            let _ = app.emit("agent:event", value);
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

    loop {
        match ClientOptions::new().open(&path) {
            Ok(client) => return Ok(client),
            Err(error)
                if error.kind() == std::io::ErrorKind::NotFound
                    || error.raw_os_error() == Some(2)
                    || error.raw_os_error() == Some(231) =>
            {
                if tokio::time::Instant::now() >= deadline {
                    return Err(error);
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
            Err(error) => return Err(error),
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
