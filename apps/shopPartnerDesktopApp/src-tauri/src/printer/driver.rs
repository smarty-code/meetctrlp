#![cfg(windows)]

use std::{
    ffi::c_void,
    mem,
    path::{Path, PathBuf},
};

use image::DynamicImage;
use windows::{
    core::{w, PCWSTR},
    Win32::{
        Foundation::{GetLastError, HANDLE, HWND},
        Graphics::{
            Gdi::{
                CreateDCW, DeleteDC, GetDeviceCaps, StretchDIBits, BITMAPINFO, BITMAPINFOHEADER,
                DEVMODE_COLOR, DIB_RGB_COLORS, DM_IN_BUFFER, DM_OUT_BUFFER, HORZRES, SRCCOPY,
                VERTRES,
            },
            Printing::{ClosePrinter, DocumentPropertiesW, OpenPrinterW},
        },
        Storage::Xps::{EndDoc, EndPage, StartDocW, StartPage, DOCINFOW},
        System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED},
    },
};

use crate::domain::{ColorMode, PrintJob, Printer};

use super::options::{driver_dev_mode, selected_pages, DriverDevMode};

pub fn print_document(printer: &Printer, job: &PrintJob) -> Result<(), String> {
    job.validate()?;
    let path = job.file_path()?;
    let settings = driver_dev_mode(&job.options)?;
    let pages = rasterize_document(path, job)?;
    if pages.is_empty() {
        return Err("document produced no printable pages".to_string());
    }
    print_pages(&printer.name, &pages, &settings, job.options.color_mode)
}

fn rasterize_document(path: &Path, job: &PrintJob) -> Result<Vec<DynamicImage>, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "png" | "jpg" | "jpeg" => {
            let image =
                image::open(path).map_err(|error| format!("could not decode image: {error}"))?;
            let pages = selected_pages(&job.options.page_selection, 1)?;
            Ok(pages.into_iter().map(|_| image.clone()).collect())
        }
        "pdf" => render_pdf_pages(path, job),
        _ => Err("document type must be PDF, JPG, JPEG, or PNG".to_string()),
    }
}

fn render_pdf_pages(path: &Path, job: &PrintJob) -> Result<Vec<DynamicImage>, String> {
    unsafe {
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }

    let path = path
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(path))
        .to_string_lossy()
        .to_string();
    let file = wait_async(
        windows::Storage::StorageFile::GetFileFromPathAsync(&windows::core::HSTRING::from(
            path.as_str(),
        ))
        .map_err(|error| format!("could not open PDF path: {error}"))?,
    )?;
    let pdf = wait_async(
        windows::Data::Pdf::PdfDocument::LoadFromFileAsync(&file)
            .map_err(|error| format!("could not load PDF: {error}"))?,
    )?;
    let page_count = pdf
        .PageCount()
        .map_err(|error| format!("could not read PDF page count: {error}"))?;
    let pages = selected_pages(&job.options.page_selection, page_count)?;
    let mut images = Vec::new();
    for page_number in pages {
        let page = pdf
            .GetPage(page_number - 1)
            .map_err(|error| format!("could not read PDF page {page_number}: {error}"))?;
        let size = page
            .Size()
            .map_err(|error| format!("could not read PDF page size: {error}"))?;
        let width = ((size.Width * 150.0) / 96.0).round().max(1.0) as u32;
        let height = ((size.Height * 150.0) / 96.0).round().max(1.0) as u32;
        let stream = windows::Storage::Streams::InMemoryRandomAccessStream::new()
            .map_err(|error| format!("could not create PDF render stream: {error}"))?;
        let options = windows::Data::Pdf::PdfPageRenderOptions::new()
            .map_err(|error| format!("could not create PDF render options: {error}"))?;
        options
            .SetDestinationWidth(width)
            .map_err(|error| format!("could not set PDF render width: {error}"))?;
        options
            .SetDestinationHeight(height)
            .map_err(|error| format!("could not set PDF render height: {error}"))?;
        wait_action(
            page.RenderWithOptionsToStreamAsync(&stream, &options)
                .map_err(|error| format!("could not render PDF page {page_number}: {error}"))?,
        )?;
        stream
            .Seek(0)
            .map_err(|error| format!("could not rewind PDF render stream: {error}"))?;
        let stream_size = stream
            .Size()
            .map_err(|error| format!("could not read PDF render size: {error}"))?;
        let input = stream
            .GetInputStreamAt(0)
            .map_err(|error| format!("could not read PDF render stream: {error}"))?;
        let reader = windows::Storage::Streams::DataReader::CreateDataReader(&input)
            .map_err(|error| format!("could not read PDF render bytes: {error}"))?;
        wait_load(
            reader
                .LoadAsync(stream_size as u32)
                .map_err(|error| format!("could not load PDF render bytes: {error}"))?,
        )?;
        let mut bytes = vec![0u8; stream_size as usize];
        reader
            .ReadBytes(&mut bytes)
            .map_err(|error| format!("could not copy PDF render bytes: {error}"))?;
        images.push(
            image::load_from_memory(&bytes)
                .map_err(|error| format!("could not decode rendered PDF page: {error}"))?,
        );
        let _ = page.Close();
    }
    Ok(images)
}

