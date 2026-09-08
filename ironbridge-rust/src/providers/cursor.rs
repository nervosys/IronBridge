// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Cursor IDE chat provider

use super::{ChatProvider, ProviderType};
use crate::models::ChatSession;
use crate::storage::parse_session_json;
use anyhow::Result;
use std::path::PathBuf;

/// Cursor IDE chat provider
///
/// Cursor stores chat sessions in a similar format to VS Code Copilot,
/// located in the Cursor app data directory.
pub struct CursorProvider {
    /// Path to Cursor's workspace storage
    storage_path: PathBuf,
    /// Whether Cursor is installed and accessible
    available: bool,
}

impl CursorProvider {
    /// Discover Cursor installation and create provider
    pub fn discover() -> Option<Self> {
        let storage_path = Self::find_cursor_storage()?;

        Some(Self {
            available: storage_path.exists(),
            storage_path,
        })
    }

    /// Find Cursor's workspace storage directory
    fn find_cursor_storage() -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            let appdata = dirs::data_dir()?;
            let cursor_path = appdata.join("Cursor").join("User").join("workspaceStorage");
            if cursor_path.exists() {
                return Some(cursor_path);
            }
            // Also check Roaming
            let roaming = std::env::var("APPDATA").ok()?;
            let roaming_path = PathBuf::from(roaming)
                .join("Cursor")
                .join("User")
                .join("workspaceStorage");
            if roaming_path.exists() {
                return Some(roaming_path);
            }
        }

        #[cfg(target_os = "macos")]
        {
            let home = dirs::home_dir()?;
            let cursor_path = home
                .join("Library")
                .join("Application Support")
                .join("Cursor")
                .join("User")
                .join("workspaceStorage");
            if cursor_path.exists() {
                return Some(cursor_path);
            }
        }

        #[cfg(target_os = "linux")]
        {
            let config = dirs::config_dir()?;
            let cursor_path = config.join("Cursor").join("User").join("workspaceStorage");
            if cursor_path.exists() {
                return Some(cursor_path);
            }
        }

        None
    }

    /// List all workspace directories with chat sessions
    fn list_workspaces(&self) -> Result<Vec<PathBuf>> {
        let mut workspaces = Vec::new();

        if self.storage_path.exists() {
            for entry in std::fs::read_dir(&self.storage_path)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_dir() {
                    // Check for chat sessions directory
                    let chat_path = path.join("chatSessions");
                    if chat_path.exists() {
                        workspaces.push(path);
                    }
                }
            }
        }

        Ok(workspaces)
    }
}

impl ChatProvider for CursorProvider {
    fn provider_type(&self) -> ProviderType {
        ProviderType::Cursor
    }

    fn name(&self) -> &str {
        "Cursor"
    }

    fn is_available(&self) -> bool {
        self.available
    }

    fn sessions_path(&self) -> Option<PathBuf> {
        Some(self.storage_path.clone())
    }

    fn list_sessions(&self) -> Result<Vec<ChatSession>> {
        let mut sessions = Vec::new();

        for workspace in self.list_workspaces()? {
            let chat_path = workspace.join("chatSessions");

            if chat_path.exists() {
                for entry in std::fs::read_dir(&chat_path)? {
                    let entry = entry?;
                    let path = entry.path();

                    if path.extension().is_some_and(|e| e == "json") {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            if let Ok(session) = parse_session_json(&content) {
                                sessions.push(session);
                            }
                        }
                    }
                }
            }
        }

