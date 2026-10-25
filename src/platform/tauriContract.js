// Command and event names shared with src-tauri/src (keep in sync with lib.rs and commands/mod.rs).
export const TAURI_COMMANDS = Object.freeze({
  getAppInfo: 'get_app_info',
  getBootPayload: 'get_boot_payload',
  openFilePicker: 'open_file_picker',
  getLaunchFiles: 'get_launch_files',
  inspectComic: 'inspect_comic',
  extractComic: 'extract_comic',
  cancelExtraction: 'cancel_extraction',
  getLibrary: 'get_library',
  getSettings: 'get_settings',
  syncLibrary: 'sync_library',
  saveSettings: 'save_settings',
  saveProgress: 'save_progress',
  removeFromLibrary: 'remove_from_library',
  toggleFullscreen: 'toggle_fullscreen',
  getUpdateStatus: 'get_update_status',
  checkForUpdates: 'check_for_updates',
  installUpdate: 'install_update',
});

export const TAURI_EVENTS = Object.freeze({
  filesDropped: 'files_dropped',
  appFocusChange: 'app_focus_change',
  settingsChanged: 'settings_changed',
  updateStatus: 'update_status',
});
