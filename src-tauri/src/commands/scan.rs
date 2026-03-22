use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

const JPG_EXTS: &[&str] = &[".jpg", ".jpeg"];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilePair {
    pub jpg: Option<String>,
    pub raw: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanStats {
    pub total_pairs: usize,
    pub both: usize,
    pub jpg_only: usize,
    pub raw_only: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub pairs: Vec<FilePair>,
    pub stats: ScanStats,
}

/// Scan the given folders and return matched JPG/RAW pairs.
///
/// Files are matched by (parent_directory, stem_uppercase) so that
/// `DSC_0001.NEF` and `DSC_0001.JPG` are treated as a pair.
#[tauri::command]
pub fn scan_folders(
    folders: Vec<String>,
    raw_exts: Vec<String>,
    recursive: bool,
) -> Result<ScanResult, String> {
    let raw_exts_lower: Vec<String> = raw_exts
        .iter()
        .map(|e| {
            let e = e.trim().to_lowercase();
            if e.starts_with('.') {
                e
            } else {
                format!(".{}", e)
            }
        })
        .collect();

    // key: (parent_dir, STEM_UPPERCASE) -> FilePair
    let mut pairs: HashMap<(String, String), FilePair> = HashMap::new();

    for folder_str in &folders {
        let folder = Path::new(folder_str);
        if !folder.is_dir() {
            continue;
        }

        let walker = WalkDir::new(folder)
            .max_depth(if recursive { usize::MAX } else { 1 })
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file());

        for entry in walker {
            let path = entry.path();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| format!(".{}", e.to_lowercase()))
                .unwrap_or_default();

            let is_jpg = JPG_EXTS.contains(&ext.as_str());
            let is_raw = raw_exts_lower.contains(&ext);

            if !is_jpg && !is_raw {
                continue;
            }

            let parent = path
                .parent()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default();

            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_uppercase())
                .unwrap_or_default();

            let pair = pairs
                .entry((parent, stem))
                .or_insert(FilePair { jpg: None, raw: None });

            if is_jpg {
                pair.jpg = Some(path.to_string_lossy().into_owned());
            } else {
                pair.raw = Some(path.to_string_lossy().into_owned());
            }
        }
    }

    let pairs_vec: Vec<FilePair> = pairs.into_values().collect();

    let mut both = 0usize;
    let mut jpg_only = 0usize;
    let mut raw_only = 0usize;

    for p in &pairs_vec {
        match (&p.jpg, &p.raw) {
            (Some(_), Some(_)) => both += 1,
            (Some(_), None) => jpg_only += 1,
            (None, Some(_)) => raw_only += 1,
            _ => {}
        }
    }

    Ok(ScanResult {
        stats: ScanStats {
            total_pairs: pairs_vec.len(),
            both,
            jpg_only,
            raw_only,
        },
        pairs: pairs_vec,
    })
}
