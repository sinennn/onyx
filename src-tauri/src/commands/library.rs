use std::cmp::Ordering;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use std::sync::Arc;

use rfd::FileDialog;
use sevenz_rust2::{Archive as SevenZipArchive, ArchiveReader as SevenZipReader, Password};
use tauri::{AppHandle, Emitter, Manager, State};
use unrar::Archive as RarArchive;
use zip::ZipArchive;

use super::page_cache::{self, CachedComic};
use super::{BackendState, ComicInspection, ExtractionResult, LibraryEntry, Settings, SETTINGS_CHANGED};

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "avif"];
const STORE_FILE: &str = "onyx-library.json";
const ARCHIVE_EXTENSIONS: &[&str] = &["cbz", "zip", "cbr", "rar", "cb7", "7z"];
// Cover previews live in the temp folder and are cleared on quit; full extractions live in the
// app's cache folder and are kept for the most recently read comics.
const PREVIEW_DIR: &str = "onyx-cache";
const PAGES_DIR: &str = "pages";
const NO_PAGES: &str = "No readable pages were found in this archive.";
const CANCELLED: &str = "Extraction cancelled";

fn extension(path: &str) -> String {
    Path::new(path).extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase()
}

fn is_image(path: &str) -> bool {
    IMAGE_EXTENSIONS.contains(&extension(path).as_str())
}

pub fn is_comic_path(path: &str) -> bool {
    ARCHIVE_EXTENSIONS.contains(&extension(path).as_str())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ArchiveKind {
    Zip,
    Rar,
    SevenZip,
}

const RAR_SIGNATURE: &[u8] = b"Rar!\x1a\x07";
const ZIP_SIGNATURES: &[&[u8]] = &[b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"];
const SEVEN_ZIP_SIGNATURE: &[u8] = b"7z\xbc\xaf\x27\x1c";

// Comic archives are often mislabelled (a ZIP saved as .cbr, or the reverse), so the file's
// signature wins over its extension, as in MComix and other readers..
fn archive_kind(path: &str) -> Result<ArchiveKind, String> {
    let mut header = Vec::with_capacity(8);
    fs::File::open(path).and_then(|file| file.take(8).read_to_end(&mut header)).map_err(|error| error.to_string())?;
    if header.starts_with(RAR_SIGNATURE) { return Ok(ArchiveKind::Rar); }
    if ZIP_SIGNATURES.iter().any(|signature| header.starts_with(signature)) { return Ok(ArchiveKind::Zip); }
    if header.starts_with(SEVEN_ZIP_SIGNATURE) { return Ok(ArchiveKind::SevenZip); }
    // No known signature at the start (e.g. a self-extracting RAR): fall back to the extension.
    Ok(match extension(path).as_str() {
        "cbr" | "rar" => ArchiveKind::Rar,
        "cb7" | "7z" => ArchiveKind::SevenZip,
        _ => ArchiveKind::Zip,
    })
}

fn title_from_path(path: &str) -> String {
    let stem = Path::new(path).file_stem().and_then(|value| value.to_str()).unwrap_or("Untitled comic");
    let mut title = String::with_capacity(stem.len());
    let mut in_separator = false;
    for character in stem.chars() {
        let is_separator = character == '_' || character == '-';
        if !is_separator { title.push(character); }
        else if !in_separator { title.push(' '); }
        in_separator = is_separator;
    }
    title.trim().to_string()
}


fn natural_cmp(left: &str, right: &str) -> Ordering {
    let (mut left, mut right) = (left.chars().peekable(), right.chars().peekable());
    loop {
        match (left.peek().copied(), right.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(a), Some(b)) if a.is_ascii_digit() && b.is_ascii_digit() => {
                let take_number = |chars: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut digits = String::new();
                    while let Some(digit) = chars.peek().copied().filter(char::is_ascii_digit) {
                        digits.push(digit);
                        chars.next();
                    }
                    digits.trim_start_matches('0').to_string()
                };
                let (a, b) = (take_number(&mut left), take_number(&mut right));
                let ordering = a.len().cmp(&b.len()).then_with(|| a.cmp(&b));
                if ordering != Ordering::Equal { return ordering; }
            }
            (Some(a), Some(b)) => {
                let ordering = a.to_lowercase().cmp(b.to_lowercase());
                if ordering != Ordering::Equal { return ordering; }
                left.next();
                right.next();
            }
        }
    }
}

fn sort_natural(names: &mut [String]) {
    names.sort_by(|left, right| natural_cmp(left, right));
}

