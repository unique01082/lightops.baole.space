use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use super::exif::get_camera_info;

const JPG_EXTS: &[&str] = &[".jpg", ".jpeg"];
const VIDEO_EXTS: &[&str] = &[".mp4", ".mov", ".mts", ".m4v", ".avi", ".mkv", ".3gp"];
const KNOWN_RAW_EXTS: &[&str] = &[
    ".nef", ".nrw", ".cr2", ".cr3", ".arw", ".raf", ".rw2", ".orf", ".dng", ".pef",
];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilePair {
    pub jpg: Option<String>,
    pub raw: Option<String>,
    pub video: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanStats {
    pub total_pairs: usize,
    pub both: usize,
    pub jpg_only: usize,
    pub raw_only: usize,
    pub video_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub pairs: Vec<FilePair>,
    pub stats: ScanStats,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SourceMetadata {
    pub folder: String,
    pub sample_file: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub capture_time: Option<String>,
    pub detected_extensions: Vec<String>,
    pub raw_extensions: Vec<String>,
    pub jpg_count: usize,
    pub raw_count: usize,
    pub video_count: usize,
}

fn normalized_ext(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default()
}

fn is_image_ext(ext: &str) -> bool {
    JPG_EXTS.contains(&ext) || KNOWN_RAW_EXTS.contains(&ext)
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
    include_video: bool,
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
            let is_video = include_video && VIDEO_EXTS.contains(&ext.as_str());

            if !is_jpg && !is_raw && !is_video {
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

            let pair = pairs.entry((parent, stem)).or_insert(FilePair {
                jpg: None,
                raw: None,
                video: None,
            });

            if is_jpg {
                pair.jpg = Some(path.to_string_lossy().into_owned());
            } else if is_raw {
                pair.raw = Some(path.to_string_lossy().into_owned());
            } else if is_video {
                pair.video = Some(path.to_string_lossy().into_owned());
            }
        }
    }

    let pairs_vec: Vec<FilePair> = pairs.into_values().collect();

    let mut both = 0usize;
    let mut jpg_only = 0usize;
    let mut raw_only = 0usize;
    let mut video_count = 0usize;

    for p in &pairs_vec {
        match (&p.jpg, &p.raw) {
            (Some(_), Some(_)) => both += 1,
            (Some(_), None) => jpg_only += 1,
            (None, Some(_)) => raw_only += 1,
            _ => {}
        }
        if p.video.is_some() {
            video_count += 1;
        }
    }

    Ok(ScanResult {
        stats: ScanStats {
            total_pairs: pairs_vec.len(),
            both,
            jpg_only,
            raw_only,
            video_count,
        },
        pairs: pairs_vec,
    })
}

#[tauri::command]
pub fn scan_source_metadata(folders: Vec<String>) -> Result<Vec<SourceMetadata>, String> {
    let mut result = Vec::new();

    for folder_str in folders {
        let folder = Path::new(&folder_str);
        if !folder.is_dir() {
            result.push(SourceMetadata {
                folder: folder_str,
                sample_file: None,
                camera_make: None,
                camera_model: None,
                capture_time: None,
                detected_extensions: Vec::new(),
                raw_extensions: Vec::new(),
                jpg_count: 0,
                raw_count: 0,
                video_count: 0,
            });
            continue;
        }

        let mut sample_file: Option<String> = None;
        let mut extensions: Vec<String> = Vec::new();
        let mut raw_extensions: Vec<String> = Vec::new();
        let mut jpg_count = 0usize;
        let mut raw_count = 0usize;
        let mut video_count = 0usize;

        for entry in WalkDir::new(folder)
            .max_depth(1)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().is_file())
        {
            let path = entry.path();
            let ext = normalized_ext(path);
            if ext.is_empty() {
                continue;
            }

            if !extensions.contains(&ext) {
                extensions.push(ext.clone());
            }

            if JPG_EXTS.contains(&ext.as_str()) {
                jpg_count += 1;
            } else if KNOWN_RAW_EXTS.contains(&ext.as_str()) {
                raw_count += 1;
                if !raw_extensions.contains(&ext) {
                    raw_extensions.push(ext.clone());
                }
            } else if VIDEO_EXTS.contains(&ext.as_str()) {
                video_count += 1;
            }

            if sample_file.is_none() && is_image_ext(&ext) {
                sample_file = Some(path.to_string_lossy().into_owned());
            }
        }

        extensions.sort();
        raw_extensions.sort();

        let camera = sample_file
            .as_deref()
            .and_then(|path| get_camera_info(Path::new(path)));

        result.push(SourceMetadata {
            folder: folder_str,
            sample_file,
            camera_make: camera.as_ref().and_then(|info| info.make.clone()),
            camera_model: camera.as_ref().and_then(|info| info.model.clone()),
            capture_time: camera
                .as_ref()
                .and_then(|info| info.datetime)
                .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string()),
            detected_extensions: extensions,
            raw_extensions,
            jpg_count,
            raw_count,
            video_count,
        });
    }

    Ok(result)
}
