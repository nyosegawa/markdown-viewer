use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::watcher::WatcherState;

#[tauri::command]
pub async fn read_markdown(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("failed to read {}: {e}", path.display()))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn watch_file(
    app: AppHandle,
    state: State<'_, Mutex<WatcherState>>,
    path: String,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.watch(&app, Path::new(&path))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn unwatch_file(
    state: State<'_, Mutex<WatcherState>>,
    path: Option<String>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    if let Some(p) = path {
        guard.unwatch(Path::new(&p))
    } else {
        guard.clear();
        Ok(())
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("path does not exist: {}", target.display()));
    }
    reveal_impl(&target)
}

#[cfg(target_os = "macos")]
fn reveal_impl(path: &Path) -> Result<(), String> {
    use std::process::Command;
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("open -R failed: {e}"))
}

#[cfg(target_os = "windows")]
fn reveal_impl(path: &Path) -> Result<(), String> {
    use std::process::Command;
    Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("explorer /select failed: {e}"))
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn reveal_impl(path: &Path) -> Result<(), String> {
    use std::process::Command;
    let parent = path
        .parent()
        .ok_or_else(|| "path has no parent directory".to_string())?;
    Command::new("xdg-open")
        .arg(parent)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("xdg-open failed: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use tokio::io::AsyncWriteExt;

    #[tokio::test]
    async fn read_markdown_returns_contents() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("sample.md");
        let mut f = tokio::fs::File::create(&path).await.expect("create");
        f.write_all(b"# hello\n").await.expect("write");
        f.flush().await.expect("flush");
        drop(f);

        let out = read_markdown(path.to_string_lossy().into_owned())
            .await
            .expect("read ok");
        assert_eq!(out, "# hello\n");
    }

    #[tokio::test]
    async fn read_markdown_returns_error_on_missing_file() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("missing.md");
        let err = read_markdown(path.to_string_lossy().into_owned())
            .await
            .expect_err("should fail");
        assert!(err.contains("failed to read"));
    }

    #[tokio::test]
    async fn read_markdown_preserves_utf8() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("unicode.md");
        let text = "# テスト\n\nマルチバイト文字を含む Markdown。\n";
        tokio::fs::write(&path, text).await.expect("write");

        let out = read_markdown(path.to_string_lossy().into_owned())
            .await
            .expect("read ok");
        assert_eq!(out, text);
    }

    #[test]
    fn reveal_rejects_missing_path() {
        let dir = tempdir().expect("tempdir");
        let missing = dir.path().join("nope.md");
        let err =
            reveal_in_file_manager(missing.to_string_lossy().into_owned()).expect_err("should err");
        assert!(err.contains("does not exist"));
    }
}