fn preview_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().temp_dir().map_err(|error| error.to_string())?.join(PREVIEW_DIR))
}

fn pages_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_cache_dir().map_err(|error| error.to_string())?.join(PAGES_DIR))
}

fn cache_directory(app: &AppHandle, file_path: &str, preview: bool) -> Result<PathBuf, String> {
    let stem = Path::new(file_path).file_stem().and_then(|value| value.to_str()).unwrap_or("comic").chars()
        .map(|character| if character.is_ascii_alphanumeric() || character == '.' || character == '-' || character == '_' { character } else { '-' })
        .take(48).collect::<String>();
    let hash = file_path.bytes().fold(2166136261u64, |hash, byte| (hash ^ byte as u64).wrapping_mul(16777619));
    let suffix = if preview { "-preview" } else { "" };
    let root = if preview { preview_root(app)? } else { pages_root(app)? };
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root.join(format!("{stem}-{hash:016x}{suffix}")))
}

fn reset_directory(directory: &Path) -> Result<(), String> {
    let _ = fs::remove_dir_all(directory);
    fs::create_dir_all(directory).map_err(|error| error.to_string())
}

/// Removes cover previews on quit; unpacked pages of recent comics are kept.
pub fn clear_cache(app: &AppHandle) {
    if let Ok(root) = preview_root(app) {
        let _ = fs::remove_dir_all(root);
    }
}

/// Loads the persistent page cache, dropping records whose pages are gone and folders that no
/// record points to (left behind by a crash or an older build).
pub fn load_page_cache(app: &AppHandle, state: &BackendState) {
    let Ok(root) = pages_root(app) else { return };
    let records = page_cache::load_index(&root.join(page_cache::INDEX_FILE))
        .into_iter()
        .filter(|record| Path::new(&record.directory).is_dir())
        .map(|record| (record.file_path.clone(), record))
        .collect::<std::collections::HashMap<_, _>>();

    if let Ok(entries) = fs::read_dir(&root) {
        let referenced = records.values().map(|record| PathBuf::from(&record.directory)).collect::<Vec<_>>();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && !referenced.contains(&path) {
                let _ = fs::remove_dir_all(path);
            }
        }
    }

    *state.page_cache.lock().expect("page cache lock poisoned") = records;
}

