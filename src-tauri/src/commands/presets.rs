use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preset {
    pub name: String,
    pub camera_preset: String,
    pub raw_extensions: String,
    /// "both" | "jpg" | "raw"
    pub file_type: String,
    pub prefix: String,
    /// strftime pattern or null
    pub fmt_pattern: Option<String>,
    pub start_num: u32,
    /// "copy" | "move"
    pub file_op: String,
    pub recursive: bool,
    pub organize_by_date: bool,
    pub only_paired: bool,
    pub include_video: bool,
}

fn presets_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;
    let dir = data_dir.join("presets");
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create presets dir: {}", e))?;
    Ok(dir)
}

fn preset_path(dir: &PathBuf, name: &str) -> PathBuf {
    // Sanitize name: replace any filesystem-unsafe chars with underscore
    let safe: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    dir.join(format!("{}.json", safe))
}

/// Save (create or overwrite) a preset.
#[tauri::command]
pub async fn save_preset(app: tauri::AppHandle, preset: Preset) -> Result<(), String> {
    if preset.name.trim().is_empty() {
        return Err("Preset name cannot be empty".into());
    }
    let dir = presets_dir(&app)?;
    let path = preset_path(&dir, &preset.name);
    let json =
        serde_json::to_string_pretty(&preset).map_err(|e| format!("Serialization error: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Cannot write preset: {}", e))
}

/// List all saved preset names, sorted alphabetically.
#[tauri::command]
pub async fn list_presets(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = presets_dir(&app)?;
    let mut names: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| format!("Cannot read presets dir: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x == "json")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let path = e.path();
            let data = fs::read_to_string(&path).ok()?;
            let preset: Preset = serde_json::from_str(&data).ok()?;
            Some(preset.name)
        })
        .collect();
    names.sort();
    Ok(names)
}

/// Load a preset by name.
#[tauri::command]
pub async fn load_preset(app: tauri::AppHandle, name: String) -> Result<Preset, String> {
    let dir = presets_dir(&app)?;
    let path = preset_path(&dir, &name);
    let data =
        fs::read_to_string(&path).map_err(|e| format!("Cannot read preset '{}': {}", name, e))?;
    serde_json::from_str(&data).map_err(|e| format!("Invalid preset data: {}", e))
}

/// Delete a preset by name.
#[tauri::command]
pub async fn delete_preset(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let dir = presets_dir(&app)?;
    let path = preset_path(&dir, &name);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Cannot delete preset: {}", e))?;
    }
    Ok(())
}
