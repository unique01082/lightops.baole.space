use tauri_plugin_dialog::DialogExt;

/// Open a native folder picker dialog.
/// Returns the selected path, or None if the user cancelled.
#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = app.dialog().file().blocking_pick_folder();

    Ok(path.map(|p| p.to_string()))
}
