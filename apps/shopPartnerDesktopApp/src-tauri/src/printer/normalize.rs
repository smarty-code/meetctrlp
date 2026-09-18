use serde_json::{json, Map, Value};

use crate::domain::{
    PaperSize, Printer, PrinterBackendType, PrinterCapabilities, PrinterIdentity, PrinterStatus,
};

use super::InventoryCapture;

pub fn printers_from_capture(capture: &Value, backend: PrinterBackendType) -> Vec<Printer> {
    let default_printer = capture
        .get("defaultPrinter")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    as_array(capture.get("printers"))
        .into_iter()
        .filter_map(|record| {
            let name = first_str(&[&record], &["name", "Name", "id"])?;
            let sources = record
                .get("sources")
                .cloned()
                .unwrap_or(Value::Object(Map::new()));
            let errors = record
                .get("errors")
                .cloned()
                .unwrap_or(Value::Object(Map::new()));
            let is_default = default_printer
                .as_deref()
                .is_some_and(|value| value.eq_ignore_ascii_case(&name));
            let details = json!({
                "sources": sources,
                "errors": errors,
                "isDefault": is_default,
                "defaultPrinter": default_printer,
            });
            let mut printer = printer_from_sources(name, backend.clone(), &details);
            if matches!(
                backend,
                PrinterBackendType::WindowsRaw | PrinterBackendType::WindowsDriver
            ) {
                printer.capabilities.raw_supported = true;
            }
            Some(printer)
        })
        .collect()
}

pub fn printer_from_sources(name: String, backend: PrinterBackendType, details: &Value) -> Printer {
    let sources = details.get("sources").unwrap_or(details);
    let printer_obj = first_object(
        sources,
        &["printer", "msftPrinter", "win32Printer", "options"],
    );
    let configuration = first_object(sources, &["configuration", "win32Configuration"]);
    let win32 = first_object(sources, &["win32Printer"]);
    let driver = first_object(sources, &["driver"]);
    let port = first_object(sources, &["port"]);
    let options = first_object(sources, &["options"]);
    let ieee = sources
        .get("ieee1284")
        .cloned()
        .or_else(|| {
            first_str(
                &[&options, &win32, &printer_obj],
                &["printer-device-id", "printer_device_id", "DeviceID"],
            )
            .map(|value| Value::Object(parse_ieee1284(&value)))
        })
        .unwrap_or(Value::Null);

    let identity = PrinterIdentity {
        manufacturer: first_str(
            &[&printer_obj, &driver, &ieee, &options],
            &[
                "DeviceManufacturer",
                "Manufacturer",
                "MFG",
                "MANUFACTURER",
                "printer-make-and-model",
            ],
        )
        .or_else(|| manufacturer_from_make_and_model(&options)),
        model: first_str(
            &[&printer_obj, &ieee, &options, &driver],
            &[
                "DeviceModel",
                "DeviceDescription",
                "MDL",
                "MODEL",
                "DES",
                "printer-info",
                "printer-make-and-model",
            ],
        ),
        serial_number: first_str(
            &[&ieee, &port, &printer_obj, &options],
            &["SN", "SERIAL", "SERN", "serialNumber", "SerialNumber"],
        )
        .or_else(|| {
            serial_from_uri(first_str(
                &[&port, &options, &printer_obj],
                &[
                    "PrinterHostAddress",
                    "device-uri",
                    "DeviceURL",
                    "device_uri",
                ],
            ))
        }),
        driver_name: first_str(
            &[&printer_obj, &driver, &options],
            &["DriverName", "Name", "printer-make-and-model"],
        ),
        port_name: first_str(&[&printer_obj, &port], &["PortName", "Name", "portName"]),
        location: first_str(&[&printer_obj, &options], &["Location", "printer-location"]),
        comment: first_str(
            &[&printer_obj, &options],
            &["Comment", "Description", "printer-info", "ShareName"],
        ),
        share_name: first_str(&[&printer_obj], &["ShareName", "Share"]),
        device_url: first_str(
            &[&printer_obj, &port, &options],
            &[
                "DeviceURL",
                "device-uri",
                "PrinterHostAddress",
                "printer-uri-supported",
            ],
        ),
        uuid: first_str(
            &[&printer_obj, &options],
            &["DeviceUUID", "printer-uuid", "uuid"],
        ),
        print_processor: first_str(
            &[&printer_obj, &win32],
            &["PrintProcessor", "printProcessor"],
        ),
        datatype: first_str(
            &[&printer_obj, &win32],
            &["Datatype", "PrintJobDataType", "datatype"],
        ),
        computer_name: first_str(&[&printer_obj], &["ComputerName", "computerName"]),
    };

    Printer {
        id: name.clone(),
        name,
        backend,
        status: map_status(&[
            &printer_obj,
            &win32,
            &options,
            sources.get("lpstatLong").unwrap_or(&Value::Null),
        ]),
        identity,
        capabilities: map_capabilities(&[&printer_obj, &configuration, &win32, &options, sources]),
        details: details.clone(),
    }
}

