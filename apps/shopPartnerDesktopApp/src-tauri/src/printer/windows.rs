use std::{
    fs,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::{json, Value};

use crate::domain::{PrintTestJob, Printer};

use super::{
    collect_process_host,
    normalize::{capture_from_parts, printers_from_capture},
    InventoryCapture,
};

pub fn capture_inventory() -> Result<InventoryCapture, String> {
    let capture = run_powershell(include_str!("inventory.ps1"))?;
    let printers =
        printers_from_capture(&capture, crate::domain::PrinterBackendType::WindowsDriver);
    let host = json!({
        "runtime": collect_process_host(),
        "windows": capture.get("host").cloned().unwrap_or(Value::Null),
    });
    Ok(capture_from_parts(
        host,
        capture
            .get("defaultPrinter")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        capture.get("catalogs").cloned().unwrap_or(json!({})),
        printers,
    ))
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

fn run_powershell(script: &str) -> Result<Value, String> {
    let temp = TempScript::create(script)?;
    let mut command = Command::new("powershell");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        temp.path
            .to_str()
            .ok_or_else(|| "printer inventory script path is not valid UTF-8".to_string())?,
    ]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    let output = command
        .output()
        .map_err(|error| format!("could not start printer discovery: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !output.status.success() && stdout.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Windows printer discovery failed: {stderr}"));
    }

    serde_json::from_str(&stdout).map_err(|error| {
        let stderr = String::from_utf8_lossy(&output.stderr);
        format!("could not parse Windows printer details: {error}; stderr={stderr}")
    })
}

struct TempScript {
    path: PathBuf,
}

impl TempScript {
    fn create(script: &str) -> Result<Self, String> {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!(
            "printkro-printer-inventory-{}-{millis}.ps1",
            std::process::id()
        ));
        fs::write(&path, script)
            .map_err(|error| format!("could not write printer inventory script: {error}"))?;
        Ok(Self { path })
    }
}

impl Drop for TempScript {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

type Handle = *mut std::ffi::c_void;

#[repr(C)]
struct DocInfo {
    document_name: *const u16,
    output_file: *const u16,
    data_type: *const u16,
}

// MSVC links against the Windows SDK import library winspool.lib.
#[link(name = "winspool")]
unsafe extern "system" {
    fn OpenPrinterW(name: *const u16, printer: *mut Handle, defaults: *mut std::ffi::c_void)
        -> i32;
    fn ClosePrinter(printer: Handle) -> i32;
    fn StartDocPrinterW(printer: Handle, level: u32, doc_info: *const DocInfo) -> u32;
    fn EndDocPrinter(printer: Handle) -> i32;
    fn StartPagePrinter(printer: Handle) -> i32;
    fn EndPagePrinter(printer: Handle) -> i32;
    fn WritePrinter(printer: Handle, data: *const u8, length: u32, written: *mut u32) -> i32;
}

fn wide(value: &str) -> Result<Vec<u16>, String> {
    if value.contains('\0') {
        return Err("printer name contains an invalid null character".to_string());
    }
    Ok(value.encode_utf16().chain(std::iter::once(0)).collect())
}

fn print_raw(printer_name: &str, data: &[u8]) -> Result<(), String> {
    if data.is_empty() {
        return Err("RAW print payload cannot be empty".to_string());
    }

    let printer_name = wide(printer_name)?;
    let document_name = wide("PrintKro Test Job")?;
    let data_type = wide("RAW")?;
    let mut handle: Handle = std::ptr::null_mut();

    let opened = unsafe { OpenPrinterW(printer_name.as_ptr(), &mut handle, std::ptr::null_mut()) };
    if opened == 0 {
        return Err("could not open printer".to_string());
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
            let write_result =
                unsafe { WritePrinter(handle, data.as_ptr(), data.len() as u32, &mut written) };
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
