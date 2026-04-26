mod commands;
mod pending_open;
mod watcher;

use std::sync::Mutex;

use pending_open::PendingOpenFiles;
use tauri::{AppHandle, Manager, RunEvent};
use watcher::WatcherState;

#[cfg(any(target_os = "macos", target_os = "ios"))]
pub const OPEN_FILE_EVENT: &str = "open-file";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(Mutex::new(WatcherState::default()));
            app.manage(PendingOpenFiles::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_markdown,
            commands::watch_file,
            commands::unwatch_file,
            commands::reveal_in_file_manager,
            commands::path_meta,
            commands::drain_pending_open_files,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(on_run_event);
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
fn on_run_event(app: &AppHandle, event: RunEvent) {
    use tauri::Emitter;
    if let RunEvent::Opened { urls } = event {
        for url in urls {
            if let Ok(path) = url.to_file_path() {
                // Buffer for cold-start drain. The synchronous emit below
                // reaches no listeners on a fresh launch — the React tree
                // hasn't mounted yet — so the frontend pulls these via
                // `drain_pending_open_files` once tab restoration is done.
                if let Some(buffer) = app.try_state::<PendingOpenFiles>() {
                    buffer.push(path.clone());
                }
                let payload = path.to_string_lossy().into_owned();
                if let Err(err) = app.emit(OPEN_FILE_EVENT, payload) {
                    eprintln!("failed to emit open-file event: {err}");
                }
            }
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
fn on_run_event(_app: &AppHandle, _event: RunEvent) {
    // RunEvent::Opened is macOS/iOS-only; other platforms rely on the CLI plugin.
}
