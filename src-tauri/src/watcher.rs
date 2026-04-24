use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use notify::event::ModifyKind;
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Event emitted to the frontend when a watched file is modified.
pub const FILE_CHANGED_EVENT: &str = "file-changed";

#[derive(Debug, Clone, Serialize)]
pub struct FileChangedPayload {
    pub path: String,
}

#[derive(Default)]
pub struct WatcherState {
    handles: HashMap<PathBuf, WatcherHandle>,
}

struct WatcherHandle {
    _watcher: RecommendedWatcher,
}

impl WatcherState {
    pub fn watch(&mut self, app: &AppHandle, path: &Path) -> Result<(), String> {
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("failed to resolve path: {e}"))?;

        if self.handles.contains_key(&canonical) {
            return Ok(());
        }

        let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();
        let watch_target = parent_dir(&canonical)?;
        let emit_path = canonical.clone();

        let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let _ = tx.send(res);
        })
        .map_err(|e| format!("watcher init error: {e}"))?;

        watcher
            .watch(&watch_target, RecursiveMode::NonRecursive)
            .map_err(|e| format!("failed to watch: {e}"))?;

        let app_for_thread = app.clone();
        thread::spawn(move || {
            while let Ok(event) = rx.recv() {
                let Ok(event) = event else { continue };
                if !is_content_change(event.kind) {
                    continue;
                }
                if !event.paths.iter().any(|p| paths_match(p, &emit_path)) {
                    continue;
                }
                // Coalesce bursts (editors often write 2-3 events).
                thread::sleep(Duration::from_millis(20));
                while rx.try_recv().is_ok() {}
                let payload = FileChangedPayload {
                    path: emit_path.to_string_lossy().into_owned(),
                };
                if let Err(err) = app_for_thread.emit(FILE_CHANGED_EVENT, payload) {
                    eprintln!("failed to emit file-changed: {err}");
                }
            }
        });

        self.handles
            .insert(canonical, WatcherHandle { _watcher: watcher });
        Ok(())
    }

    pub fn unwatch(&mut self, path: &Path) -> Result<(), String> {
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("failed to resolve path: {e}"))?;
        self.handles.remove(&canonical);
        Ok(())
    }

    pub fn clear(&mut self) {
        self.handles.clear();
    }

    #[cfg(test)]
    pub fn watched_count(&self) -> usize {
        self.handles.len()
    }
}

fn parent_dir(path: &Path) -> Result<PathBuf, String> {
    path.parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "path has no parent directory".to_string())
}

fn is_content_change(kind: EventKind) -> bool {
    matches!(
        kind,
        EventKind::Modify(ModifyKind::Data(_) | ModifyKind::Any | ModifyKind::Name(_))
            | EventKind::Create(_)
    )
}

fn paths_match(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_state_has_no_watcher() {
        let s = WatcherState::default();
        assert_eq!(s.watched_count(), 0);
    }

    #[test]
    fn clear_drops_all_watchers() {
        let mut s = WatcherState::default();
        s.clear();
        assert_eq!(s.watched_count(), 0);
    }

    #[test]
    fn content_change_is_detected() {
        use notify::event::DataChange;
        assert!(is_content_change(EventKind::Modify(ModifyKind::Any)));
        assert!(is_content_change(EventKind::Modify(ModifyKind::Data(
            DataChange::Any
        ))));
        assert!(is_content_change(EventKind::Create(
            notify::event::CreateKind::File
        )));
        assert!(!is_content_change(EventKind::Access(
            notify::event::AccessKind::Read
        )));
    }
}
