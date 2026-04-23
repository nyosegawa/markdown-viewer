use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use notify::event::ModifyKind;
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Event emitted to the frontend when the watched file is modified.
pub const FILE_CHANGED_EVENT: &str = "file-changed";

#[derive(Debug, Clone, Serialize)]
pub struct FileChangedPayload {
    pub path: String,
}

#[derive(Default)]
pub struct WatcherState {
    current: Option<WatcherHandle>,
}

struct WatcherHandle {
    path: PathBuf,
    _watcher: RecommendedWatcher,
}

impl WatcherState {
    pub fn watch(&mut self, app: &AppHandle, path: &Path) -> Result<(), String> {
        let path = path
            .canonicalize()
            .map_err(|e| format!("failed to resolve path: {e}"))?;

        if let Some(current) = &self.current {
            if current.path == path {
                return Ok(());
            }
        }
        self.clear();

        let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();

        let watch_target = parent_dir(&path)?;
        let target_path = path.clone();

        let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let _ = tx.send(res);
        })
        .map_err(|e| format!("watcher init error: {e}"))?;

        watcher
            .watch(&watch_target, RecursiveMode::NonRecursive)
            .map_err(|e| format!("failed to watch: {e}"))?;

        let app_for_thread = app.clone();
        let emit_path = target_path.clone();
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

        self.current = Some(WatcherHandle {
            path: target_path,
            _watcher: watcher,
        });
        Ok(())
    }

    pub fn clear(&mut self) {
        self.current = None;
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
        assert!(s.current.is_none());
    }

    #[test]
    fn clear_drops_watcher() {
        let mut s = WatcherState::default();
        s.clear();
        assert!(s.current.is_none());
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
