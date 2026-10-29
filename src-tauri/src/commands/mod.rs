use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

pub mod app;
pub mod library;
pub mod page_cache;
pub mod updates;
pub mod window;

pub const SETTINGS_CHANGED: &str = "settings_changed";
pub const FILES_DROPPED: &str = "files_dropped";

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LibraryEntry {
    pub file_path: String,
    pub title: String,
    #[serde(rename = "coverURL")]
    pub cover_url: String,
    pub progress: u32,
    pub page_count: u32,
    pub last_opened: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub default_fit_mode: String,
    pub remember_reading_position: bool,
    pub show_progress_bars: bool,
    pub theme: String,
    /// "scroll" (one long column), "single" (one page at a time) or "spread" (two-page spreads).
    pub reading_layout: String,
    /// "ltr" or "rtl" (manga); applies to the single and spread layouts.
    pub reading_direction: String,
    /// "recent", "title" or "progress".
    pub library_sort: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            default_fit_mode: "fit-width".into(),
            remember_reading_position: true,
            show_progress_bars: true,
            theme: "onyx".into(),
            reading_layout: "scroll".into(),
            reading_direction: "ltr".into(),
            library_sort: "recent".into(),
        }
    }
}

impl Settings {
    pub fn sanitized(mut self) -> Self {
        if !matches!(self.default_fit_mode.as_str(), "fit-width" | "fit-height" | "original") {
            self.default_fit_mode = "fit-width".into();
        }
        if self.theme.is_empty() {
            self.theme = "onyx".into();
        }
        if !matches!(self.reading_layout.as_str(), "scroll" | "single" | "spread") {
            self.reading_layout = "scroll".into();
        }
        if !matches!(self.reading_direction.as_str(), "ltr" | "rtl") {
            self.reading_direction = "ltr".into();
        }
        if !matches!(self.library_sort.as_str(), "recent" | "title" | "progress") {
            self.library_sort = "recent".into();
        }
        self
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootPayload {
    pub library: Vec<LibraryEntry>,
    pub settings: Settings,
    pub version: String,
}

#[derive(Default)]
pub struct BackendState {
    pub library: Mutex<Vec<LibraryEntry>>,
    pub settings: Mutex<Settings>,
    /// Fully unpacked comics, persisted between launches (see page_cache).
    pub page_cache: Mutex<HashMap<String, page_cache::CachedComic>>,
    pub inspection_cache: Mutex<HashMap<String, ExtractionResult>>,
    pub cancellation: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub renderer_ready: AtomicBool,
    // Set while the window is unfocused; extraction waits, like the Electron build's waitIfBackgrounded.
    pub window_blurred: Arc<AtomicBool>,
    pub pending_open_files: Mutex<Vec<String>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComicInspection {
    pub title: String,
    pub page_count: u32,
    pub cover_page: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionResult {
    pub directory: String,
    pub pages: Vec<String>,
    pub title: String,
    pub page_count: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub state: String,
    pub current_version: String,
    pub available_version: Option<String>,
    pub downloaded_version: Option<String>,
    pub progress: f64,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::LibraryEntry;

    #[test]
    fn settings_fall_back_to_defaults_for_unknown_values() {
        let settings: super::Settings = serde_json::from_str(r#"{"readingLayout":"carousel","readingDirection":"up","librarySort":"random","theme":""}"#).unwrap();
        let settings = settings.sanitized();
        assert_eq!((settings.reading_layout.as_str(), settings.reading_direction.as_str(), settings.library_sort.as_str()), ("scroll", "ltr", "recent"));
        assert_eq!(settings.theme, "onyx");

        let older: super::Settings = serde_json::from_str(r#"{"defaultFitMode":"fit-height"}"#).unwrap();
        assert_eq!(older.reading_layout, "scroll", "settings saved before these fields existed get the defaults");
        assert_eq!(older.default_fit_mode, "fit-height");
    }

    #[test]
    fn library_entry_uses_renderer_field_names() {
        let json = r#"{"filePath":"/a.cbz","title":"A","coverURL":"data:x","progress":4,"pageCount":9,"lastOpened":null}"#;
        let entry: LibraryEntry = serde_json::from_str(json).unwrap();
        assert_eq!(entry.cover_url, "data:x");
        assert_eq!(serde_json::to_value(&entry).unwrap(), serde_json::from_str::<serde_json::Value>(json).unwrap());
    }
}