fn print_pages(
    printer_name: &str,
    pages: &[DynamicImage],
    settings: &DriverDevMode,
    color_mode: ColorMode,
) -> Result<(), String> {
    let printer_wide = wide(printer_name)?;
    let mut handle = HANDLE::default();
    unsafe { OpenPrinterW(PCWSTR(printer_wide.as_ptr()), &mut handle, None) }
        .map_err(|error| format!("could not open printer: {error}"))?;

    let result = (|| {
        let mut devmode = printer_devmode(handle, &printer_wide, settings)?;
        let hdc = unsafe {
            CreateDCW(
                w!("WINSPOOL"),
                PCWSTR(printer_wide.as_ptr()),
                PCWSTR::null(),
                Some(devmode.as_ptr()),
            )
        };
        if hdc.is_invalid() {
            return Err(last_error("could not create a printer device context"));
        }

        let print_result = (|| {
            let doc_name = wide("PrintKro Document")?;
            let info = DOCINFOW {
                cbSize: mem::size_of::<DOCINFOW>() as i32,
                lpszDocName: PCWSTR(doc_name.as_ptr()),
                lpszOutput: PCWSTR::null(),
                lpszDatatype: PCWSTR::null(),
                fwType: 0,
            };
            if unsafe { StartDocW(hdc, &info) } <= 0 {
                return Err(last_error("Windows spooler rejected the document"));
            }

            let page_result = (|| {
                let page_w = unsafe { GetDeviceCaps(hdc, HORZRES) };
                let page_h = unsafe { GetDeviceCaps(hdc, VERTRES) };
                for page in pages {
                    if unsafe { StartPage(hdc) } <= 0 {
                        return Err(last_error("Windows spooler rejected a document page"));
                    }
                    blit_page(hdc, page, page_w, page_h, color_mode)?;
                    if unsafe { EndPage(hdc) } <= 0 {
                        return Err(last_error(
                            "Windows spooler could not finish a document page",
                        ));
                    }
                }
                Ok(())
            })();

            unsafe { EndDoc(hdc) };
            page_result
        })();

        unsafe { DeleteDC(hdc) };
        print_result
    })();

    unsafe {
        let _ = ClosePrinter(handle);
    }
    result
}

struct DevModeBuffer {
    buffer: Vec<u8>,
}

impl DevModeBuffer {
    fn as_ptr(&self) -> *const windows::Win32::Graphics::Gdi::DEVMODEW {
        self.buffer.as_ptr() as *const windows::Win32::Graphics::Gdi::DEVMODEW
    }

    fn as_mut_ptr(&mut self) -> *mut windows::Win32::Graphics::Gdi::DEVMODEW {
        self.buffer.as_mut_ptr() as *mut windows::Win32::Graphics::Gdi::DEVMODEW
    }
}

fn printer_devmode(
    handle: HANDLE,
    printer_wide: &[u16],
    settings: &DriverDevMode,
) -> Result<DevModeBuffer, String> {
    let needed = unsafe {
        DocumentPropertiesW(
            HWND::default(),
            handle,
            PCWSTR(printer_wide.as_ptr()),
            None,
            None,
            0,
        )
    };
    if needed <= 0 {
        return Err(last_error("could not read printer DEVMODE size"));
    }

    let mut devmode = DevModeBuffer {
        buffer: vec![0u8; needed as usize],
    };
    let filled = unsafe {
        DocumentPropertiesW(
            HWND::default(),
            handle,
            PCWSTR(printer_wide.as_ptr()),
            Some(devmode.as_mut_ptr()),
            None,
            DM_OUT_BUFFER.0,
        )
    };
    if filled < 0 {
        return Err(last_error("could not read printer DEVMODE"));
    }

    unsafe {
        let mode = &mut *devmode.as_mut_ptr();
        mode.dmFields |= windows::Win32::Graphics::Gdi::DM_COPIES
            | windows::Win32::Graphics::Gdi::DM_COLOR
            | windows::Win32::Graphics::Gdi::DM_PAPERSIZE;
        mode.Anonymous1.Anonymous1.dmCopies = settings.copies;
        mode.dmColor = DEVMODE_COLOR(settings.color);
        mode.Anonymous1.Anonymous1.dmPaperSize = settings.paper_size;
    }

    let applied = unsafe {
        DocumentPropertiesW(
            HWND::default(),
            handle,
            PCWSTR(printer_wide.as_ptr()),
            Some(devmode.as_mut_ptr()),
            Some(devmode.as_ptr()),
            DM_IN_BUFFER.0 | DM_OUT_BUFFER.0,
        )
    };
    if applied < 0 {
        return Err(last_error("could not apply printer DEVMODE"));
    }
    Ok(devmode)
}

