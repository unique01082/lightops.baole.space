mod commands;
mod storage;

use commands::*;
use storage::*;
use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

const MENU_EVENT: &str = "lightops://menu";
const MENU_ADD_SOURCE: &str = "menu:add-source";
const MENU_CHOOSE_OUTPUT: &str = "menu:choose-output";
const MENU_SAVE_PRESET: &str = "menu:save-preset";
const MENU_SETTINGS: &str = "menu:settings";
const MENU_DRY_RUN: &str = "menu:dry-run";
const MENU_RUN: &str = "menu:run";
const MENU_STOP: &str = "menu:stop";
const MENU_SHOW_RESULTS: &str = "menu:show-results";
const MENU_LANGUAGE_EN: &str = "menu:language-en";
const MENU_LANGUAGE_VI: &str = "menu:language-vi";
const MENU_CHECK_UPDATES: &str = "menu:check-updates";
const MENU_HELP: &str = "menu:help";
const MENU_SHORTCUTS: &str = "menu:shortcuts";
const MENU_ABOUT: &str = "menu:about";
const MENU_QUIT: &str = "menu:quit";

fn build_menu<R: tauri::Runtime>(handle: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let pkg_info = handle.package_info();
    let config = handle.config();
    let about_metadata = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        ..Default::default()
    };

    #[cfg(target_os = "macos")]
    let app_menu = Submenu::with_items(
        handle,
        pkg_info.name.clone(),
        true,
        &[
            &PredefinedMenuItem::about(handle, None, Some(about_metadata.clone()))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;

    let add_source = MenuItem::with_id(
        handle,
        MENU_ADD_SOURCE,
        "Add Source Folder...",
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let choose_output = MenuItem::with_id(
        handle,
        MENU_CHOOSE_OUTPUT,
        "Choose Output Folder...",
        true,
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let save_preset = MenuItem::with_id(
        handle,
        MENU_SAVE_PRESET,
        "Save Preset...",
        true,
        Some("CmdOrCtrl+S"),
    )?;
    let settings = MenuItem::with_id(
        handle,
        MENU_SETTINGS,
        "Settings...",
        true,
        Some("CmdOrCtrl+,"),
    )?;
    #[cfg(not(target_os = "macos"))]
    let quit = MenuItem::with_id(
        handle,
        MENU_QUIT,
        "Quit LightOps",
        true,
        Some("CmdOrCtrl+Q"),
    )?;

    let dry_run = MenuItem::with_id(
        handle,
        MENU_DRY_RUN,
        "Dry Run",
        true,
        Some("CmdOrCtrl+Shift+Enter"),
    )?;
    let run = MenuItem::with_id(handle, MENU_RUN, "Run", true, Some("CmdOrCtrl+Enter"))?;
    let stop = MenuItem::with_id(handle, MENU_STOP, "Stop", true, Some("Esc"))?;

    let show_results = MenuItem::with_id(
        handle,
        MENU_SHOW_RESULTS,
        "Show Results",
        true,
        Some("CmdOrCtrl+L"),
    )?;
    let language_en = MenuItem::with_id(
        handle,
        MENU_LANGUAGE_EN,
        "Language: English",
        true,
        None::<&str>,
    )?;
    let language_vi = MenuItem::with_id(
        handle,
        MENU_LANGUAGE_VI,
        "Language: Vietnamese",
        true,
        None::<&str>,
    )?;

    let check_updates = MenuItem::with_id(
        handle,
        MENU_CHECK_UPDATES,
        "Check for Updates",
        true,
        None::<&str>,
    )?;
    let help = MenuItem::with_id(handle, MENU_HELP, "LightOps Help", true, Some("F1"))?;
    let shortcuts = MenuItem::with_id(
        handle,
        MENU_SHORTCUTS,
        "Keyboard Shortcuts",
        true,
        Some("CmdOrCtrl+/"),
    )?;
    let about_author = MenuItem::with_id(handle, MENU_ABOUT, "About / Author", true, None::<&str>)?;

    let file_menu = Submenu::with_id_and_items(
        handle,
        "file",
        "File",
        true,
        &[
            &add_source,
            &choose_output,
            &PredefinedMenuItem::separator(handle)?,
            &save_preset,
            &settings,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(handle)?,
            #[cfg(not(target_os = "macos"))]
            &quit,
        ],
    )?;

    let run_menu = Submenu::with_id_and_items(
        handle,
        "run",
        "Run",
        true,
        &[
            &dry_run,
            &run,
            &PredefinedMenuItem::separator(handle)?,
            &stop,
        ],
    )?;

    let view_menu = Submenu::with_id_and_items(
        handle,
        "view",
        "View",
        true,
        &[
            &show_results,
            &PredefinedMenuItem::separator(handle)?,
            &language_en,
            &language_vi,
        ],
    )?;

    let help_menu = Submenu::with_id_and_items(
        handle,
        "help",
        "Help",
        true,
        &[
            &help,
            &shortcuts,
            &about_author,
            &PredefinedMenuItem::separator(handle)?,
            &check_updates,
        ],
    )?;

    Menu::with_items(
        handle,
        &[
            #[cfg(target_os = "macos")]
            &app_menu,
            &file_menu,
            &run_menu,
            &view_menu,
            &help_menu,
        ],
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(JobState::default())
        .setup(|app| {
            let store = LocalStore::open(app.handle()).map_err(std::io::Error::other)?;
            app.manage(store);
            Ok(())
        })
        .menu(build_menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == MENU_QUIT {
                app.exit(0);
                return;
            }

            let _ = app.emit(MENU_EVENT, id);
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            scan_folders,
            scan_source_metadata,
            build_rename_plan,
            execute_plan,
            cancel_execution,
            pick_folder,
            check_update,
            save_preset,
            list_presets,
            load_preset,
            delete_preset,
            inspect_media,
            expand_media_paths,
            analyze_tool,
            start_tool_job,
            cancel_tool_job,
            copy_output_image,
            analyze_sequences,
            export_sequences,
            suggest_before_after_pairs,
            metadata_safe_share_categories,
            audit_metadata,
            clean_metadata,
            export_before_after,
            media_sidecar_status,
            record_recent_job,
            list_recent_jobs,
            upsert_tool_preset,
            list_tool_presets,
            delete_tool_preset,
            set_user_setting,
            list_user_settings,
            get_sync_device_id,
            get_sync_cursor,
            list_sync_outbox,
            record_sync_failure,
            apply_sync_response,
            start_oidc_callback_listener,
            store_oidc_session,
            load_oidc_session,
            clear_oidc_session,
            set_oidc_state,
            get_oidc_state,
            remove_oidc_state,
            list_oidc_state_keys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LightOps");
}
