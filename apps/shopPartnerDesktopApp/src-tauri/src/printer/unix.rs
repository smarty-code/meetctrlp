use std::{
    fs,
    io::{ErrorKind, Write},
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::{json, Map, Value};

use crate::domain::{
    PaperSize, PrintJob, Printer, PrinterBackendType, PrinterCapabilities, PrinterIdentity,
    PrinterStatus,
};

use super::{
    collect_process_host,
    normalize::{capture_from_parts, parse_ieee1284, printers_from_capture},
    InventoryCapture,
};

pub fn capture_inventory() -> Result<InventoryCapture, String> {
    if command_started("lpstat", &["-e"]).is_none() {
        return Ok(development_capture());
    }

    let default_printer = run("lpstat", &["-d"]).ok().and_then(|output| {
        output.lines().rev().find_map(|line| {
            line.split(':')
                .nth(1)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
        })
    });

    let records = printer_names()
        .iter()
        .map(|name| capture_cups_printer(name))
        .collect::<Vec<_>>();
    let capture = json!({
        "defaultPrinter": default_printer,
        "printers": records,
    });

    Ok(capture_from_parts(
        json!({
            "runtime": collect_process_host(),
            "unix": unix_host(),
        }),
        default_printer,
        json!({
            "devices": capture_command("lpinfo", &["-v"]),
            "ippfind": capture_command("timeout", &["4", "ippfind"]),
            "cupsServer": capture_command("lpstat", &["-H"]),
            "fullStatus": capture_command("lpstat", &["-t"]),
        }),
        printers_from_capture(&capture, PrinterBackendType::Cups),
    ))
}

fn development_capture() -> InventoryCapture {
    capture_from_parts(
        json!({ "runtime": collect_process_host(), "source": "development" }),
        Some("development-printer".to_string()),
        json!({}),
        vec![Printer {
            id: "development-printer".to_string(),
            name: "Development Printer".to_string(),
            backend: PrinterBackendType::Development,
            status: PrinterStatus::Online,
            identity: PrinterIdentity {
                manufacturer: Some("PrintKro".to_string()),
                model: Some("Development Printer".to_string()),
                ..PrinterIdentity::default()
            },
            capabilities: PrinterCapabilities {
                color: true,
                paper_sizes: vec![PaperSize::A4],
                raw_supported: true,
                media: vec!["A4".to_string()],
                color_modes: vec!["color".to_string()],
                ..PrinterCapabilities::default()
            },
            details: json!({ "source": "development" }),
        }],
    )
}

fn printer_names() -> Vec<String> {
    let mut names = run("lpstat", &["-e"])
        .unwrap_or_default()
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if names.is_empty() {
        if let Ok(output) = run("lpstat", &["-a"]) {
            for line in output.lines() {
                if let Some(name) = line.split_whitespace().next() {
                    names.push(name.to_string());
                }
            }
        }
    }
    names.sort();
    names.dedup();
    names
}

fn capture_cups_printer(name: &str) -> Value {
    let mut errors = Map::new();
    let mut sources = Map::new();

    match run("lpstat", &["-p", name, "-l"]) {
        Ok(output) => {
            sources.insert("lpstatLong".to_string(), Value::String(output));
        }
        Err(error) => {
            errors.insert("lpstatLong".to_string(), Value::String(error));
        }
    }

    match run("lpstat", &["-v", name]) {
        Ok(output) => {
            sources.insert(
                "deviceUri".to_string(),
                Value::String(output.trim().to_string()),
            );
        }
        Err(error) => {
            errors.insert("deviceUri".to_string(), Value::String(error));
        }
    }

    match run("lpoptions", &["-p", name]) {
        Ok(output) => {
            let options = parse_kv_options(&output);
            sources.insert("options".to_string(), Value::Object(options.clone()));
            if let Some(Value::String(device_id)) = options.get("printer-device-id") {
                sources.insert(
                    "ieee1284".to_string(),
                    Value::Object(parse_ieee1284(device_id)),
                );
            }
        }
        Err(error) => {
            errors.insert("options".to_string(), Value::String(error));
        }
    }

    match run("lpoptions", &["-p", name, "-l"]) {
        Ok(output) => {
            sources.insert(
                "optionChoices".to_string(),
                Value::Array(parse_option_choices(&output)),
            );
        }
        Err(error) => {
            errors.insert("optionChoices".to_string(), Value::String(error));
        }
    }

    match read_ppd(name) {
        Ok(ppd) => {
            sources.insert("ppd".to_string(), Value::String(ppd));
        }
        Err(error) => {
            errors.insert("ppd".to_string(), Value::String(error));
        }
    }

    match capture_ipp_attributes(name) {
        Ok(ipp) => {
            if let Some(device_id) = extract_ipp_device_id(&ipp) {
                sources.insert(
                    "ieee1284".to_string(),
                    Value::Object(parse_ieee1284(&device_id)),
                );
            }
            sources.insert("ipp".to_string(), Value::String(ipp));
        }
        Err(error) => {
            errors.insert("ipp".to_string(), Value::String(error));
        }
    }

    json!({
        "name": name,
        "sources": sources,
        "errors": errors,
    })
}

fn unix_host() -> Value {
    json!({
        "uname": capture_command("uname", &["-a"]),
        "osRelease": fs::read_to_string("/etc/os-release").ok(),
        "cupsVersion": capture_command("cups-config", &["--version"]),
    })
}

fn capture_command(program: &str, args: &[&str]) -> Value {
    match run(program, args) {
        Ok(output) => json!({ "ok": true, "data": output }),
        Err(error) => json!({ "ok": false, "error": error }),
    }
}

fn command_started(program: &str, args: &[&str]) -> Option<std::process::Output> {
    match Command::new(program).args(args).output() {
        Ok(output) => Some(output),
        Err(error) if error.kind() == ErrorKind::NotFound => None,
        Err(_) => None,
    }
}

fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|error| format!("could not start {program}: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if !output.status.success() && stdout.trim().is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(if stderr.trim().is_empty() {
            format!("{program} failed")
        } else {
            stderr.trim().to_string()
        });
    }
    Ok(stdout)
}

