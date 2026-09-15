use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{mpsc, Arc, Mutex},
};

use crate::{
    domain::{JobId, JobReceipt, JobState, PrinterId, QueuedJob},
    printer::{LocalPrinterBackend, PrinterBackend},
    queue::QueueStore,
};

pub struct AppState {
    pub backend: Arc<dyn PrinterBackend>,
    pub selected_printer: Mutex<Option<PrinterId>>,
    pub queue_length: Arc<Mutex<usize>>,
    pub jobs: Arc<Mutex<HashMap<JobId, JobReceipt>>>,
    pub store: Arc<QueueStore>,
    sender: mpsc::Sender<QueuedJob>,
    event_sink: Arc<Mutex<Option<Arc<dyn Fn(&JobReceipt) + Send + Sync>>>>,
}

impl AppState {
    pub fn new(store_path: PathBuf) -> Result<Self, String> {
        let backend: Arc<dyn PrinterBackend> = Arc::new(LocalPrinterBackend);
        let (sender, receiver) = mpsc::channel::<QueuedJob>();
        let store = Arc::new(QueueStore::open(store_path)?);
        let recovered_jobs = store.load_jobs()?;
        let recovered_count = recovered_jobs
            .iter()
            .filter(|job| matches!(job.receipt.state, JobState::Queued | JobState::Printing))
            .count();
        let queue_length = Arc::new(Mutex::new(recovered_count));
        let jobs = Arc::new(Mutex::new(
            recovered_jobs
                .iter()
                .map(|job| (job.receipt.id.clone(), job.receipt.clone()))
                .collect::<HashMap<_, _>>(),
        ));
        let event_sink: Arc<Mutex<Option<Arc<dyn Fn(&JobReceipt) + Send + Sync>>>> =
            Arc::new(Mutex::new(None));
        let worker_backend = Arc::clone(&backend);
        let worker_queue_length = Arc::clone(&queue_length);
        let worker_jobs = Arc::clone(&jobs);
        let worker_event_sink = Arc::clone(&event_sink);
        let worker_store = Arc::clone(&store);

        std::thread::spawn(move || {
            while let Ok(job) = receiver.recv() {
                if let Ok(mut length) = worker_queue_length.lock() {
                    *length = length.saturating_sub(1);
                }

                let mut receipt = job.receipt;
                receipt.state = JobState::Printing;
                let _ = worker_store.update_receipt(&receipt);
                if let Ok(mut jobs) = worker_jobs.lock() {
                    jobs.insert(receipt.id.clone(), receipt.clone());
                }
                emit_job(&worker_event_sink, &receipt);

                receipt.state = match worker_backend.print_test_job(&job.printer, &job.request) {
                    Ok(()) => JobState::Completed,
                    Err(error) => {
                        receipt.message = error;
                        JobState::Failed
                    }
                };

                let _ = worker_store.update_receipt(&receipt);
                if let Ok(mut jobs) = worker_jobs.lock() {
                    jobs.insert(receipt.id.clone(), receipt.clone());
                }
                emit_job(&worker_event_sink, &receipt);
            }
        });

        let app_state = Self {
            backend,
            selected_printer: Mutex::new(None),
            queue_length,
            jobs,
            store,
            sender,
            event_sink,
        };

        for mut job in recovered_jobs {
            if matches!(job.receipt.state, JobState::Printing) {
                job.receipt.state = JobState::Queued;
                app_state.store.update_receipt(&job.receipt)?;
            }
            if matches!(job.receipt.state, JobState::Queued) {
                app_state
                    .sender
                    .send(job)
                    .map_err(|_| "could not recover queued job".to_string())?;
            }
        }

        Ok(app_state)
    }

    pub fn set_event_sink(&self, sink: Arc<dyn Fn(&JobReceipt) + Send + Sync>) {
        if let Ok(mut event_sink) = self.event_sink.lock() {
            *event_sink = Some(sink);
        }
    }

    pub fn enqueue(&self, job: QueuedJob) -> Result<(), String> {
        self.store.save_job(&job)?;
        self.sender
            .send(job)
            .map_err(|_| "print worker is unavailable".to_string())?;
        let mut length = self
            .queue_length
            .lock()
            .map_err(|_| "queue is unavailable".to_string())?;
        *length += 1;
        Ok(())
    }
}

pub fn default_store_path() -> PathBuf {
    let root = if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
            })
    }
    .unwrap_or_else(|| PathBuf::from("."));

    root.join("PrintKro").join("agent-jobs.json")
}

fn emit_job(
    event_sink: &Arc<Mutex<Option<Arc<dyn Fn(&JobReceipt) + Send + Sync>>>>,
    receipt: &JobReceipt,
) {
    if let Ok(sink) = event_sink.lock() {
        if let Some(sink) = sink.as_ref() {
            sink(receipt);
        }
    }
}