fn save_page_cache(app: &AppHandle, cache: &std::collections::HashMap<String, CachedComic>) -> Result<(), String> {
    let root = pages_root(app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    page_cache::save_index(&root.join(page_cache::INDEX_FILE), cache.values())
}

fn ensure_supported(path: &str) -> Result<(), String> {
    if !is_comic_path(path) { return Err("Unsupported file type. Choose a CBZ, CBR or CB7 archive.".into()); }
    Ok(())
}

fn page_file_name(index: usize, name: &str) -> String {
    let base = Path::new(name).file_name().and_then(|value| value.to_str()).unwrap_or("page");
    let safe = base.chars().map(|character| if character.is_ascii_alphanumeric() || character == '.' || character == '-' { character } else { '_' }).collect::<String>();
    format!("{:04}-{safe}", index + 1)
}

fn rar_error(error: unrar::error::UnrarError) -> String {
    format!("Unable to read RAR archive: {error}")
}

fn zip_error(error: zip::result::ZipError) -> String {
    format!("Unable to read ZIP archive: {error}")
}

fn seven_zip_error(error: sevenz_rust2::Error) -> String {
    format!("Unable to read 7-Zip archive: {error}")
}

fn seven_zip_entries(path: &str) -> Result<Vec<String>, String> {
    let archive = SevenZipArchive::open(path).map_err(seven_zip_error)?;
    Ok(archive.files.iter()
        .filter(|entry| !entry.is_directory() && entry.has_stream() && is_image(entry.name()))
        .map(|entry| entry.name().to_string())
        .collect())
}

fn rar_entries(path: &str) -> Result<Vec<String>, String> {
    let archive = RarArchive::new(path).open_for_listing().map_err(rar_error)?;
    let mut names = Vec::new();
    for entry in archive {
        let entry = entry.map_err(rar_error)?;
        let name = entry.filename.to_string_lossy().to_string();
        if entry.is_file() && is_image(&name) { names.push(name); }
    }
    Ok(names)
}

fn zip_entries(path: &str) -> Result<Vec<String>, String> {
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(zip_error)?;
    Ok((0..archive.len())
        .filter_map(|index| archive.by_index(index).ok().filter(|entry| entry.is_file()).map(|entry| entry.name().to_string()))
        .filter(|name| is_image(name))
        .collect())
}

fn archive_images(path: &str) -> Result<Vec<String>, String> {
    let mut names = match archive_kind(path)? {
        ArchiveKind::Rar => rar_entries(path)?,
        ArchiveKind::Zip => zip_entries(path)?,
        ArchiveKind::SevenZip => seven_zip_entries(path)?,
    };
    sort_natural(&mut names);
    if names.is_empty() { return Err(NO_PAGES.into()); }
    Ok(names)
}

// Waits while the window is in the background and bails out once the extraction is cancelled.
fn checkpoint(cancellation: &AtomicBool, paused: &AtomicBool) -> Result<(), String> {
    loop {
        if cancellation.load(AtomicOrdering::Relaxed) { return Err(CANCELLED.into()); }
        if !paused.load(AtomicOrdering::Relaxed) { return Ok(()); }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}

// Writes `names` (already in reading order) to `directory` as 0001-..., 0002-... and returns their paths.
fn extract_rar(path: &str, directory: &Path, names: &[String], cancellation: &AtomicBool, paused: &AtomicBool) -> Result<Vec<String>, String> {
    let mut targets = std::collections::HashMap::with_capacity(names.len());
    for (index, name) in names.iter().enumerate() {
        targets.insert(name.as_str(), directory.join(page_file_name(index, name)));
    }

    let mut archive = RarArchive::new(path).open_for_processing().map_err(rar_error)?;
    let mut remaining = targets.len();
    while remaining > 0 {
        checkpoint(cancellation, paused)?;
        let Some(header) = archive.read_header().map_err(rar_error)? else { break };
        let name = header.entry().filename.to_string_lossy().to_string();
        archive = match targets.get(name.as_str()) {
            Some(target) if header.entry().is_file() => {
                let (bytes, next) = header.read().map_err(rar_error)?;
                fs::write(target, bytes).map_err(|error| error.to_string())?;
                remaining -= 1;
                next
            }
            _ => header.skip().map_err(rar_error)?,
        };
    }

    Ok(names.iter().map(|name| targets[name.as_str()].to_string_lossy().to_string()).collect())
}

// 7-Zip archives are usually solid, so entries are decoded in archive order and the unwanted ones
// are read through and discarded.
fn extract_seven_zip(path: &str, directory: &Path, names: &[String], cancellation: &AtomicBool, paused: &AtomicBool) -> Result<Vec<String>, String> {
    let mut targets = std::collections::HashMap::with_capacity(names.len());
    for (index, name) in names.iter().enumerate() {
        targets.insert(name.as_str(), directory.join(page_file_name(index, name)));
    }

    let mut reader = SevenZipReader::open(path, Password::empty()).map_err(seven_zip_error)?;
    let mut remaining = targets.len();
    let mut interrupted = None;
    reader.for_each_entries(|entry, data| {
        if let Err(error) = checkpoint(cancellation, paused) {
            interrupted = Some(error);
            return Ok(false);
        }
        match targets.get(entry.name()) {
            Some(target) if !entry.is_directory() => {
                let mut buffer = Vec::new();
                data.read_to_end(&mut buffer)?;
                fs::write(target, buffer)?;
                remaining -= 1;
                Ok(remaining > 0)
            }
            _ => {
                std::io::copy(data, &mut std::io::sink())?;
                Ok(true)
            }
        }
    }).map_err(seven_zip_error)?;

    if let Some(error) = interrupted { return Err(error); }
    if remaining > 0 { return Err("Some pages in this 7-Zip archive could not be read.".into()); }
    Ok(names.iter().map(|name| targets[name.as_str()].to_string_lossy().to_string()).collect())
}

fn extract_zip(path: &str, directory: &Path, names: &[String], cancellation: &AtomicBool, paused: &AtomicBool) -> Result<Vec<String>, String> {
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(zip_error)?;
    let mut pages = Vec::with_capacity(names.len());
    for (index, name) in names.iter().enumerate() {
        checkpoint(cancellation, paused)?;
        let mut entry = archive.by_name(name).map_err(|error| error.to_string())?;
        let mut buffer = Vec::with_capacity(entry.size() as usize);
        entry.read_to_end(&mut buffer).map_err(|error| error.to_string())?;
        let target = directory.join(page_file_name(index, name));
        fs::write(&target, buffer).map_err(|error| error.to_string())?;
        pages.push(target.to_string_lossy().to_string());
    }
    Ok(pages)
}

fn extract_archive(path: &str, directory: &Path, names: &[String], cancellation: &AtomicBool, paused: &AtomicBool) -> Result<Vec<String>, String> {
    let pages = match archive_kind(path)? {
        ArchiveKind::Rar => extract_rar(path, directory, names, cancellation, paused)?,
        ArchiveKind::Zip => extract_zip(path, directory, names, cancellation, paused)?,
        ArchiveKind::SevenZip => extract_seven_zip(path, directory, names, cancellation, paused)?,
    };
    if pages.is_empty() { return Err(NO_PAGES.into()); }
    Ok(pages)
}

fn persist_state(app: &AppHandle, state: &BackendState) -> Result<(), String> {
    let root = app.path().app_config_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let snapshot = serde_json::json!({
        "library": state.library.lock().map_err(|_| "library lock poisoned")?.clone(),
        "settings": state.settings.lock().map_err(|_| "settings lock poisoned")?.clone(),
    });
    let bytes = serde_json::to_vec(&snapshot).map_err(|error| error.to_string())?;
    let target = root.join(STORE_FILE);
    let staging = root.join(format!("{STORE_FILE}.tmp"));
    fs::write(&staging, bytes).map_err(|error| error.to_string())?;
    fs::rename(staging, target).map_err(|error| error.to_string())
}

// electron-store kept the library in ~/Library/Application Support/<Onyx|onyx>/panel-library.json.
fn legacy_store_paths(app: &AppHandle) -> Vec<PathBuf> {
    let Ok(config_root) = app.path().app_config_dir() else { return Vec::new() };
    let Some(parent) = config_root.parent() else { return Vec::new() };
    ["Onyx", "onyx"].iter().map(|name| parent.join(name).join("panel-library.json")).collect()
}

pub fn load_state(app: &AppHandle, state: &BackendState) {
    let Ok(root) = app.path().app_config_dir() else { return };
    let (bytes, imported_legacy) = match fs::read(root.join(STORE_FILE)) {
        Ok(bytes) => (bytes, false),
        Err(_) => {
            let Some(path) = legacy_store_paths(app).into_iter().find(|path| path.exists()) else { return };
            let Ok(bytes) = fs::read(path) else { return };
            (bytes, true)
        }
    };
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) else { return };
    if let Some(library) = value.get("library").and_then(|value| serde_json::from_value::<Vec<LibraryEntry>>(value.clone()).ok()) {
        let library = library.into_iter().filter(|entry| !entry.file_path.is_empty()).map(with_title).collect();
        *state.library.lock().expect("library lock poisoned") = library;
    }
    if let Some(settings) = value.get("settings").and_then(|value| serde_json::from_value::<Settings>(value.clone()).ok()) {
        *state.settings.lock().expect("settings lock poisoned") = settings.sanitized();
    }
    if imported_legacy {
        let _ = persist_state(app, state);
    }
}

fn with_title(mut entry: LibraryEntry) -> LibraryEntry {
    if entry.title.is_empty() { entry.title = title_from_path(&entry.file_path); }
    entry
}

fn emit_settings(app: &AppHandle, state: &BackendState) -> Result<(), String> {
    app.emit(SETTINGS_CHANGED, state.settings.lock().map_err(|_| "settings lock poisoned")?.clone()).map_err(|error| error.to_string())
}

fn cached_pages_exist(entry: &ExtractionResult) -> bool {
    !entry.pages.is_empty() && entry.pages.iter().all(|page| Path::new(page).exists())
}

// Hidden folders (e.g. .Trash, __MACOSX) are skipped, symlinks are not followed, and the depth is
// capped so a huge or looping tree can't stall an import.
fn collect_comics(directory: &Path, depth: usize, output: &mut Vec<String>) {
    if depth > 12 { return; }
    let Ok(entries) = fs::read_dir(directory) else { return };
    let mut found = Vec::new();
    let mut folders = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "__MACOSX" { continue; }
        let Ok(file_type) = entry.file_type() else { continue };
        let path = entry.path();
        if file_type.is_dir() {
            folders.push(path);
        } else if file_type.is_file() && is_comic_path(&name) {
            found.push(path.to_string_lossy().to_string());
        }
    }
    sort_natural(&mut found);
    output.extend(found);
    folders.sort_by(|left, right| natural_cmp(&left.to_string_lossy(), &right.to_string_lossy()));
    for folder in folders {
        collect_comics(&folder, depth + 1, output);
    }
}

