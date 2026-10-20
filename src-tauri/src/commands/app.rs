use serde::Serialize;
use tauri::{AppHandle, State};

use super::{BackendState, BootPayload};

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
}

#[tauri::command]
pub fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
    }
}

#[tauri::command]
pub fn get_boot_payload(app: AppHandle, state: State<'_, BackendState>) -> BootPayload {
    BootPayload {
        library: state.library.lock().expect("library lock poisoned").clone(),
        settings: state.settings.lock().expect("settings lock poisoned").clone(),
        version: app.package_info().version.to_string(),
    }
}
