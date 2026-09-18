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

    pub fn directory(&self) -> &Path {
        self.path.parent().unwrap_or_else(|| Path::new("."))
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
    if contents.trim().is_empty() {
        return Ok(QueueFile::default());
    }
    match serde_json::from_str(&contents) {
        Ok(file) => Ok(file),
        Err(error) => {
            let backup = path.with_extension("json.bak");
            let _ = fs::copy(path, &backup);
            eprintln!("queue store reset after unreadable job file: {error}");
            write_file(path, &QueueFile::default())?;
            Ok(QueueFile::default())
        }
    }
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
        ColorMode, DocumentSource, JobReceipt, JobState, PageSelection, PaperSize, PrintJob,
        PrintOptions, Printer, PrinterBackendType, PrinterCapabilities, PrinterStatus, QueuedJob,
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
        let document = std::env::temp_dir().join(format!(
            "printkro-doc-{}.png",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::write(&document, [1, 2, 3]).unwrap();
        let job = QueuedJob {
            receipt: JobReceipt {
                id: "job-1".to_string(),
                printer_id: "printer-1".to_string(),
                state: JobState::Queued,
                message: "queued".to_string(),
            },
            request: PrintJob {
                id: "job-1".to_string(),
                printer_id: "printer-1".to_string(),
                document: DocumentSource::LocalFile {
                    path: document.clone(),
                },
                options: PrintOptions {
                    color_mode: ColorMode::Color,
                    paper_size: PaperSize::A4,
                    copies: 1,
                    page_selection: PageSelection::All,
                },
            },
            printer: Printer {
                id: "printer-1".to_string(),
                name: "Test".to_string(),
                backend: PrinterBackendType::Development,
                status: PrinterStatus::Online,
                identity: crate::domain::PrinterIdentity::default(),
                capabilities: PrinterCapabilities::default(),
                details: serde_json::json!({ "source": "test" }),
            },
        };

        store.save_job(&job).unwrap();
        assert_eq!(store.load_jobs().unwrap().len(), 1);
        assert!(matches!(
            store.load_jobs().unwrap()[0].request.document,
            DocumentSource::LocalFile { .. }
        ));
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
        let _ = std::fs::remove_file(document);
        let _ = std::fs::remove_file(path);
    }
}