/// Turns dropped or picked paths into comic archives: folders are searched (recursively), comic
/// files are kept, everything else is ignored. Order is preserved and duplicates removed.
pub fn expand_paths(paths: &[String]) -> Vec<String> {
    let mut output = Vec::new();
    for path in paths {
        let candidate = Path::new(path);
        if candidate.is_dir() {
            collect_comics(candidate, 0, &mut output);
        } else if is_comic_path(path) {
            output.push(path.clone());
        }
    }
    let mut seen = std::collections::HashSet::new();
    output.retain(|path| seen.insert(path.clone()));
    output
}

#[tauri::command]
pub fn open_file_picker() -> Vec<String> {
    FileDialog::new().add_filter("Comic Archives", ARCHIVE_EXTENSIONS)
        .pick_files().unwrap_or_default().into_iter().map(|path| path.to_string_lossy().to_string()).filter(|path| is_comic_path(path)).collect()
}

#[tauri::command]
pub fn open_folder_picker() -> Vec<String> {
    FileDialog::new().set_title("Import a folder of comics")
        .pick_folders().unwrap_or_default().into_iter().map(|path| path.to_string_lossy().to_string()).collect()
}

#[tauri::command(async)]
pub fn expand_comic_paths(paths: Vec<String>) -> Vec<String> {
    expand_paths(&paths)
}

