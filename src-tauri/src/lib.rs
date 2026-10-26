mod commands;

use std::sync::atomic::Ordering;

use commands::updates::UpdaterState;
use commands::BackendState;
use tauri::{AppHandle, Emitter, Manager, RunEvent};

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Mirrors Electron's flushOpenFiles: deliver now if the renderer is listening, otherwise queue for get_launch_files.
fn open_files(app: &AppHandle, files: Vec<String>) {
    let files = files.into_iter().filter(|path| commands::library::is_comic_path(path)).collect::<Vec<_>>();
    if files.is_empty() {
        return;
    }

    let state = app.state::<BackendState>();
    if state.renderer_ready.load(Ordering::SeqCst) {
        let _ = app.emit(commands::FILES_DROPPED, files);
    } else {
        state.pending_open_files.lock().expect("pending files lock poisoned").extend(files);
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            focus_main_window(app);
            open_files(app, args);
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(BackendState::default())
        .manage(UpdaterState::default())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::Focused(focused) => {
                window.state::<BackendState>().window_blurred.store(!focused, Ordering::SeqCst);
            }
            // Like the Electron build: closing the window keeps Onyx in the Dock; Cmd+Q quits.
            #[cfg(target_os = "macos")]
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .setup(|app| {
            let handle = app.handle();
            commands::library::load_state(handle, &handle.state::<BackendState>());
            commands::library::load_page_cache(handle, &handle.state::<BackendState>());
            tauri::async_runtime::spawn(commands::updates::check(handle.clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::get_app_info,
            commands::app::get_boot_payload,
            commands::library::open_file_picker,
            commands::library::open_folder_picker,
            commands::library::expand_comic_paths,
            commands::library::get_launch_files,
            commands::library::inspect_comic,
            commands::library::extract_comic,
            commands::library::cancel_extraction,
            commands::library::get_library,
            commands::library::get_settings,
            commands::library::sync_library,
            commands::library::save_settings,
            commands::library::save_progress,
            commands::library::remove_from_library,
            commands::window::toggle_fullscreen,
            commands::updates::get_update_status,
            commands::updates::check_for_updates,
            commands::updates::install_update
        ])
        .build(tauri::generate_context!())
        .expect("error while building onyx")
        .run(|app, event| match event {
            #[cfg(target_os = "macos")]
            RunEvent::Opened { urls } => {
                let files = urls.into_iter().filter_map(|url| url.to_file_path().ok()).map(|path| path.to_string_lossy().to_string()).collect();
                open_files(app, files);
            }
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => focus_main_window(app),
            RunEvent::Exit => {
                commands::updates::install_pending(app);
                commands::library::clear_cache(app);
            }
            _ => {}
        });
}