pub fn parse_ieee1284(device_id: &str) -> Map<String, Value> {
    let mut map = Map::new();
    for part in device_id.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((key, value)) = part.split_once(':') {
            let key = key.trim();
            let value = value.trim();
            if !key.is_empty() && !value.is_empty() {
                map.insert(key.to_string(), Value::String(value.to_string()));
            }
        }
    }
    map
}

pub fn capture_from_parts(
    host: Value,
    default_printer: Option<String>,
    catalogs: Value,
    printers: Vec<Printer>,
) -> InventoryCapture {
    InventoryCapture {
        host,
        default_printer,
        catalogs,
        printers,
    }
}

pub fn as_array(value: Option<&Value>) -> Vec<Value> {
    match value {
        Some(Value::Array(items)) => items.clone(),
        Some(item) if !item.is_null() => vec![item.clone()],
        _ => Vec::new(),
    }
}

fn first_object(sources: &Value, keys: &[&str]) -> Value {
    for key in keys {
        if let Some(value) = sources.get(*key) {
            if value.is_object() {
                return value.clone();
            }
            if let Some(items) = value.as_array() {
                if let Some(first) = items.iter().find(|item| item.is_object()) {
                    return first.clone();
                }
            }
        }
    }
    Value::Null
}

fn first_str(sources: &[&Value], keys: &[&str]) -> Option<String> {
    for source in sources {
        for key in keys {
            if let Some(value) = get_ignore_case(source, key) {
                if let Some(text) = value_as_string(value) {
                    return Some(text);
                }
            }
        }
    }
    None
}

fn get_ignore_case<'a>(source: &'a Value, key: &str) -> Option<&'a Value> {
    let object = source.as_object()?;
    object.get(key).or_else(|| {
        object.iter().find_map(|(candidate, value)| {
            if candidate.eq_ignore_ascii_case(key) {
                Some(value)
            } else {
                None
            }
        })
    })
}

fn value_as_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let text = text.trim();
            if text.is_empty() || text.eq_ignore_ascii_case("null") {
                None
            } else {
                Some(text.to_string())
            }
        }
        Value::Bool(flag) => Some(flag.to_string()),
        Value::Number(number) => Some(number.to_string()),
        Value::Array(items) => {
            let joined = items
                .iter()
                .filter_map(value_as_string)
                .collect::<Vec<_>>()
                .join(", ");
            if joined.is_empty() {
                None
            } else {
                Some(joined)
            }
        }
        _ => None,
    }
}

fn manufacturer_from_make_and_model(options: &Value) -> Option<String> {
    first_str(&[options], &["printer-make-and-model"])
        .and_then(|value| value.split_whitespace().next().map(ToOwned::to_owned))
}

