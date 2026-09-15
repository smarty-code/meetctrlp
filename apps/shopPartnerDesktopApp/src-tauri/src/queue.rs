use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};

use crate::domain::{JobReceipt, QueuedJob};

#[derive(Serialize, Deserialize, Default)]
struct QueueFile {
    jobs: Vec<QueuedJob>,
}

pub struct QueueStore {
    path: PathBuf,
    lock: Mutex<()>,
}

impl QueueStore {
    pub fn open(path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("could not create queue directory: {error}"))?;
        }

        if !path.exists() {
            write_file(&path, &QueueFile::default())?;
        }

        Ok(Self {
            path,
            lock: Mutex::new(()),
        })
    }

    pub fn load_jobs(&self) -> Result<Vec<QueuedJob>, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "queue store is unavailable".to_string())?;
        let file = read_file(&self.path)?;
        Ok(file.jobs)
    }

    pub fn save_job(&self, job: &QueuedJob) -> Result<(), String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "queue store is unavailable".to_string())?;
        let mut file = read_file(&self.path)?;
        if let Some(existing) = file
            .jobs
            .iter_mut()
            .find(|existing| existing.receipt.id == job.receipt.id)
        {
            *existing = job.clone();
        } else {
            file.jobs.push(job.clone());
        }
        write_file(&self.path, &file)
    }

    pub fn update_receipt(&self, receipt: &JobReceipt) -> Result<(), String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "queue store is unavailable".to_string())?;
        let mut file = read_file(&self.path)?;
        if let Some(existing) = file
            .jobs
            .iter_mut()
            .find(|job| job.receipt.id == receipt.id)
        {
            existing.receipt = receipt.clone();
            return write_file(&self.path, &file);
        }
        Ok(())
    }
}

fn read_file(path: &Path) -> Result<QueueFile, String> {
    let contents =
        fs::read_to_string(path).map_err(|error| format!("could not read queue store: {error}"))?;
    serde_json::from_str(&contents).map_err(|error| format!("could not parse queue store: {error}"))
}

fn write_file(path: &Path, file: &QueueFile) -> Result<(), String> {
    let contents = serde_json::to_vec_pretty(file)
        .map_err(|error| format!("could not encode queue store: {error}"))?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, contents)
        .map_err(|error| format!("could not write queue store: {error}"))?;
    fs::rename(&temporary, path).map_err(|error| format!("could not replace queue store: {error}"))
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::QueueStore;
    use crate::domain::{
        JobReceipt, JobState, PrintTestJob, Printer, PrinterBackendType, PrinterCapabilities,
        PrinterStatus, QueuedJob,
    };

    #[test]
    fn persists_and_updates_jobs() {
        let path = std::env::temp_dir().join(format!(
            "printkro-{}.json",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let store = QueueStore::open(path.clone()).unwrap();
        let job = QueuedJob {
            receipt: JobReceipt {
                id: "job-1".to_string(),
                printer_id: "printer-1".to_string(),
                state: JobState::Queued,
                message: "queued".to_string(),
            },
            request: PrintTestJob {
                printer_id: "printer-1".to_string(),
                content: "hello".to_string(),
            },
            printer: Printer {
                id: "printer-1".to_string(),
                name: "Test".to_string(),
                backend: PrinterBackendType::Development,
                status: PrinterStatus::Online,
                capabilities: PrinterCapabilities::default(),
            },
        };

        store.save_job(&job).unwrap();
        assert_eq!(store.load_jobs().unwrap().len(), 1);
        store
            .update_receipt(&JobReceipt {
                state: JobState::Completed,
                ..job.receipt
            })
            .unwrap();
        assert!(matches!(
            store.load_jobs().unwrap()[0].receipt.state,
            JobState::Completed
        ));
        let _ = std::fs::remove_file(path);
    }
}
