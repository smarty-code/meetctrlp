#[cfg(windows)]
mod driver;
mod normalize;
mod options;
#[cfg(not(windows))]
mod unix;
#[cfg(windows)]
mod windows;

use serde_json::json;

use crate::domain::{PrintJob, PrintTestJob, Printer};

pub trait PrinterBackend: Send + Sync {
    fn discover(&self) -> Result<Vec<Printer>, String>;
    #[allow(dead_code)]
    fn print_test_job(&self, printer: &Printer, job: &PrintTestJob) -> Result<(), String>;
    fn print_document(&self, printer: &Printer, job: &PrintJob) -> Result<(), String>;
    fn capture_inventory(&self) -> Result<InventoryCapture, String>;
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryCapture {
    pub host: serde_json::Value,
    pub default_printer: Option<String>,
    pub catalogs: serde_json::Value,
    pub printers: Vec<Printer>,
}

pub struct LocalPrinterBackend;

impl PrinterBackend for LocalPrinterBackend {
    fn discover(&self) -> Result<Vec<Printer>, String> {
        Ok(self.capture_inventory()?.printers)
    }

    fn capture_inventory(&self) -> Result<InventoryCapture, String> {
        #[cfg(windows)]
        {
            windows::capture_inventory()
        }
        #[cfg(not(windows))]
        {
            unix::capture_inventory()
        }
    }

    fn print_test_job(&self, printer: &Printer, job: &PrintTestJob) -> Result<(), String> {
        #[cfg(windows)]
        {
            windows::print_test_job(printer, job)
        }
        #[cfg(not(windows))]
        {
            let _ = printer;
            println!("Development print job {}: {}", job.printer_id, job.content);
            Ok(())
        }
    }

    fn print_document(&self, printer: &Printer, job: &PrintJob) -> Result<(), String> {
        #[cfg(windows)]
        {
            driver::print_document(printer, job)
        }
        #[cfg(not(windows))]
        {
            unix::print_document(printer, job)
        }
    }
}

pub fn collect_process_host() -> serde_json::Value {
    json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
        "hostname": hostname(),
        "username": username(),
    })
}

fn hostname() -> Option<String> {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::process::Command::new("hostname")
                .output()
                .ok()
                .and_then(|output| String::from_utf8(output.stdout).ok())
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
}

fn username() -> Option<String> {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .ok()
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::LocalPrinterBackend;
    use super::PrinterBackend;
    use crate::domain::{
        ColorMode, DocumentSource, PageSelection, PaperSize, PrintJob, PrintOptions,
    };

    #[test]
    fn development_backend_accepts_a_local_png() {
        let png = [
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
            0xB0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        let path = std::env::temp_dir().join(format!(
            "printkro-doc-{}.png",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::write(&path, png).unwrap();
        let printer = crate::domain::Printer {
            id: "development-printer".to_string(),
            name: "Development Printer".to_string(),
            backend: crate::domain::PrinterBackendType::Development,
            status: crate::domain::PrinterStatus::Online,
            identity: crate::domain::PrinterIdentity::default(),
            capabilities: crate::domain::PrinterCapabilities::default(),
            details: serde_json::json!({ "source": "test" }),
        };
        let job = PrintJob {
            id: "job-png".to_string(),
            printer_id: printer.id.clone(),
            document: DocumentSource::LocalFile { path: path.clone() },
            options: PrintOptions {
                color_mode: ColorMode::Color,
                paper_size: PaperSize::A4,
                copies: 1,
                page_selection: PageSelection::All,
            },
        };
        let result = LocalPrinterBackend.print_document(&printer, &job);
        let _ = std::fs::remove_file(path);
        if cfg!(windows) {
            let _ = result;
        } else {
            result.expect("development backend should accept a local PNG");
        }
    }
}
