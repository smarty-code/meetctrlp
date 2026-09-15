use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};

pub type PrinterId = String;
pub type JobId = String;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Printer {
    pub id: PrinterId,
    pub name: String,
    pub backend: PrinterBackendType,
    pub status: PrinterStatus,
    pub capabilities: PrinterCapabilities,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PrinterBackendType {
    WindowsDriver,
    WindowsRaw,
    Development,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PrinterStatus {
    Online,
    Offline,
    Printing,
    Paused,
    Error,
    Unknown,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct PrinterCapabilities {
    pub color: bool,
    pub paper_sizes: Vec<PaperSize>,
    pub raw_supported: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum PaperSize {
    A4,
    A3,
    Letter,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PrintTestJob {
    pub printer_id: PrinterId,
    pub content: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum JobState {
    Created,
    Validating,
    Queued,
    Printing,
    Completed,
    Failed,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct JobReceipt {
    pub id: JobId,
    pub printer_id: PrinterId,
    pub state: JobState,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct QueuedJob {
    pub receipt: JobReceipt,
    pub request: PrintTestJob,
    pub printer: Printer,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AgentStatus {
    pub selected_printer: Option<PrinterId>,
    pub queue_length: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PrintJob {
    pub id: JobId,
    pub printer_id: PrinterId,
    pub document: DocumentSource,
    pub options: PrintOptions,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentSource {
    LocalFile { path: PathBuf },
    Bytes { data: Vec<u8>, file_name: String },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PrintOptions {
    pub color_mode: ColorMode,
    pub paper_size: PaperSize,
    pub copies: u32,
    pub page_selection: PageSelection,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ColorMode {
    BlackAndWhite,
    Color,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PageSelection {
    All,
    Pages(Vec<u32>),
}

impl DocumentSource {
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::LocalFile { path } => {
                let metadata = fs::metadata(path)
                    .map_err(|_| "document file does not exist or is unreadable".to_string())?;
                if !metadata.is_file() || metadata.len() == 0 {
                    return Err("document file must be a non-empty regular file".to_string());
                }

                let extension = path
                    .extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default()
                    .to_ascii_lowercase();
                if !matches!(extension.as_str(), "pdf" | "jpg" | "jpeg" | "png") {
                    return Err("document type must be PDF, JPG, JPEG, or PNG".to_string());
                }
            }
            Self::Bytes { data, file_name } => {
                if data.is_empty() {
                    return Err("document bytes cannot be empty".to_string());
                }
                let extension = PathBuf::from(file_name)
                    .extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default()
                    .to_ascii_lowercase();
                if !matches!(extension.as_str(), "pdf" | "jpg" | "jpeg" | "png") {
                    return Err("document type must be PDF, JPG, JPEG, or PNG".to_string());
                }
            }
        }

        Ok(())
    }
}

impl PrintOptions {
    pub fn validate(&self) -> Result<(), String> {
        if self.copies == 0 {
            return Err("copies must be at least 1".to_string());
        }

        if let PageSelection::Pages(pages) = &self.page_selection {
            if pages.is_empty() || pages.iter().any(|page| *page == 0) {
                return Err("page selection must contain positive page numbers".to_string());
            }
        }

        Ok(())
    }
}

impl PrintJob {
    pub fn validate(&self) -> Result<(), String> {
        if self.id.trim().is_empty() || self.printer_id.trim().is_empty() {
            return Err("job and printer IDs are required".to_string());
        }
        self.document.validate()?;
        self.options.validate()
    }
}

impl PrintTestJob {
    pub fn validate(&self) -> Result<(), String> {
        if self.printer_id.trim().is_empty() {
            return Err("a printer must be selected".to_string());
        }

        if self.content.trim().is_empty() {
            return Err("test job content cannot be empty".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ColorMode, DocumentSource, PageSelection, PaperSize, PrintJob, PrintOptions, PrintTestJob,
    };

    #[test]
    fn rejects_empty_printer_id() {
        let job = PrintTestJob {
            printer_id: " ".to_string(),
            content: "test".to_string(),
        };

        assert_eq!(
            job.validate(),
            Err("a printer must be selected".to_string())
        );
    }

    #[test]
    fn rejects_empty_content() {
        let job = PrintTestJob {
            printer_id: "printer-1".to_string(),
            content: "\n".to_string(),
        };

        assert_eq!(
            job.validate(),
            Err("test job content cannot be empty".to_string())
        );
    }

    #[test]
    fn accepts_valid_test_job() {
        let job = PrintTestJob {
            printer_id: "printer-1".to_string(),
            content: "hello".to_string(),
        };

        assert!(job.validate().is_ok());
    }

    fn document_options() -> PrintOptions {
        PrintOptions {
            color_mode: ColorMode::Color,
            paper_size: PaperSize::A4,
            copies: 1,
            page_selection: PageSelection::All,
        }
    }

    #[test]
    fn rejects_empty_document_bytes() {
        let document = DocumentSource::Bytes {
            data: Vec::new(),
            file_name: "document.pdf".to_string(),
        };

        assert_eq!(
            document.validate(),
            Err("document bytes cannot be empty".to_string())
        );
    }

    #[test]
    fn rejects_unsupported_document_type() {
        let document = DocumentSource::Bytes {
            data: vec![1, 2, 3],
            file_name: "document.docx".to_string(),
        };

        assert_eq!(
            document.validate(),
            Err("document type must be PDF, JPG, JPEG, or PNG".to_string())
        );
    }

    #[test]
    fn rejects_invalid_print_options() {
        let mut options = document_options();
        options.copies = 0;
        assert_eq!(
            options.validate(),
            Err("copies must be at least 1".to_string())
        );

        options.copies = 1;
        options.page_selection = PageSelection::Pages(vec![0]);
        assert_eq!(
            options.validate(),
            Err("page selection must contain positive page numbers".to_string())
        );
    }

    #[test]
    fn accepts_valid_document_job() {
        let job = PrintJob {
            id: "job-1".to_string(),
            printer_id: "printer-1".to_string(),
            document: DocumentSource::Bytes {
                data: vec![1, 2, 3],
                file_name: "document.png".to_string(),
            },
            options: document_options(),
        };

        assert!(job.validate().is_ok());
    }
}