// Files handed to the app before the renderer was listening (CLI args, Finder "Open With").
#[tauri::command]
pub fn get_launch_files(state: State<'_, BackendState>) -> Vec<String> {
    state.renderer_ready.store(true, AtomicOrdering::SeqCst);
    let mut files = std::env::args().skip(1).filter(|path| is_comic_path(path)).collect::<Vec<_>>();
    files.append(&mut state.pending_open_files.lock().expect("pending files lock poisoned"));
    files
}

#[tauri::command(async)]
pub fn inspect_comic(app: AppHandle, file_path: String, state: State<'_, BackendState>) -> Result<ComicInspection, String> {
    ensure_supported(&file_path)?;
    let fingerprint = page_cache::fingerprint(&file_path);
    if let Some(cached) = state.page_cache.lock().map_err(|_| "cache lock poisoned")?.get(&file_path).filter(|cached| page_cache::is_fresh(cached, fingerprint)) {
        return Ok(ComicInspection { title: cached.title.clone(), page_count: cached.page_count, cover_page: cached.pages[0].clone() });
    }
    if let Some(cached) = state.inspection_cache.lock().map_err(|_| "cache lock poisoned")?.get(&file_path).filter(|entry| cached_pages_exist(entry)) {
        return Ok(ComicInspection { title: cached.title.clone(), page_count: cached.page_count, cover_page: cached.pages[0].clone() });
    }

    let names = archive_images(&file_path)?;
    let directory = cache_directory(&app, &file_path, true)?;
    reset_directory(&directory)?;
    let pages = extract_archive(&file_path, &directory, &names[..1], &AtomicBool::new(false), &AtomicBool::new(false))?;
    let preview = ExtractionResult { directory: directory.to_string_lossy().to_string(), pages, title: title_from_path(&file_path), page_count: names.len() as u32 };
    let result = ComicInspection { title: preview.title.clone(), page_count: preview.page_count, cover_page: preview.pages[0].clone() };
    state.inspection_cache.lock().map_err(|_| "cache lock poisoned")?.insert(file_path, preview);
    Ok(result)
}

