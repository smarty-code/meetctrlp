use crate::domain::{
    PrintTestJob, Printer, PrinterBackendType, PrinterCapabilities, PrinterStatus,
};

pub trait PrinterBackend: Send + Sync {
    fn discover(&self) -> Result<Vec<Printer>, String>;
    fn print_test_job(&self, printer: &Printer, job: &PrintTestJob) -> Result<(), String>;
}

pub struct LocalPrinterBackend;

impl PrinterBackend for LocalPrinterBackend {
    fn discover(&self) -> Result<Vec<Printer>, String> {
        #[cfg(windows)]
        {
            return platform::windows::discover_printers();
        }

        #[cfg(not(windows))]
        {
            Ok(vec![Printer {
                id: "development-printer".to_string(),
                name: "Development Printer".to_string(),
                backend: PrinterBackendType::Development,
                status: PrinterStatus::Online,
                capabilities: PrinterCapabilities {
                    color: true,
                    paper_sizes: vec![crate::domain::PaperSize::A4],
                    raw_supported: true,
                },
            }])
        }
    }

    fn print_test_job(&self, printer: &Printer, job: &PrintTestJob) -> Result<(), String> {
        #[cfg(windows)]
        {
            return platform::windows::print_test_job(printer, job);
        }

        #[cfg(not(windows))]
        {
            let _ = printer;
            println!("Development print job {}: {}", job.printer_id, job.content);
            Ok(())
        }
    }
}

#[cfg(windows)]
mod platform {
    use std::process::Command;

    pub mod windows {
        use super::Command;
        use crate::domain::{
            PrintTestJob, Printer, PrinterBackendType, PrinterCapabilities, PrinterStatus,
        };

        type Handle = *mut std::ffi::c_void;

        #[repr(C)]
        struct DocInfo {
            document_name: *const u16,
            output_file: *const u16,
            data_type: *const u16,
        }

        #[link(name = "winspool.drv")]
        unsafe extern "system" {
            fn OpenPrinterW(
                name: *const u16,
                printer: *mut Handle,
                defaults: *mut std::ffi::c_void,
            ) -> i32;
            fn ClosePrinter(printer: Handle) -> i32;
            fn StartDocPrinterW(printer: Handle, level: u32, doc_info: *const DocInfo) -> u32;
            fn EndDocPrinter(printer: Handle) -> i32;
            fn StartPagePrinter(printer: Handle) -> i32;
            fn EndPagePrinter(printer: Handle) -> i32;
            fn WritePrinter(
                printer: Handle,
                data: *const u8,
                length: u32,
                written: *mut u32,
            ) -> i32;
        }

        fn wide(value: &str) -> Result<Vec<u16>, String> {
            if value.contains('\0') {
                return Err("printer name contains an invalid null character".to_string());
            }
            Ok(value.encode_utf16().chain(std::iter::once(0)).collect())
        }

        pub fn discover_printers() -> Result<Vec<Printer>, String> {
            let output = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    "Get-Printer | Select-Object -ExpandProperty Name",
                ])
                .output()
                .map_err(|error| format!("could not start printer discovery: {error}"))?;

            if !output.status.success() {
                return Err("Windows printer discovery failed".to_string());
            }

            let printers = String::from_utf8_lossy(&output.stdout)
                .lines()
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .map(|name| Printer {
                    id: name.to_string(),
                    name: name.to_string(),
                    backend: PrinterBackendType::WindowsRaw,
                    status: PrinterStatus::Unknown,
                    capabilities: PrinterCapabilities {
                        raw_supported: true,
                        ..PrinterCapabilities::default()
                    },
                })
                .collect();

            Ok(printers)
        }

        pub fn print_test_job(printer: &Printer, job: &PrintTestJob) -> Result<(), String> {
            if job.content.trim().is_empty() {
                return Err("test job content cannot be empty".to_string());
            }

            let mut payload = vec![0x1b, 0x40];
            payload.extend_from_slice(job.content.as_bytes());
            payload.extend_from_slice(b"\n\n\n\n");
            payload.extend_from_slice(&[0x1d, 0x56, 0x01]);
            print_raw(&printer.name, &payload)
        }

        fn print_raw(printer_name: &str, data: &[u8]) -> Result<(), String> {
            if data.is_empty() {
                return Err("RAW print payload cannot be empty".to_string());
            }

            let printer_name = wide(printer_name)?;
            let document_name = wide("PrintKro Test Job")?;
            let data_type = wide("RAW")?;
            let mut handle: Handle = std::ptr::null_mut();

            let opened =
                unsafe { OpenPrinterW(printer_name.as_ptr(), &mut handle, std::ptr::null_mut()) };
            if opened == 0 {
                return Err(format!("could not open printer '{printer_name:?}'"));
            }

            let close_result = (|| {
                let document = DocInfo {
                    document_name: document_name.as_ptr(),
                    output_file: std::ptr::null(),
                    data_type: data_type.as_ptr(),
                };
                let document_id = unsafe { StartDocPrinterW(handle, 1, &document) };
                if document_id == 0 {
                    return Err("Windows spooler rejected the document".to_string());
                }

                let result = (|| {
                    if unsafe { StartPagePrinter(handle) } == 0 {
                        return Err("Windows spooler rejected the document page".to_string());
                    }

                    let mut written = 0;
                    let write_result = unsafe {
                        WritePrinter(handle, data.as_ptr(), data.len() as u32, &mut written)
                    };
                    let end_page_result = unsafe { EndPagePrinter(handle) };
                    if write_result == 0 || end_page_result == 0 || written != data.len() as u32 {
                        return Err(format!(
                            "Windows spooler wrote {written}/{} bytes",
                            data.len()
                        ));
                    }

                    Ok(())
                })();

                unsafe { EndDocPrinter(handle) };
                result
            })();

            unsafe { ClosePrinter(handle) };
            close_result
        }
    }
}
