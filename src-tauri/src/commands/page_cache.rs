// Keeps the unpacked pages of recently read comics between launches so reopening them is instant.
// Each record remembers the archive's size and modification time; if either changes, the pages
// are unpacked again. Only the most recently used comics are kept.

use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use super::ExtractionResult;

pub const MAX_CACHED_COMICS: usize = 5;
pub const INDEX_FILE: &str = "index.json";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedComic {
    pub file_path: String,
    pub directory: String,
    pub pages: Vec<String>,
    pub title: String,
    pub page_count: u32,
    pub source_size: u64,
    pub source_modified: u64,
    pub last_used: u64,
}

impl CachedComic {
    pub fn result(&self) -> ExtractionResult {
        ExtractionResult { directory: self.directory.clone(), pages: self.pages.clone(), title: self.title.clone(), page_count: self.page_count }
    }
}

/// (size in bytes, modification time in seconds) of the archive, if it can be read.
pub fn fingerprint(path: &str) -> Option<(u64, u64)> {
    let metadata = fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_secs();
    Some((metadata.len(), modified))
}

pub fn now() -> u64 {
    std::time::SystemTime::now().duration_since(UNIX_EPOCH).map(|time| time.as_secs()).unwrap_or_default()
}

/// The cached pages can be reused: the archive is unchanged and every page is still on disk.
pub fn is_fresh(cached: &CachedComic, current: Option<(u64, u64)>) -> bool {
    current == Some((cached.source_size, cached.source_modified))
        && !cached.pages.is_empty()
        && cached.pages.iter().all(|page| Path::new(page).exists())
}

/// File paths to evict so that at most `keep` comics remain, dropping the least recently used
/// first and never evicting `protect` (the comic being opened).
pub fn evictions<'a>(records: impl IntoIterator<Item = &'a CachedComic>, keep: usize, protect: &str) -> Vec<String> {
    let mut records = records.into_iter().collect::<Vec<_>>();
    records.sort_by(|left, right| {
        (right.file_path == protect).cmp(&(left.file_path == protect)).then_with(|| right.last_used.cmp(&left.last_used))
    });
    records.into_iter().skip(keep).map(|record| record.file_path.clone()).collect()
}

pub fn load_index(path: &Path) -> Vec<CachedComic> {
    fs::read(path).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default()
}

pub fn save_index<'a>(path: &Path, records: impl IntoIterator<Item = &'a CachedComic>) -> Result<(), String> {
    let records = records.into_iter().collect::<Vec<_>>();
    let bytes = serde_json::to_vec(&records).map_err(|error| error.to_string())?;
    let staging = path.with_extension("json.tmp");
    fs::write(&staging, bytes).map_err(|error| error.to_string())?;
    fs::rename(staging, path).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(file_path: &str, last_used: u64) -> CachedComic {
        CachedComic {
            file_path: file_path.into(),
            directory: String::new(),
            pages: Vec::new(),
            title: file_path.into(),
            page_count: 0,
            source_size: 0,
            source_modified: 0,
            last_used,
        }
    }

    #[test]
    fn evicts_least_recently_used_beyond_the_limit() {
        let records = [record("a", 1), record("b", 5), record("c", 3), record("d", 4)];
        let mut evicted = evictions(&records, 2, "");
        evicted.sort();
        assert_eq!(evicted, ["a", "c"]);
    }

    #[test]
    fn never_evicts_the_comic_being_opened() {
        let records = [record("old", 1), record("b", 5), record("c", 3)];
        let mut evicted = evictions(&records, 2, "old");
        evicted.sort();
        assert_eq!(evicted, ["c"]);
        assert!(evictions(&records, 5, "").is_empty());
    }

    #[test]
    fn freshness_requires_unchanged_archive_and_pages_on_disk() {
        let directory = std::env::temp_dir().join(format!("onyx-page-cache-test-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();
        let archive = directory.join("comic.cbz");
        let page = directory.join("0001-page.jpg");
        fs::write(&archive, b"archive").unwrap();
        fs::write(&page, b"page").unwrap();

        let archive_path = archive.to_string_lossy().to_string();
        let (size, modified) = fingerprint(&archive_path).unwrap();
        let mut cached = record(&archive_path, 1);
        cached.source_size = size;
        cached.source_modified = modified;
        cached.pages = vec![page.to_string_lossy().to_string()];

        assert!(is_fresh(&cached, fingerprint(&archive_path)));
        assert!(!is_fresh(&cached, Some((size + 1, modified))), "a resized archive must be unpacked again");
        assert!(!is_fresh(&cached, None), "a missing archive is never fresh");
        fs::remove_file(&page).unwrap();
        assert!(!is_fresh(&cached, fingerprint(&archive_path)), "missing pages must be unpacked again");

        let index = directory.join(INDEX_FILE);
        save_index(&index, [&cached]).unwrap();
        assert_eq!(load_index(&index), vec![cached]);
        let _ = fs::remove_dir_all(directory);
    }
}