fn serial_from_uri(uri: Option<String>) -> Option<String> {
    let uri = uri?;
    for marker in ["serial=", "serialNumber=", "SN="] {
        if let Some(index) = uri.to_ascii_lowercase().find(&marker.to_ascii_lowercase()) {
            let value = &uri[index + marker.len()..];
            let value = value.split('&').next()?.split('?').next()?.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn map_status(sources: &[&Value]) -> PrinterStatus {
    let mut chunks = Vec::new();
    for source in sources {
        if let Some(text) = value_as_string(source) {
            chunks.push(text);
        }
        for key in [
            "PrinterStatus",
            "printer-state",
            "printer-state-reasons",
            "DetectedErrorState",
            "Status",
            "WorkOffline",
        ] {
            if let Some(text) = first_str(&[source], &[key]) {
                chunks.push(text);
            }
        }
    }
    let haystack = chunks.join(" ").to_ascii_lowercase();
    if haystack.contains("offline") || haystack.contains("workoffline") {
        PrinterStatus::Offline
    } else if haystack.contains("error")
        || haystack.contains("jam")
        || haystack.contains("door")
        || haystack.contains("no-toner")
        || haystack.contains("paper-out")
    {
        PrinterStatus::Error
    } else if haystack.contains("print")
        || haystack.contains("processing")
        || haystack.contains("busy")
    {
        PrinterStatus::Printing
    } else if haystack.contains("paused")
        || haystack.contains("stopped")
        || haystack.contains("disabled")
    {
        PrinterStatus::Paused
    } else if haystack.contains("idle")
        || haystack.contains("online")
        || haystack.contains("normal")
        || haystack.contains("ready")
        || haystack.split_whitespace().any(|token| token == "3")
    {
        PrinterStatus::Online
    } else {
        PrinterStatus::Unknown
    }
}

fn map_capabilities(sources: &[&Value]) -> PrinterCapabilities {
    let media = collect_media(sources);
    let color_modes = collect_values(
        sources,
        &[
            "print-color-mode-supported",
            "ColorModel",
            "color-modes",
            "CapabilityDescriptions",
        ],
    );
    let sides = collect_values(
        sources,
        &["sides-supported", "DuplexingMode", "Duplex", "sides"],
    );
    let document_formats = collect_values(
        sources,
        &[
            "document-format-supported",
            "Content types",
            "document_formats",
        ],
    );
    let resolutions = collect_values(
        sources,
        &[
            "printer-resolution-supported",
            "Resolution",
            "PrintQuality",
            "HorizontalResolution",
            "VerticalResolution",
        ],
    );
    let color = infer_color(sources, &color_modes);
    let duplex = sides.iter().any(|value| {
        let value = value.to_ascii_lowercase();
        value.contains("two")
            || value.contains("duplex")
            || value.contains("long")
            || value.contains("short")
    }) || boolish(sources, &["Duplex", "duplex"]);
    let duplex_mode = first_str(
        sources,
        &["DuplexingMode", "sides-default", "Duplex", "sides"],
    );

    PrinterCapabilities {
        color,
        duplex,
        duplex_mode,
        paper_sizes: media
            .iter()
            .filter_map(|value| map_paper_size(value))
            .collect(),
        media,
        raw_supported: matches!(
            // Windows spooler always accepts RAW; CUPS may not.
            first_str(sources, &["Datatype", "PrintJobDataType"]),
            Some(value) if value.to_ascii_lowercase().contains("raw")
        ) || sources.iter().any(|source| {
            source
                .get("raw_supported")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        }),
        color_modes,
        sides,
        document_formats,
        resolutions,
    }
}

fn infer_color(sources: &[&Value], color_modes: &[String]) -> bool {
    if color_modes.iter().any(|value| {
        let value = value.to_ascii_lowercase();
        value.contains("color") || value.contains("rgb") || value.contains("cmyk")
    }) {
        return true;
    }
    if let Some(value) = first_str(
        sources,
        &[
            "Color",
            "print-color-mode-default",
            "print-color-mode-supported",
        ],
    ) {
        let value = value.to_ascii_lowercase();
        if value == "2" || value == "true" || value.contains("color") {
            return true;
        }
        if value == "1" || value == "false" || value.contains("mono") || value.contains("gray") {
            return false;
        }
    }
    boolish(sources, &["Color", "color"])
}

fn boolish(sources: &[&Value], keys: &[&str]) -> bool {
    for source in sources {
        for key in keys {
            match get_ignore_case(source, key) {
                Some(Value::Bool(true)) => return true,
                Some(Value::Number(number)) if number.as_i64() == Some(2) => return true,
                Some(Value::String(text)) => {
                    let text = text.to_ascii_lowercase();
                    if text == "true" || text == "color" || text == "yes" {
                        return true;
                    }
                }
                _ => {}
            }
        }
    }
    false
}

fn collect_media(sources: &[&Value]) -> Vec<String> {
    let mut media = collect_values(
        sources,
        &[
            "PrinterPaperNames",
            "PaperSizesSupported",
            "media-supported",
            "media-ready",
            "PaperSize",
            "PageSize",
            "media",
        ],
    );
    media.extend(collect_option_values(
        sources,
        &["PageSize", "MediaType", "media"],
    ));
    media.sort();
    media.dedup();
    media
}

fn collect_values(sources: &[&Value], keys: &[&str]) -> Vec<String> {
    let mut values = Vec::new();
    for source in sources {
        for key in keys {
            if let Some(value) = get_ignore_case(source, key) {
                push_strings(value, &mut values);
            }
        }
        if let Some(choices) = source
            .get("optionChoices")
            .or_else(|| source.get("option_choices"))
        {
            for choice in as_array(Some(choices)) {
                let name = first_str(&[&choice], &["name"]).unwrap_or_default();
                if keys.iter().any(|key| name.eq_ignore_ascii_case(key)) {
                    if let Some(current) = first_str(&[&choice], &["current"]) {
                        values.push(current);
                    }
                    if let Some(list) = choice.get("values") {
                        push_strings(list, &mut values);
                    }
                }
            }
        }
    }
    values.sort();
    values.dedup();
    values
}

fn collect_option_values(sources: &[&Value], names: &[&str]) -> Vec<String> {
    let mut values = Vec::new();
    for source in sources {
        if let Some(choices) = source.get("optionChoices") {
            for choice in as_array(Some(choices)) {
                let name = first_str(&[&choice], &["name"]).unwrap_or_default();
                if names
                    .iter()
                    .any(|candidate| name.eq_ignore_ascii_case(candidate))
                {
                    if let Some(list) = choice.get("values") {
                        push_strings(list, &mut values);
                    }
                }
            }
        }
    }
    values
}

fn push_strings(value: &Value, values: &mut Vec<String>) {
    match value {
        Value::Array(items) => {
            for item in items {
                push_strings(item, values);
            }
        }
        _ => {
            if let Some(text) = value_as_string(value) {
                for part in text.split(|ch: char| ch == ',' || ch == ';') {
                    let part = part.trim();
                    if !part.is_empty() {
                        values.push(part.to_string());
                    }
                }
            }
        }
    }
}

fn map_paper_size(value: &str) -> Option<PaperSize> {
    let normalized = value.to_ascii_lowercase().replace([' ', '-', '_'], "");
    if normalized.contains("a4") {
        Some(PaperSize::A4)
    } else if normalized.contains("a3") {
        Some(PaperSize::A3)
    } else if normalized.contains("letter")
        || normalized.contains("na_letter")
        || normalized.contains("naletter")
    {
        Some(PaperSize::Letter)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{map_paper_size, parse_ieee1284, printers_from_capture};
    use crate::domain::{PaperSize, PrinterBackendType};
    use serde_json::json;

    #[test]
    fn parses_ieee1284_device_id() {
        let parsed = parse_ieee1284("MFG:HP;MDL:LaserJet MFP;CMD:PCL,PDF;SN:ABC123;");
        assert_eq!(
            parsed.get("MFG").and_then(|value| value.as_str()),
            Some("HP")
        );
        assert_eq!(
            parsed.get("SN").and_then(|value| value.as_str()),
            Some("ABC123")
        );
    }

    #[test]
    fn maps_known_paper_sizes() {
        assert!(matches!(
            map_paper_size("iso_a4_210x297mm"),
            Some(PaperSize::A4)
        ));
        assert!(matches!(
            map_paper_size("na_letter_8.5x11in"),
            Some(PaperSize::Letter)
        ));
    }

    #[test]
    fn builds_printers_from_windows_capture() {
        let capture = json!({
            "defaultPrinter": "Front Desk",
            "printers": [{
                "name": "Front Desk",
                "sources": {
                    "printer": {
                        "Name": "Front Desk",
                        "DriverName": "HP Universal",
                        "PortName": "IP_10.0.0.12",
                        "PrinterStatus": "Normal",
                        "DeviceManufacturer": "HP",
                        "DeviceModel": "LaserJet"
                    },
                    "configuration": { "Color": true, "DuplexingMode": "TwoSidedLongEdge", "PaperSize": "A4" }
                },
                "errors": {}
            }]
        });
        let printers = printers_from_capture(&capture, PrinterBackendType::WindowsRaw);
        assert_eq!(printers.len(), 1);
        assert_eq!(printers[0].identity.manufacturer.as_deref(), Some("HP"));
        assert!(printers[0].capabilities.color);
        assert!(printers[0].capabilities.duplex);
        assert_eq!(printers[0].details["isDefault"], true);
    }
}
