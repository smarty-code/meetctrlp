use crate::domain::{ColorMode, PageSelection, PaperSize, PrintOptions};

pub const DMPAPER_LETTER: i16 = 1;
pub const DMPAPER_A3: i16 = 8;
pub const DMPAPER_A4: i16 = 9;
pub const DMCOLOR_MONOCHROME: i16 = 1;
pub const DMCOLOR_COLOR: i16 = 2;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DriverDevMode {
    pub copies: i16,
    pub color: i16,
    pub paper_size: i16,
}

pub fn driver_dev_mode(options: &PrintOptions) -> Result<DriverDevMode, String> {
    options.validate()?;
    Ok(DriverDevMode {
        copies: i16::try_from(options.copies).map_err(|_| "copies is too large".to_string())?,
        color: match options.color_mode {
            ColorMode::Color => DMCOLOR_COLOR,
            ColorMode::BlackAndWhite => DMCOLOR_MONOCHROME,
        },
        paper_size: match options.paper_size {
            PaperSize::Letter => DMPAPER_LETTER,
            PaperSize::A3 => DMPAPER_A3,
            PaperSize::A4 => DMPAPER_A4,
        },
    })
}

pub fn selected_pages(selection: &PageSelection, page_count: u32) -> Result<Vec<u32>, String> {
    if page_count == 0 {
        return Err("document has no pages".to_string());
    }

    match selection {
        PageSelection::All => Ok((1..=page_count).collect()),
        PageSelection::Pages(pages) => {
            if pages.is_empty() {
                return Err("page selection must contain positive page numbers".to_string());
            }
            for page in pages {
                if *page == 0 || *page > page_count {
                    return Err(format!("page {page} is outside 1-{page_count}"));
                }
            }
            Ok(pages.clone())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        driver_dev_mode, selected_pages, DMCOLOR_COLOR, DMCOLOR_MONOCHROME, DMPAPER_A4,
        DMPAPER_LETTER,
    };
    use crate::domain::{ColorMode, PageSelection, PaperSize, PrintOptions};

    fn options() -> PrintOptions {
        PrintOptions {
            color_mode: ColorMode::Color,
            paper_size: PaperSize::A4,
            copies: 2,
            page_selection: PageSelection::All,
        }
    }

    #[test]
    fn maps_color_paper_and_copies() {
        let mapped = driver_dev_mode(&options()).unwrap();
        assert_eq!(mapped.copies, 2);
        assert_eq!(mapped.color, DMCOLOR_COLOR);
        assert_eq!(mapped.paper_size, DMPAPER_A4);

        let mut mono = options();
        mono.color_mode = ColorMode::BlackAndWhite;
        mono.paper_size = PaperSize::Letter;
        let mapped = driver_dev_mode(&mono).unwrap();
        assert_eq!(mapped.color, DMCOLOR_MONOCHROME);
        assert_eq!(mapped.paper_size, DMPAPER_LETTER);
    }

    #[test]
    fn selects_all_or_explicit_pages() {
        assert_eq!(
            selected_pages(&PageSelection::All, 3).unwrap(),
            vec![1, 2, 3]
        );
        assert_eq!(
            selected_pages(&PageSelection::Pages(vec![2]), 3).unwrap(),
            vec![2]
        );
        assert!(selected_pages(&PageSelection::Pages(vec![4]), 3).is_err());
        assert!(selected_pages(&PageSelection::All, 0).is_err());
    }
}
