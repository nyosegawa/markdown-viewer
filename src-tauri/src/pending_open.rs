use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

/// Buffer for filesystem paths delivered via macOS Apple Events
/// (`RunEvent::Opened`) before the frontend has subscribed to the
/// `open-file` event.
///
/// Why a process-static instead of `app.manage(...)` Tauri state:
///
/// On a cold launch, Launch Services dispatches `application:openFiles:`
/// almost immediately — and Tauri's `setup` callback (where `app.manage`
/// runs) is not guaranteed to have completed before the run loop starts
/// pumping events. If `RunEvent::Opened` fires first, `app.try_state` for
/// our buffer returns `None` and the path silently disappears. A
/// `OnceLock` initialised lazily on first access sidesteps that race —
/// every code path (run-event handler, Tauri command, tests) sees the
/// same instance, populated regardless of whether `setup` has run yet.
#[derive(Default)]
pub struct PendingOpenFiles {
    paths: Mutex<Vec<PathBuf>>,
}

impl PendingOpenFiles {
    pub fn push(&self, path: PathBuf) {
        if let Ok(mut guard) = self.paths.lock() {
            guard.push(path);
        }
    }

    pub fn drain(&self) -> Vec<PathBuf> {
        self.paths
            .lock()
            .map(|mut guard| std::mem::take(&mut *guard))
            .unwrap_or_default()
    }
}

static SHARED: OnceLock<PendingOpenFiles> = OnceLock::new();

/// Returns the process-wide buffer. Lazily initialised on first call so
/// the run-event handler can write to it before `setup` runs.
pub fn shared() -> &'static PendingOpenFiles {
    SHARED.get_or_init(PendingOpenFiles::default)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_then_drain_returns_paths_in_insertion_order() {
        let buf = PendingOpenFiles::default();
        buf.push(PathBuf::from("/tmp/a.md"));
        buf.push(PathBuf::from("/tmp/b.md"));
        assert_eq!(
            buf.drain(),
            vec![PathBuf::from("/tmp/a.md"), PathBuf::from("/tmp/b.md")]
        );
    }

    #[test]
    fn drain_empties_the_buffer_so_a_second_drain_yields_nothing() {
        let buf = PendingOpenFiles::default();
        buf.push(PathBuf::from("/tmp/a.md"));
        let _ = buf.drain();
        assert!(buf.drain().is_empty());
    }

    #[test]
    fn drain_on_empty_buffer_returns_empty_vec() {
        let buf = PendingOpenFiles::default();
        assert!(buf.drain().is_empty());
    }

    #[test]
    fn unicode_paths_round_trip_through_the_buffer() {
        let buf = PendingOpenFiles::default();
        let p = PathBuf::from("/tmp/テスト.md");
        buf.push(p.clone());
        assert_eq!(buf.drain(), vec![p]);
    }

    #[test]
    fn shared_returns_the_same_instance_across_calls() {
        let a = shared() as *const PendingOpenFiles;
        let b = shared() as *const PendingOpenFiles;
        assert_eq!(a, b);
    }
}
