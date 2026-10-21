use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

use super::UpdateStatus;

pub const UPDATE_STATUS: &str = "update_status";

// Mirrors electron-updater's flow: check on launch, download automatically, install on demand or on quit.
#[derive(Default)]
pub struct UpdaterState {
    status: Mutex<Option<UpdateStatus>>,
    downloaded: Mutex<Option<(Update, Vec<u8>)>>,
}

fn is_packaged() -> bool {
    !cfg!(debug_assertions)
}

fn current_status(app: &AppHandle, state: &UpdaterState) -> UpdateStatus {
    state.status.lock().expect("update status lock poisoned").clone().unwrap_or_else(|| UpdateStatus {
        state: if is_packaged() { "idle" } else { "development" }.into(),
        current_version: app.package_info().version.to_string(),
        available_version: None,
        downloaded_version: None,
        progress: 0.0,
        message: if is_packaged() { "" } else { "Auto-updates are available in packaged builds." }.into(),
    })
}

fn set_status(app: &AppHandle, patch: impl FnOnce(&mut UpdateStatus)) -> UpdateStatus {
    let state = app.state::<UpdaterState>();
    let mut next = current_status(app, &state);
    patch(&mut next);
    *state.status.lock().expect("update status lock poisoned") = Some(next.clone());
    let _ = app.emit(UPDATE_STATUS, next.clone());
    next
}

fn set_error(app: &AppHandle, error: impl std::fmt::Display) -> UpdateStatus {
    set_status(app, |status| {
        status.state = "error".into();
        status.progress = 0.0;
        status.message = format!("Unable to check for updates: {error}");
    })
}

pub async fn check(app: AppHandle) -> UpdateStatus {
    if !is_packaged() {
        return set_status(&app, |status| {
            status.state = "development".into();
            status.message = "Auto-updates are available in packaged builds.".into();
        });
    }

    {
        let status = current_status(&app, &app.state::<UpdaterState>());
        if matches!(status.state.as_str(), "checking" | "downloading" | "downloaded" | "installing") {
            return status;
        }
    }

    set_status(&app, |status| {
        status.state = "checking".into();
        status.available_version = None;
        status.downloaded_version = None;
        status.progress = 0.0;
        status.message = "Checking for updates...".into();
    });

    let update = match app.updater().map_err(|error| error.to_string()) {
        Ok(updater) => updater.check().await.map_err(|error| error.to_string()),
        Err(error) => Err(error),
    };
    let update = match update {
        Ok(Some(update)) => update,
        Ok(None) => {
            return set_status(&app, |status| {
                status.state = "idle".into();
                status.message = "You are up to date.".into();
            })
        }
        Err(error) => return set_error(&app, error),
    };

    let version = update.version.clone();
    let available = set_status(&app, |status| {
        status.state = "available".into();
        status.available_version = Some(version.clone());
        status.message = format!("Update {version} is available.");
    });

    let download_app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut received = 0usize;
        let progress_app = download_app.clone();
        let bytes = update.download(
            |chunk, total| {
                received += chunk;
                let percent = total.filter(|total| *total > 0).map(|total| received as f64 / total as f64 * 100.0).unwrap_or(0.0);
                set_status(&progress_app, |status| {
                    status.state = "downloading".into();
                    status.progress = percent;
                    status.message = if percent > 0.0 { format!("Downloading update... {}%", percent.round()) } else { "Downloading update...".into() };
                });
            },
            || {},
        ).await;

        match bytes {
            Ok(bytes) => {
                let version = update.version.clone();
                *download_app.state::<UpdaterState>().downloaded.lock().expect("update lock poisoned") = Some((update, bytes));
                set_status(&download_app, |status| {
                    status.state = "downloaded".into();
                    status.downloaded_version = Some(version.clone());
                    status.progress = 100.0;
                    status.message = format!("Update {version} is ready to install.");
                });
            }
            Err(error) => {
                set_error(&download_app, error);
            }
        }
    });

    available
}

// Called on quit, like electron-updater's autoInstallOnAppQuit.
pub fn install_pending(app: &AppHandle) -> bool {
    let Some((update, bytes)) = app.state::<UpdaterState>().downloaded.lock().expect("update lock poisoned").take() else { return false };
    match update.install(bytes) {
        Ok(()) => true,
        Err(error) => {
            set_error(app, error);
            false
        }
    }
}

#[tauri::command]
pub fn get_update_status(app: AppHandle, state: State<'_, UpdaterState>) -> UpdateStatus {
    current_status(&app, &state)
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> UpdateStatus {
    check(app).await
}

#[tauri::command]
pub fn install_update(app: AppHandle) -> bool {
    if current_status(&app, &app.state::<UpdaterState>()).state != "downloaded" {
        return false;
    }

    set_status(&app, |status| {
        status.state = "installing".into();
        status.message = "Restarting to install update...".into();
    });

    if !install_pending(&app) {
        return false;
    }

    let restart_app = app.clone();
    tauri::async_runtime::spawn(async move { restart_app.restart() });
    true
}