#[tauri::command(async)]
pub fn extract_comic(app: AppHandle, file_path: String, state: State<'_, BackendState>) -> Result<ExtractionResult, String> {
    ensure_supported(&file_path)?;
    let fingerprint = page_cache::fingerprint(&file_path);
    {
        let mut cache = state.page_cache.lock().map_err(|_| "cache lock poisoned")?;
        if let Some(cached) = cache.get_mut(&file_path).filter(|cached| page_cache::is_fresh(cached, fingerprint)) {
            cached.last_used = page_cache::now();
            let result = cached.result();
            let _ = save_page_cache(&app, &cache);
            return Ok(result);
        }
    }

    let cancellation = Arc::new(AtomicBool::new(false));
    state.cancellation.lock().map_err(|_| "cancellation lock poisoned")?.insert(file_path.clone(), cancellation.clone());
    let directory = cache_directory(&app, &file_path, false)?;
    let pages = reset_directory(&directory)
        .and_then(|_| archive_images(&file_path))
        .and_then(|names| extract_archive(&file_path, &directory, &names, &cancellation, &state.window_blurred));
    {
        let mut cancellations = state.cancellation.lock().map_err(|_| "cancellation lock poisoned")?;
        if cancellations.get(&file_path).is_some_and(|flag| Arc::ptr_eq(flag, &cancellation)) {
            cancellations.remove(&file_path);
        }
    }
    let pages = pages.inspect_err(|_| { let _ = fs::remove_dir_all(&directory); })?;

    let result = ExtractionResult { directory: directory.to_string_lossy().to_string(), page_count: pages.len() as u32, pages, title: title_from_path(&file_path) };
    {
        let mut cache = state.page_cache.lock().map_err(|_| "cache lock poisoned")?;
        let (source_size, source_modified) = fingerprint.unwrap_or_default();
        cache.insert(file_path.clone(), CachedComic {
            file_path: file_path.clone(),
            directory: result.directory.clone(),
            pages: result.pages.clone(),
            title: result.title.clone(),
            page_count: result.page_count,
            source_size,
            source_modified,
            last_used: page_cache::now(),
        });
        for evicted in page_cache::evictions(cache.values(), page_cache::MAX_CACHED_COMICS, &file_path) {
            if let Some(record) = cache.remove(&evicted) {
                let _ = fs::remove_dir_all(record.directory);
            }
        }
        let _ = save_page_cache(&app, &cache);
    }
    {
        let mut library = state.library.lock().map_err(|_| "library lock poisoned")?;
        if let Some(entry) = library.iter_mut().find(|entry| entry.file_path == file_path) {
            entry.page_count = result.page_count;
            entry.title = result.title.clone();
        } else {
            library.push(LibraryEntry { file_path, title: result.title.clone(), page_count: result.page_count, ..Default::default() });
        }
    }
    persist_state(&app, &state)?;
    Ok(result)
}

#[tauri::command]
pub fn cancel_extraction(file_path: String, state: State<'_, BackendState>) {
    if let Some(flag) = state.cancellation.lock().expect("cancellation lock poisoned").get(&file_path) {
        flag.store(true, AtomicOrdering::Relaxed);
    }
}

#[tauri::command]
pub fn get_library(state: State<'_, BackendState>) -> Vec<LibraryEntry> {
    state.library.lock().expect("library lock poisoned").clone()
}

#[tauri::command]
pub fn get_settings(state: State<'_, BackendState>) -> Settings {
    state.settings.lock().expect("settings lock poisoned").clone()
}

#[tauri::command(async)]
pub fn sync_library(app: AppHandle, next_library: Vec<LibraryEntry>, state: State<'_, BackendState>) -> Result<Vec<LibraryEntry>, String> {
    let cleaned = next_library.into_iter().filter(|entry| !entry.file_path.is_empty()).map(with_title).collect::<Vec<_>>();
    *state.library.lock().map_err(|_| "library lock poisoned")? = cleaned.clone();
    persist_state(&app, &state)?;
    Ok(cleaned)
}

#[tauri::command(async)]
pub fn save_settings(app: AppHandle, next_settings: Settings, state: State<'_, BackendState>) -> Result<Settings, String> {
    let clean = next_settings.sanitized();
    *state.settings.lock().map_err(|_| "settings lock poisoned")? = clean.clone();
    persist_state(&app, &state)?;
    emit_settings(&app, &state)?;
    Ok(clean)
}

