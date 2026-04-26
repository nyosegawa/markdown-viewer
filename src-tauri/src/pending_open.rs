use std::path::PathBuf;
use std::sync::Mutex;

/// Buffer for filesystem paths delivered via macOS Apple Events
/// (`RunEvent::Opened`) before the frontend has subscribed to the
/// `open-file` event.
///
/// On cold launch, Launch Services dispatches `application:openFiles:`
/// almost immediately — well before our React tree mounts and calls
/// `listen("open-file", …)`. The synchronous `Emitter::emit` happens to
/// no listeners and is silently dropped. We push every URL into this
/// buffer as well; the frontend drains it via Tauri command once it has
/// finished tab restoration.
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
}
