mod commands;
mod watcher;

use std::sync::Mutex;

use tauri::Manager;
use watcher::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            app.manage(Mutex::new(WatcherState::default()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_markdown,
            commands::watch_file,
            commands::unwatch_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