        Ok(sessions)
    }

    fn import_session(&self, session_id: &str) -> Result<ChatSession> {
        // Search for the session file across all workspaces
        for workspace in self.list_workspaces()? {
            let session_path = workspace
                .join("chatSessions")
                .join(format!("{}.json", session_id));

            if session_path.exists() {
                let content = std::fs::read_to_string(&session_path)?;
                let session: ChatSession = serde_json::from_str(&content)?;
                return Ok(session);
            }
        }

        anyhow::bail!("Session not found: {}", session_id)
    }

    /// Write a session into Cursor's own store, so Cursor can open it.
    ///
    /// The format is the one [`Self::import_session`] reads back, which is what
    /// makes the round trip meaningful.
    ///
    /// Cursor keeps one `chatSessions` directory per workspace, and a session
    /// on its own does not say which workspace it belongs to. Rather than guess
    /// -- and silently drop a session into a project it has nothing to do with
    /// -- the target is resolved in this order:
    ///
    /// 1. the workspace already holding a file with this session's id, so
    ///    re-exporting updates in place rather than forking a second copy;
    /// 2. the only workspace, when there is exactly one;
    /// 3. otherwise an error listing the candidates, because at that point the
    ///    caller knows something this function does not.
    fn export_session(&self, session: &ChatSession) -> Result<()> {
        let session_id = session
            .session_id
            .as_deref()
            .filter(|id| !id.is_empty())
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "session has no id, and Cursor addresses sessions by filename; \
                     set `session_id` before exporting"
                )
            })?;

        // A traversal-safe id: this becomes a filename, and a session read from
        // an untrusted export must not be able to name a path outside the
        // workspace.
        if session_id.contains(['/', '\\', ':']) || session_id.starts_with('.') {
            anyhow::bail!("session id {session_id:?} is not usable as a filename");
        }

        let workspaces = self.list_workspaces()?;
        let filename = format!("{session_id}.json");

        let target = workspaces
            .iter()
            .find(|ws| ws.join("chatSessions").join(&filename).exists())
            .or(match workspaces.as_slice() {
                [only] => Some(only),
                _ => None,
            })
            .ok_or_else(|| match workspaces.len() {
                0 => anyhow::anyhow!(
                    "no Cursor workspace with a chatSessions directory was found under {}",
                    self.storage_path.display()
                ),
                n => anyhow::anyhow!(
                    "{n} Cursor workspaces exist and none already holds session {session_id}; \
                     import it first, or export to a file and place it by hand"
                ),
            })?;

        let chat_dir = target.join("chatSessions");
        std::fs::create_dir_all(&chat_dir)?;
        let json = serde_json::to_string_pretty(session)?;
        std::fs::write(chat_dir.join(&filename), json)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A provider rooted at a temp dir, so no test touches a real Cursor
    /// install.
    fn provider_at(root: &std::path::Path) -> CursorProvider {
        CursorProvider {
            storage_path: root.to_path_buf(),
            available: true,
        }
    }

    fn workspace(root: &std::path::Path, name: &str) -> PathBuf {
        let ws = root.join(name);
        std::fs::create_dir_all(ws.join("chatSessions")).unwrap();
        ws
    }

    /// Built through serde rather than a struct literal, so the fields get the
    /// same defaults a file read would produce -- `version` is 3, not 0.
    fn blank_session() -> ChatSession {
        serde_json::from_str("{}").unwrap()
    }

    fn session(id: &str) -> ChatSession {
        ChatSession {
            session_id: Some(id.to_string()),
            custom_title: Some("exported".to_string()),
            ..blank_session()
        }
    }

    #[test]
    fn a_single_workspace_is_the_obvious_target() {
        let tmp = tempfile::tempdir().unwrap();
        let ws = workspace(tmp.path(), "only");

        provider_at(tmp.path())
            .export_session(&session("abc"))
            .unwrap();

        assert!(ws.join("chatSessions").join("abc.json").exists());
    }

    #[test]
    fn an_export_round_trips_through_import() {
        let tmp = tempfile::tempdir().unwrap();
        workspace(tmp.path(), "only");
        let p = provider_at(tmp.path());

        p.export_session(&session("abc")).unwrap();
        let back = p.import_session("abc").unwrap();

        assert_eq!(back.session_id.as_deref(), Some("abc"));
        assert_eq!(back.custom_title.as_deref(), Some("exported"));
    }

    #[test]
    fn re_exporting_updates_in_place_rather_than_forking() {
        let tmp = tempfile::tempdir().unwrap();
        let a = workspace(tmp.path(), "a");
        let b = workspace(tmp.path(), "b");
        // `abc` already lives in b, so b wins even though a sorts first.
        std::fs::write(b.join("chatSessions").join("abc.json"), "{}").unwrap();

        provider_at(tmp.path())
            .export_session(&session("abc"))
            .unwrap();

        assert!(!a.join("chatSessions").join("abc.json").exists());
        let written = std::fs::read_to_string(b.join("chatSessions").join("abc.json")).unwrap();
        assert!(
            written.contains("exported"),
            "the placeholder was not replaced"
        );
    }

    #[test]
    fn an_ambiguous_target_is_refused_rather_than_guessed() {
        let tmp = tempfile::tempdir().unwrap();
        let a = workspace(tmp.path(), "a");
        let b = workspace(tmp.path(), "b");

        let err = provider_at(tmp.path())
            .export_session(&session("abc"))
            .unwrap_err()
            .to_string();

        assert!(err.contains('2'), "the error should say how many: {err}");
        assert!(!a.join("chatSessions").join("abc.json").exists());
        assert!(!b.join("chatSessions").join("abc.json").exists());
    }

    #[test]
    fn a_session_without_an_id_is_refused() {
        let tmp = tempfile::tempdir().unwrap();
        workspace(tmp.path(), "only");

        let err = provider_at(tmp.path())
            .export_session(&blank_session())
            .unwrap_err()
            .to_string();

        assert!(err.contains("no id"), "unexpected: {err}");
    }

    #[test]
    fn an_id_cannot_escape_the_workspace() {
        let tmp = tempfile::tempdir().unwrap();
        workspace(tmp.path(), "only");
        let p = provider_at(tmp.path());

        for hostile in ["../../evil", "a/b", r"a\b", "C:evil", ".hidden"] {
            let err = p.export_session(&session(hostile)).unwrap_err().to_string();
            assert!(
                err.contains("not usable as a filename"),
                "{hostile:?} was not rejected: {err}"
            );
        }
        assert!(!tmp.path().parent().unwrap().join("evil.json").exists());
    }

    #[test]
    fn no_workspace_at_all_names_the_directory_it_looked_in() {
        let tmp = tempfile::tempdir().unwrap();

        let err = provider_at(tmp.path())
            .export_session(&session("abc"))
            .unwrap_err()
            .to_string();

        assert!(
            err.contains(&tmp.path().display().to_string()),
            "unexpected: {err}"
        );
    }
}