#[tauri::command(async)]
pub fn save_progress(app: AppHandle, file_path: String, page: u32, state: State<'_, BackendState>) -> Result<(), String> {
    {
        let mut library = state.library.lock().map_err(|_| "library lock poisoned")?;
        let last_opened = Some(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
        if let Some(entry) = library.iter_mut().find(|entry| entry.file_path == file_path) {
            entry.progress = page;
            entry.last_opened = last_opened;
        } else {
            library.push(LibraryEntry { title: title_from_path(&file_path), file_path, progress: page, last_opened, ..Default::default() });
        }
    }
    persist_state(&app, &state)
}

#[tauri::command(async)]
pub fn remove_from_library(app: AppHandle, file_path: String, state: State<'_, BackendState>) -> Result<(), String> {
    state.library.lock().map_err(|_| "library lock poisoned")?.retain(|entry| entry.file_path != file_path);
    {
        let mut cache = state.page_cache.lock().map_err(|_| "cache lock poisoned")?;
        if let Some(record) = cache.remove(&file_path) {
            let _ = fs::remove_dir_all(record.directory);
            let _ = save_page_cache(&app, &cache);
        }
    }
    if let Some(cached) = state.inspection_cache.lock().map_err(|_| "cache lock poisoned")?.remove(&file_path) {
        let _ = fs::remove_dir_all(cached.directory);
    }
    persist_state(&app, &state)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch_dir(name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!("onyx-test-{name}-{}", std::process::id()));
        reset_directory(&directory).unwrap();
        directory
    }

    fn write_zip(path: &Path, pages: &[&str]) {
        use std::io::Write;
        let mut writer = zip::ZipWriter::new(fs::File::create(path).unwrap());
        let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for page in pages {
            writer.start_file(*page, options).unwrap();
            writer.write_all(page.as_bytes()).unwrap();
        }
        writer.finish().unwrap();
    }

    // Issue #1: a ZIP saved with a .cbr extension failed with "Not a RAR archive".
    #[test]
    fn opens_zip_archives_named_cbr() {
        let directory = scratch_dir("zip-as-cbr");
        let archive = directory.join("comic.cbr");
        write_zip(&archive, &["page10.jpg", "page2.jpg", "notes.txt", "page1.jpg"]);
        let archive = archive.to_string_lossy().to_string();

        assert_eq!(archive_kind(&archive), Ok(ArchiveKind::Zip));
        let names = archive_images(&archive).unwrap();
        assert_eq!(names, ["page1.jpg", "page2.jpg", "page10.jpg"]);
        let out = directory.join("out");
        reset_directory(&out).unwrap();
        let pages = extract_archive(&archive, &out, &names, &AtomicBool::new(false), &AtomicBool::new(false)).unwrap();
        assert_eq!(fs::read_to_string(&pages[2]).unwrap(), "page10.jpg");
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn detects_archive_kind_from_signature_before_extension() {
        let directory = scratch_dir("signatures");
        let write = |name: &str, bytes: &[u8]| {
            let path = directory.join(name);
            fs::write(&path, bytes).unwrap();
            path.to_string_lossy().to_string()
        };

        assert_eq!(archive_kind(&write("rar4.cbz", b"Rar!\x1a\x07\x00rest")), Ok(ArchiveKind::Rar));
        assert_eq!(archive_kind(&write("rar5.zip", b"Rar!\x1a\x07\x01\x00rest")), Ok(ArchiveKind::Rar));
        assert_eq!(archive_kind(&write("zip.rar", b"PK\x03\x04rest")), Ok(ArchiveKind::Zip));
        assert_eq!(archive_kind(&write("seven.cbr", b"7z\xbc\xaf\x27\x1crest")), Ok(ArchiveKind::SevenZip));
        assert_eq!(archive_kind(&write("unknown.cb7", b"MZ-sfx")), Ok(ArchiveKind::SevenZip));
        assert_eq!(archive_kind(&write("unknown.cbr", b"MZ-sfx")), Ok(ArchiveKind::Rar));
        assert_eq!(archive_kind(&write("tiny.cbz", b"P")), Ok(ArchiveKind::Zip));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn opens_cb7_archives() {
        let directory = scratch_dir("cb7");
        let source = directory.join("source");
        fs::create_dir_all(source.join("Issue 1")).unwrap();
        for page in ["page10.jpg", "page2.jpg", "page1.jpg"] {
            fs::write(source.join("Issue 1").join(page), page).unwrap();
        }
        fs::write(source.join("Issue 1").join("info.txt"), "not a page").unwrap();
        let archive = directory.join("comic.cb7");
        sevenz_rust2::compress_to_path(&source, &archive).unwrap();
        let archive = archive.to_string_lossy().to_string();

        assert_eq!(archive_kind(&archive), Ok(ArchiveKind::SevenZip));
        let names = archive_images(&archive).unwrap();
        assert_eq!(names, ["Issue 1/page1.jpg", "Issue 1/page2.jpg", "Issue 1/page10.jpg"]);

        let out = directory.join("out");
        reset_directory(&out).unwrap();
        let cover = extract_archive(&archive, &out, &names[..1], &AtomicBool::new(false), &AtomicBool::new(false)).unwrap();
        assert_eq!(fs::read_to_string(&cover[0]).unwrap(), "page1.jpg");
        reset_directory(&out).unwrap();
        let pages = extract_archive(&archive, &out, &names, &AtomicBool::new(false), &AtomicBool::new(false)).unwrap();
        assert_eq!(pages.iter().map(|page| fs::read_to_string(page).unwrap()).collect::<Vec<_>>(), ["page1.jpg", "page2.jpg", "page10.jpg"]);

        let cancelled = extract_archive(&archive, &out, &names, &AtomicBool::new(true), &AtomicBool::new(false));
        assert_eq!(cancelled, Err(CANCELLED.to_string()));
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn expands_folders_into_comics() {
        let directory = scratch_dir("folders");
        let series = directory.join("Series");
        fs::create_dir_all(series.join("Volume 2")).unwrap();
        fs::create_dir_all(series.join(".hidden")).unwrap();
        fs::create_dir_all(series.join("__MACOSX")).unwrap();
        for file in ["Issue 10.cbz", "Issue 2.cbr", "notes.txt", "Volume 2/Issue 1.cb7", ".hidden/secret.cbz", "__MACOSX/Issue 2.cbr"] {
            fs::write(series.join(file), b"x").unwrap();
        }
        let loose = directory.join("Loose.cbz");
        fs::write(&loose, b"x").unwrap();

        let series_path = series.to_string_lossy().to_string();
        let loose_path = loose.to_string_lossy().to_string();
        let expanded = expand_paths(&[series_path.clone(), loose_path.clone(), directory.join("readme.md").to_string_lossy().to_string(), loose_path.clone()]);
        let relative = expanded.iter().map(|path| path.strip_prefix(&format!("{}/", directory.to_string_lossy())).unwrap().to_string()).collect::<Vec<_>>();
        assert_eq!(relative, ["Series/Issue 2.cbr", "Series/Issue 10.cbz", "Series/Volume 2/Issue 1.cb7", "Loose.cbz"]);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn sorts_pages_naturally() {
        let mut names = vec!["Page10.jpg", "page2.jpg", "page1.jpg", "cover.jpg", "Page02b.jpg"].into_iter().map(String::from).collect::<Vec<_>>();
        sort_natural(&mut names);
        assert_eq!(names, ["cover.jpg", "page1.jpg", "page2.jpg", "Page02b.jpg", "Page10.jpg"]);
    }

    // ONYX_SAMPLE_ARCHIVES="a.cbr:b.cbz" ONYX_SAMPLE_OUT=/tmp/x cargo test -- --ignored --nocapture
    #[test]
    #[ignore]
    fn extracts_sample_archives() {
        let out = PathBuf::from(std::env::var("ONYX_SAMPLE_OUT").expect("ONYX_SAMPLE_OUT"));
        for (index, archive) in std::env::var("ONYX_SAMPLE_ARCHIVES").expect("ONYX_SAMPLE_ARCHIVES").split(':').enumerate() {
            let started = std::time::Instant::now();
            let names = archive_images(archive).unwrap();
            let directory = out.join(index.to_string());
            reset_directory(&directory).unwrap();
            let cover = extract_archive(archive, &directory, &names[..1], &AtomicBool::new(false), &AtomicBool::new(false)).unwrap();
            reset_directory(&directory).unwrap();
            let pages = extract_archive(archive, &directory, &names, &AtomicBool::new(false), &AtomicBool::new(false)).unwrap();
            assert_eq!(pages.len(), names.len());
            assert!(pages.iter().all(|page| fs::metadata(page).map(|meta| meta.len() > 0).unwrap_or(false)));
            println!("{} pages in {:?} | first {:?} | last {:?} | cover {:?}", pages.len(), started.elapsed(), names.first(), names.last(), cover[0].rsplit('/').next());
        }
    }

    #[test]
    fn checkpoint_waits_while_paused_and_stops_on_cancel() {
        let (cancelled, paused) = (Arc::new(AtomicBool::new(false)), Arc::new(AtomicBool::new(true)));
        let resume = paused.clone();
        let started = std::time::Instant::now();
        std::thread::spawn(move || { std::thread::sleep(std::time::Duration::from_millis(200)); resume.store(false, AtomicOrdering::Relaxed); });
        assert!(checkpoint(&cancelled, &paused).is_ok());
        assert!(started.elapsed() >= std::time::Duration::from_millis(200));
        cancelled.store(true, AtomicOrdering::Relaxed);
        assert_eq!(checkpoint(&cancelled, &paused), Err(CANCELLED.to_string()));
    }

    #[test]
    fn titles_match_electron() {
        assert_eq!(title_from_path("/x/Saga_-_Vol_01.cbz"), "Saga Vol 01");
        assert!(is_comic_path("/x/a.CBR"));
        assert!(!is_comic_path("/x/a.pdf"));
    }
}
