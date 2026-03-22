use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    OnceLock,
};
use std::sync::Arc;

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

use super::exif::get_exif_datetime;
use super::scan::FilePair;

// ── Shared cancel flag ───────────────────────────────────────────────────────

static CANCEL_FLAG: OnceLock<Arc<AtomicBool>> = OnceLock::new();

fn cancel_flag() -> Arc<AtomicBool> {
    CANCEL_FLAG
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone()
}

// ── Request / Response types ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenameOptions {
    pub prefix: String,
    /// strftime pattern, or null for sequence-only naming
    pub fmt_pattern: Option<String>,
    /// "both" | "jpg" | "raw"
    pub file_mode: String,
    pub only_paired: bool,
    pub start_num: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RenameEntry {
    pub old_path: String,
    pub new_name: String,
    /// ISO 8601 datetime string (for use_date_subdir)
    pub ts: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildPlanResult {
    pub plan: Vec<RenameEntry>,
    pub skipped_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExecuteOptions {
    pub output_dir: Option<String>,
    pub dry_run: bool,
    pub use_date_subdir: bool,
    /// "copy" | "move"
    pub file_op: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub entry_type: String,
    pub source: Option<String>,
    pub destination: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExecuteStats {
    pub ok: usize,
    pub skip: usize,
    pub error: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressEvent {
    pub current: usize,
    pub total: usize,
    pub entry: LogEntry,
    pub stats: ExecuteStats,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteResult {
    pub ok: usize,
    pub errors: usize,
    pub cancelled: bool,
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// Build the rename plan from a list of FilePairs.
/// Returns sorted entries (by EXIF datetime) and the count of skipped pairs.
#[tauri::command]
pub fn build_rename_plan(
    pairs: Vec<FilePair>,
    opts: RenameOptions,
) -> BuildPlanResult {
    let mut timed: Vec<(NaiveDateTime, FilePair)> = Vec::new();
    let mut skipped_count = 0usize;

    for pair in pairs {
        let has_jpg = pair.jpg.is_some();
        let has_raw = pair.raw.is_some();

        // Filter by file_mode
        if opts.file_mode == "jpg" && !has_jpg {
            continue;
        }
        if opts.file_mode == "raw" && !has_raw {
            continue;
        }
        if opts.only_paired && !(has_jpg && has_raw) {
            continue;
        }

        // Prefer RAW for EXIF, fall back to JPG
        let ts = pair
            .raw
            .as_deref()
            .and_then(|p| get_exif_datetime(Path::new(p)))
            .or_else(|| {
                pair.jpg
                    .as_deref()
                    .and_then(|p| get_exif_datetime(Path::new(p)))
            });

        match ts {
            Some(dt) => timed.push((dt, pair)),
            None => skipped_count += 1,
        }
    }

    // Sort by capture time
    timed.sort_by_key(|(dt, _)| *dt);

    let mut counter: HashMap<String, u32> = HashMap::new();
    let mut plan: Vec<RenameEntry> = Vec::new();

    for (ts, files) in timed {
        let dt_str = opts
            .fmt_pattern
            .as_deref()
            .map(|pat| ts.format(pat).to_string())
            .unwrap_or_default();

        let c = counter
            .entry(dt_str.clone())
            .or_insert(opts.start_num.saturating_sub(1));
        *c += 1;
        let seq = *c;

        let base = if dt_str.is_empty() {
            format!("{}{:06}", opts.prefix, seq)
        } else {
            format!("{}{}_{:04}", opts.prefix, dt_str, seq)
        };

        let ts_iso = ts.format("%Y-%m-%dT%H:%M:%S").to_string();

        let candidates = [("jpg", &files.jpg), ("raw", &files.raw)];
        for (ftype, file_opt) in candidates {
            if opts.file_mode == "jpg" && ftype != "jpg" {
                continue;
            }
            if opts.file_mode == "raw" && ftype != "raw" {
                continue;
            }
            if let Some(filepath) = file_opt {
                let ext = Path::new(filepath)
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| format!(".{}", e.to_lowercase()))
                    .unwrap_or_default();

                plan.push(RenameEntry {
                    old_path: filepath.clone(),
                    new_name: format!("{}{}", base, ext),
                    ts: Some(ts_iso.clone()),
                });
            }
        }
    }

    BuildPlanResult { plan, skipped_count }
}

/// Cancel a running execute_plan.
#[tauri::command]
pub fn cancel_execution() {
    cancel_flag().store(true, Ordering::SeqCst);
}

/// Execute the rename plan, emitting "progress" events to the frontend.
#[tauri::command]
pub async fn execute_plan(
    window: tauri::Window,
    plan: Vec<RenameEntry>,
    opts: ExecuteOptions,
) -> Result<ExecuteResult, String> {
    // Reset cancel flag at start of each run
    cancel_flag().store(false, Ordering::SeqCst);

    let total = plan.len();
    let mut ok = 0usize;
    let mut errors = 0usize;
    let mut cancelled = false;

    for (i, entry) in plan.iter().enumerate() {
        if cancel_flag().load(Ordering::SeqCst) {
            cancelled = true;
            let _ = window.emit(
                "progress",
                ProgressEvent {
                    current: i,
                    total,
                    entry: LogEntry {
                        entry_type: "warn".into(),
                        source: None,
                        destination: None,
                        message: Some("Process stopped by user.".into()),
                    },
                    stats: ExecuteStats { ok, skip: 0, error: errors },
                },
            );
            break;
        }

        let old_path = Path::new(&entry.old_path);

        // Resolve destination directory
        let dest_dir: PathBuf = if let Some(ref out) = opts.output_dir {
            let sub = if opts.use_date_subdir {
                entry
                    .ts
                    .as_deref()
                    .and_then(|s| NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").ok())
                    .map(|dt| dt.format("%Y-%m-%d").to_string())
                    .unwrap_or_default()
            } else {
                String::new()
            };
            if sub.is_empty() {
                PathBuf::from(out)
            } else {
                PathBuf::from(out).join(sub)
            }
        } else {
            old_path
                .parent()
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("."))
        };

        let new_path = dest_dir.join(&entry.new_name);

        // Dry-run: just log without touching files
        if opts.dry_run {
            let op_label = if opts.output_dir.is_some() {
                if opts.file_op == "move" { "MOVE" } else { "COPY" }
            } else {
                "RENAME"
            };
            ok += 1;
            let _ = window.emit(
                "progress",
                ProgressEvent {
                    current: i + 1,
                    total,
                    entry: LogEntry {
                        entry_type: "dry".into(),
                        source: Some(format!("[{}] {}", op_label, entry.old_path)),
                        destination: Some(new_path.to_string_lossy().into_owned()),
                        message: None,
                    },
                    stats: ExecuteStats { ok, skip: 0, error: errors },
                },
            );
            continue;
        }

        // Create destination directory
        if let Err(e) = std::fs::create_dir_all(&dest_dir) {
            errors += 1;
            let _ = window.emit(
                "progress",
                ProgressEvent {
                    current: i + 1,
                    total,
                    entry: LogEntry {
                        entry_type: "error".into(),
                        source: Some(entry.old_path.clone()),
                        destination: Some(dest_dir.to_string_lossy().into_owned()),
                        message: Some(format!("Cannot create dir: {}", e)),
                    },
                    stats: ExecuteStats { ok, skip: 0, error: errors },
                },
            );
            continue;
        }

        // Skip if destination already exists (and is a different file)
        if new_path.exists() {
            let same = new_path
                .canonicalize()
                .ok()
                .zip(old_path.canonicalize().ok())
                .map(|(a, b)| a == b)
                .unwrap_or(false);
            if !same {
                errors += 1;
                let _ = window.emit(
                    "progress",
                    ProgressEvent {
                        current: i + 1,
                        total,
                        entry: LogEntry {
                            entry_type: "skip".into(),
                            source: Some(entry.old_path.clone()),
                            destination: Some(new_path.to_string_lossy().into_owned()),
                            message: Some("Destination already exists".into()),
                        },
                        stats: ExecuteStats { ok, skip: errors, error: 0 },
                    },
                );
                continue;
            }
        }

        // Perform the actual file operation
        let result: Result<&str, std::io::Error> = if opts.output_dir.is_some() {
            if opts.file_op == "move" {
                std::fs::copy(old_path, &new_path)
                    .and_then(|_| std::fs::remove_file(old_path))
                    .map(|_| "MOVE")
            } else {
                std::fs::copy(old_path, &new_path).map(|_| "COPY")
            }
        } else {
            std::fs::rename(old_path, &new_path).map(|_| "RENAME")
        };

        match result {
            Ok(op_label) => {
                ok += 1;
                let _ = window.emit(
                    "progress",
                    ProgressEvent {
                        current: i + 1,
                        total,
                        entry: LogEntry {
                            entry_type: "ok".into(),
                            source: Some(format!("[{}] {}", op_label, entry.old_path)),
                            destination: Some(new_path.to_string_lossy().into_owned()),
                            message: None,
                        },
                        stats: ExecuteStats { ok, skip: 0, error: errors },
                    },
                );
            }
            Err(e) => {
                errors += 1;
                let _ = window.emit(
                    "progress",
                    ProgressEvent {
                        current: i + 1,
                        total,
                        entry: LogEntry {
                            entry_type: "error".into(),
                            source: Some(entry.old_path.clone()),
                            destination: Some(new_path.to_string_lossy().into_owned()),
                            message: Some(e.to_string()),
                        },
                        stats: ExecuteStats { ok, skip: 0, error: errors },
                    },
                );
            }
        }
    }

    Ok(ExecuteResult { ok, errors, cancelled })
}