fn blit_page(
    hdc: windows::Win32::Graphics::Gdi::HDC,
    page: &DynamicImage,
    page_w: i32,
    page_h: i32,
    color_mode: ColorMode,
) -> Result<(), String> {
    let rgb = match color_mode {
        ColorMode::BlackAndWhite => DynamicImage::ImageLuma8(page.to_luma8()).to_rgb8(),
        ColorMode::Color => page.to_rgb8(),
    };
    let width = rgb.width() as i32;
    let height = rgb.height() as i32;
    if width <= 0 || height <= 0 || page_w <= 0 || page_h <= 0 {
        return Err("printable page area is empty".to_string());
    }

    let stride = ((width * 3 + 3) / 4) * 4;
    let mut bits = vec![0u8; (stride * height) as usize];
    for y in 0..height {
        let src_y = (height - 1 - y) as u32;
        let row = (y * stride) as usize;
        for x in 0..width {
            let pixel = rgb.get_pixel(x as u32, src_y);
            let offset = row + (x * 3) as usize;
            bits[offset] = pixel[2];
            bits[offset + 1] = pixel[1];
            bits[offset + 2] = pixel[0];
        }
    }

    let info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: height,
            biPlanes: 1,
            biBitCount: 24,
            biCompression: 0,
            biSizeImage: bits.len() as u32,
            ..Default::default()
        },
        ..Default::default()
    };
    let scale = (page_w as f64 / width as f64).min(page_h as f64 / height as f64);
    let dest_w = ((width as f64) * scale).round() as i32;
    let dest_h = ((height as f64) * scale).round() as i32;
    let dest_x = (page_w - dest_w) / 2;
    let dest_y = (page_h - dest_h) / 2;
    let copied = unsafe {
        StretchDIBits(
            hdc,
            dest_x,
            dest_y,
            dest_w,
            dest_h,
            0,
            0,
            width,
            height,
            Some(bits.as_ptr() as *const c_void),
            &info,
            DIB_RGB_COLORS,
            SRCCOPY,
        )
    };
    if copied == 0 || copied == -1 {
        return Err(last_error("could not blit the document page"));
    }
    Ok(())
}

fn wait_action(operation: windows::Foundation::IAsyncAction) -> Result<(), String> {
    loop {
        match operation
            .Status()
            .map_err(|error| format!("PDF async status failed: {error}"))?
        {
            windows::Foundation::AsyncStatus::Completed => return Ok(()),
            windows::Foundation::AsyncStatus::Error
            | windows::Foundation::AsyncStatus::Canceled => {
                return Err("PDF operation failed".to_string());
            }
            _ => std::thread::sleep(std::time::Duration::from_millis(15)),
        }
    }
}

fn wait_load(operation: windows::Storage::Streams::DataReaderLoadOperation) -> Result<u32, String> {
    loop {
        match operation
            .Status()
            .map_err(|error| format!("PDF async status failed: {error}"))?
        {
            windows::Foundation::AsyncStatus::Completed => {
                return operation
                    .GetResults()
                    .map_err(|error| format!("PDF async result failed: {error}"));
            }
            windows::Foundation::AsyncStatus::Error
            | windows::Foundation::AsyncStatus::Canceled => {
                return Err("PDF operation failed".to_string());
            }
            _ => std::thread::sleep(std::time::Duration::from_millis(15)),
        }
    }
}

fn wait_async<T>(operation: windows::Foundation::IAsyncOperation<T>) -> Result<T, String>
where
    T: windows::core::RuntimeType,
{
    loop {
        match operation
            .Status()
            .map_err(|error| format!("PDF async status failed: {error}"))?
        {
            windows::Foundation::AsyncStatus::Completed => {
                return operation
                    .GetResults()
                    .map_err(|error| format!("PDF async result failed: {error}"));
            }
            windows::Foundation::AsyncStatus::Error
            | windows::Foundation::AsyncStatus::Canceled => {
                return Err("PDF operation failed".to_string());
            }
            _ => std::thread::sleep(std::time::Duration::from_millis(15)),
        }
    }
}

fn wide(value: &str) -> Result<Vec<u16>, String> {
    if value.contains('\0') {
        return Err("printer name contains an invalid null character".to_string());
    }
    Ok(value.encode_utf16().chain(std::iter::once(0)).collect())
}

fn last_error(context: &str) -> String {
    let code = unsafe { GetLastError() };
    format!("{context} (Win32 error {})", code.0)
}