fn read_ppd(name: &str) -> Result<String, String> {
    let path = PathBuf::from("/etc/cups/ppd").join(format!("{name}.ppd"));
    let contents =
        fs::read_to_string(&path).map_err(|error| format!("ppd unavailable: {error}"))?;
    Ok(truncate(&contents, 120_000))
}

fn capture_ipp_attributes(name: &str) -> Result<String, String> {
    let script = "{
  OPERATION Get-Printer-Attributes
  GROUP operation-attributes-tag
  ATTR charset attributes-charset utf-8
  ATTR language attributes-natural-language en
  ATTR uri printer-uri $uri
  ATTR keyword requested-attributes all
}";
    let temp = TempScript::create(script, "test")?;
    let uri = format!("ipp://localhost/printers/{}", percent_encode(name));
    let output = run(
        "ipptool",
        &[
            "-tv",
            &uri,
            temp.path
                .to_str()
                .ok_or_else(|| "ipp test path is not valid UTF-8".to_string())?,
        ],
    )?;
    Ok(truncate(&output, 120_000))
}

fn extract_ipp_device_id(ipp: &str) -> Option<String> {
    ipp.lines().find_map(|line| {
        let line = line.trim();
        if !line.to_ascii_lowercase().contains("printer-device-id") {
            return None;
        }
        line.split_once('=')
            .or_else(|| line.split_once(':'))
            .map(|(_, value)| value.trim().trim_matches('"').to_string())
            .filter(|value| !value.is_empty())
    })
}

fn parse_kv_options(text: &str) -> Map<String, Value> {
    let mut map = Map::new();
    let mut rest = text.trim();
    while !rest.is_empty() {
        let Some(eq) = rest.find('=') else { break };
        let key = rest[..eq].trim();
        rest = rest[eq + 1..].trim_start();
        let (value, remaining) = if rest.starts_with('\'') {
            split_quoted(rest, '\'')
        } else if rest.starts_with('"') {
            split_quoted(rest, '"')
        } else {
            let end = rest.find(char::is_whitespace).unwrap_or(rest.len());
            (&rest[..end], rest[end..].trim_start())
        };
        if !key.is_empty() {
            map.insert(key.to_string(), Value::String(value.to_string()));
        }
        rest = remaining;
    }
    map
}

fn split_quoted(rest: &str, quote: char) -> (&str, &str) {
    if let Some(end) = rest[1..].find(quote) {
        (&rest[1..1 + end], rest[2 + end..].trim_start())
    } else {
        (rest, "")
    }
}

fn parse_option_choices(text: &str) -> Vec<Value> {
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let (head, values_part) = line.split_once(':')?;
            let (name, label) = match head.split_once('/') {
                Some((name, label)) => (name.trim(), Some(label.trim())),
                None => (head.trim(), None),
            };
            let mut current = None;
            let mut values = Vec::new();
            for token in values_part.split_whitespace() {
                let selected = token.starts_with('*');
                let value = token.trim_start_matches('*').to_string();
                if selected {
                    current = Some(value.clone());
                }
                values.push(value);
            }
            Some(json!({
                "name": name,
                "label": label,
                "current": current,
                "values": values,
            }))
        })
        .collect()
}

fn percent_encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

fn truncate(value: &str, max: usize) -> String {
    if value.len() <= max {
        value.to_string()
    } else {
        format!("{}…[truncated]", &value[..max])
    }
}

struct TempScript {
    path: PathBuf,
}

impl TempScript {
    fn create(contents: &str, extension: &str) -> Result<Self, String> {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!(
            "printkro-printer-inventory-{}-{millis}.{extension}",
            std::process::id()
        ));
        let mut file = fs::File::create(&path)
            .map_err(|error| format!("could not write inventory helper: {error}"))?;
        file.write_all(contents.as_bytes())
            .map_err(|error| format!("could not write inventory helper: {error}"))?;
        Ok(Self { path })
    }
}

impl Drop for TempScript {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

pub fn print_document(printer: &Printer, job: &PrintJob) -> Result<(), String> {
    job.validate()?;
    let path = job.file_path()?;
    println!(
        "Development document job {} -> {} ({})",
        job.id,
        printer.name,
        path.display()
    );
    Ok(())
}
