// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Cloud Sync Service Integration
//!
//! This module provides integration with cloud storage services for session backup
//! and cross-device synchronization.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

// =============================================================================
// Cloud Provider Types
// =============================================================================

/// Supported cloud storage providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloudProvider {
    /// Local file system (no cloud)
    Local,
    /// Amazon S3 compatible storage
    S3,
    /// Azure Blob Storage
    AzureBlob,
    /// Google Cloud Storage
    Gcs,
    /// Dropbox
    Dropbox,
    /// iCloud Drive
    ICloud,
    /// OneDrive
    OneDrive,
    /// Self-hosted WebDAV
    WebDav,
}

impl CloudProvider {
    /// Get display name
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Local => "Local Storage",
            Self::S3 => "Amazon S3",
            Self::AzureBlob => "Azure Blob Storage",
            Self::Gcs => "Google Cloud Storage",
            Self::Dropbox => "Dropbox",
            Self::ICloud => "iCloud Drive",
            Self::OneDrive => "OneDrive",
            Self::WebDav => "WebDAV",
        }
    }
}

// =============================================================================
// Cloud Sync Configuration
// =============================================================================

/// Cloud sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncConfig {
    /// Whether cloud sync is enabled
    pub enabled: bool,
    /// Cloud provider
    pub provider: CloudProvider,
    /// Provider-specific configuration
    pub provider_config: ProviderSpecificConfig,
    /// Sync frequency in seconds (0 = manual only)
    pub sync_frequency_seconds: u64,
    /// Whether to sync automatically on session save
    pub auto_sync: bool,
    /// Whether to encrypt data before uploading
    pub encrypt_before_upload: bool,
    /// Conflict resolution strategy
    pub conflict_resolution: ConflictResolution,
}

impl Default for CloudSyncConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: CloudProvider::Local,
            provider_config: ProviderSpecificConfig::Local(LocalConfig::default()),
            sync_frequency_seconds: 300, // 5 minutes
            auto_sync: true,
            encrypt_before_upload: true,
            conflict_resolution: ConflictResolution::LastWriteWins,
        }
    }
}

/// Conflict resolution strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    /// Last write wins (by timestamp)
    LastWriteWins,
    /// Local version wins
    LocalWins,
    /// Remote version wins
    RemoteWins,
    /// Keep both versions
    KeepBoth,
    /// Manual resolution required
    Manual,
}

/// Provider-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ProviderSpecificConfig {
    Local(LocalConfig),
    S3(S3Config),
    AzureBlob(AzureBlobConfig),
    Gcs(GcsConfig),
    Dropbox(DropboxConfig),
    ICloud(ICloudConfig),
    OneDrive(OneDriveConfig),
    WebDav(WebDavConfig),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LocalConfig {
    pub sync_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Config {
    pub bucket: String,
    pub region: String,
    pub prefix: Option<String>,
    pub access_key_id: Option<String>,
    pub secret_access_key: Option<String>,
    pub endpoint: Option<String>, // For S3-compatible services
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AzureBlobConfig {
    pub container: String,
    pub connection_string: Option<String>,
    pub account_name: Option<String>,
    pub account_key: Option<String>,
    pub prefix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcsConfig {
    pub bucket: String,
    pub project_id: String,
    pub prefix: Option<String>,
    pub credentials_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DropboxConfig {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub folder_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ICloudConfig {
    pub container_id: Option<String>,
    pub folder_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OneDriveConfig {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub folder_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebDavConfig {
    pub url: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub folder_path: Option<String>,
}

// =============================================================================
// Sync State Tracking
// =============================================================================

/// Sync state for a single session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSyncState {
    /// Session ID
    pub session_id: String,
    /// Local modification timestamp
    pub local_modified: i64,
    /// Remote modification timestamp (if known)
    pub remote_modified: Option<i64>,
    /// Local content hash
    pub local_hash: String,
    /// Remote content hash (if known)
    pub remote_hash: Option<String>,
    /// Sync status
    pub status: SyncStatus,
    /// Last sync attempt timestamp
    pub last_sync_attempt: Option<i64>,
    /// Last successful sync timestamp
    pub last_sync_success: Option<i64>,
    /// Error message from last failed sync
    pub last_error: Option<String>,
}

/// Sync status for a session
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    /// In sync with remote
    Synced,
    /// Local changes pending upload
    PendingUpload,
    /// Remote changes pending download
    PendingDownload,
    /// Conflict detected
    Conflict,
    /// Currently syncing
    Syncing,
    /// Sync error
    Error,
    /// Never synced
    NeverSynced,
}

/// Overall sync state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    /// Last full sync timestamp
    pub last_full_sync: Option<i64>,
    /// Per-session sync states
    pub sessions: Vec<SessionSyncState>,
    /// Pending operations count
    pub pending_uploads: u32,
    pub pending_downloads: u32,
    pub conflicts: u32,
}

impl SyncState {
    pub fn new() -> Self {
        Self {
            last_full_sync: None,
            sessions: Vec::new(),
            pending_uploads: 0,
            pending_downloads: 0,
            conflicts: 0,
        }
    }
}

impl Default for SyncState {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Cloud Sync Service
// =============================================================================

/// Cloud sync service trait
#[async_trait::async_trait]
pub trait CloudSyncService: Send + Sync {
    /// Get provider type
    fn provider(&self) -> CloudProvider;

    /// Test connection
    async fn test_connection(&self) -> Result<bool>;

    /// List remote sessions
    async fn list_remote_sessions(&self) -> Result<Vec<RemoteSessionInfo>>;

    /// Upload a session
    async fn upload_session(&self, session_id: &str, data: &[u8]) -> Result<UploadResult>;

    /// Download a session
    async fn download_session(&self, session_id: &str) -> Result<Vec<u8>>;

    /// Delete a remote session
    async fn delete_remote_session(&self, session_id: &str) -> Result<()>;

    /// Get remote session metadata
    async fn get_remote_metadata(&self, session_id: &str) -> Result<Option<RemoteSessionInfo>>;
}

/// Remote session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSessionInfo {
    pub session_id: String,
    pub modified_at: i64,
    pub size_bytes: u64,
    pub content_hash: String,
    pub metadata: Option<serde_json::Value>,
}

/// Upload result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResult {
    pub success: bool,
    pub remote_path: String,
    pub content_hash: String,
    pub uploaded_at: i64,
}

// =============================================================================
// Local Sync Implementation (File-based)
// =============================================================================

/// Local file-based sync (for network drives, etc.)
pub struct LocalSyncService {
    sync_dir: PathBuf,
}

impl LocalSyncService {
    pub fn new(sync_dir: PathBuf) -> Self {
        Self { sync_dir }
    }

    fn session_path(&self, session_id: &str) -> PathBuf {
        self.sync_dir.join(format!("{}.json", session_id))
    }
}

#[async_trait::async_trait]
impl CloudSyncService for LocalSyncService {
    fn provider(&self) -> CloudProvider {
        CloudProvider::Local
    }

    async fn test_connection(&self) -> Result<bool> {
        Ok(self.sync_dir.exists() || std::fs::create_dir_all(&self.sync_dir).is_ok())
    }

    async fn list_remote_sessions(&self) -> Result<Vec<RemoteSessionInfo>> {
        let mut sessions = Vec::new();

        if !self.sync_dir.exists() {
            return Ok(sessions);
        }

        for entry in std::fs::read_dir(&self.sync_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    let metadata = entry.metadata()?;
                    let modified = metadata
                        .modified()?
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;

                    // Simple hash based on size and modified time
                    let hash = format!("{}-{}", metadata.len(), modified);

                    sessions.push(RemoteSessionInfo {
                        session_id: stem.to_string(),
                        modified_at: modified,
                        size_bytes: metadata.len(),
                        content_hash: hash,
                        metadata: None,
                    });
                }
            }
        }

        Ok(sessions)
    }

    async fn upload_session(&self, session_id: &str, data: &[u8]) -> Result<UploadResult> {
        std::fs::create_dir_all(&self.sync_dir)?;

        let path = self.session_path(session_id);
        std::fs::write(&path, data)?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        // Simple hash
        let hash = format!("{}-{}", data.len(), now);

        Ok(UploadResult {
            success: true,
            remote_path: path.to_string_lossy().to_string(),
            content_hash: hash,
            uploaded_at: now,
        })
    }

    async fn download_session(&self, session_id: &str) -> Result<Vec<u8>> {
        let path = self.session_path(session_id);
        std::fs::read(&path).map_err(|e| anyhow!("Failed to read session: {}", e))
    }

    async fn delete_remote_session(&self, session_id: &str) -> Result<()> {
        let path = self.session_path(session_id);
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        Ok(())
    }

    async fn get_remote_metadata(&self, session_id: &str) -> Result<Option<RemoteSessionInfo>> {
        let path = self.session_path(session_id);

        if !path.exists() {
            return Ok(None);
        }

        let metadata = std::fs::metadata(&path)?;
        let modified = metadata
            .modified()?
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let hash = format!("{}-{}", metadata.len(), modified);

        Ok(Some(RemoteSessionInfo {
            session_id: session_id.to_string(),
            modified_at: modified,
            size_bytes: metadata.len(),
            content_hash: hash,
            metadata: None,
        }))
    }
}

// =============================================================================
// Sync Manager
// =============================================================================

/// Main sync manager that coordinates synchronization
pub struct SyncManager {
    config: CloudSyncConfig,
    state: SyncState,
    service: Option<Box<dyn CloudSyncService>>,
}

impl SyncManager {
    pub fn new(config: CloudSyncConfig) -> Self {
        Self {
            config,
            state: SyncState::new(),
            service: None,
        }
    }

    /// Initialize the sync service based on configuration
    pub fn initialize(&mut self) -> Result<()> {
        if !self.config.enabled {
            return Ok(());
        }

        match &self.config.provider_config {
            ProviderSpecificConfig::Local(local_config) => {
                let sync_dir = local_config
                    .sync_directory
                    .as_ref()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| {
                        dirs::data_local_dir()
                            .unwrap_or_else(|| PathBuf::from("."))
                            .join("csm")
                            .join("sync")
                    });
                self.service = Some(Box::new(LocalSyncService::new(sync_dir)));
            }
            _ => {
                return Err(anyhow!(
                    "Cloud provider {:?} not yet implemented",
                    self.config.provider
                ));
            }
        }

        Ok(())
    }

    /// Test connection to cloud service
    pub async fn test_connection(&self) -> Result<bool> {
        match &self.service {
            Some(service) => service.test_connection().await,
            None => Err(anyhow!("Sync service not initialized")),
        }
    }

    /// Get current sync state
    pub fn get_state(&self) -> &SyncState {
        &self.state
    }

    /// Reconcile tracked sessions against what the remote actually holds.
    ///
    /// # What this does, and what it does not
    ///
    /// It compares [`SyncState::sessions`] with `list_remote_sessions`, sets
    /// each session's [`SyncStatus`], and updates the pending counters. It
    /// **transfers nothing**: moving bytes needs the session content, which
    /// this type has no handle on -- call [`Self::upload_session`] and
    /// [`Self::download_session`] for the sessions this marks as pending.
    ///
    /// The returned `uploaded` and `downloaded` are therefore always zero. They
    /// are counts of transfers performed, and no transfer is performed here.
    ///
    /// # Why it is written this way
    ///
    /// The previous version listed the remote, discarded the answer, stamped
    /// `last_full_sync` with the current time, and returned a `SyncResult` of
    /// all zeroes and no errors -- an unblemished report of a sync that never
    /// happened. Anything trusting that timestamp to decide what still needed
    /// backing up would have concluded, wrongly, that everything was safe.
    ///
    /// So `last_full_sync` is now set only when reconciliation finds nothing
    /// outstanding, because that is the only circumstance in which "fully
    /// synced, as of now" is a true statement.
    pub async fn sync_all(&mut self) -> Result<SyncResult> {
        let service = self
            .service
            .as_ref()
            .ok_or_else(|| anyhow!("Sync service not initialized"))?;

        let remote = service.list_remote_sessions().await?;
        let remote_by_id: HashMap<&str, &RemoteSessionInfo> = remote
            .iter()
            .map(|info| (info.session_id.as_str(), info))
            .collect();

        let mut conflicts = 0u32;
        let mut pending_uploads = 0u32;
        let mut pending_downloads = 0u32;

        for local in &mut self.state.sessions {
            match remote_by_id.get(local.session_id.as_str()) {
                // Present on both sides. The hash we last saw for the remote
                // is the pivot: if it still matches, only the local side can
                // have moved; if it does not, the remote moved too, and a
                // local change on top of that is a genuine conflict.
                Some(info) => {
                    local.remote_modified = Some(info.modified_at);

                    let remote_unchanged = local.remote_hash.as_deref() == Some(&info.content_hash);
                    let local_unchanged = local.local_hash == info.content_hash;

                    local.status = match (remote_unchanged, local_unchanged) {
                        (_, true) => SyncStatus::Synced,
                        (true, false) => SyncStatus::PendingUpload,
                        // Both sides moved since we last looked, or we have
                        // never seen this remote copy at all. Either way the
                        // hashes cannot say whose version should win, so this
                        // refuses to pick rather than guessing and losing one.
                        (false, false) => SyncStatus::Conflict,
                    };

                    local.remote_hash = Some(info.content_hash.clone());
                }

                // Absent remotely. Either it was never uploaded, or someone
                // deleted it there. `remote_hash` distinguishes the two, and
                // only the first is safe to resolve by uploading.
                None => {
                    local.status = if local.remote_hash.is_some() {
                        SyncStatus::Conflict
                    } else {
                        SyncStatus::PendingUpload
                    };
                    local.remote_modified = None;
                }
            }

            match local.status {
                SyncStatus::PendingUpload => pending_uploads += 1,
                SyncStatus::PendingDownload => pending_downloads += 1,
                SyncStatus::Conflict => conflicts += 1,
                _ => {}
            }
        }

        // Remote sessions we have no local record of are downloads waiting to
        // happen. Tracking them here is what makes them visible to a caller.
        let known: HashSet<&str> = self
            .state
            .sessions
            .iter()
            .map(|s| s.session_id.as_str())
            .collect();
        let new_remote: Vec<_> = remote
            .iter()
            .filter(|info| !known.contains(info.session_id.as_str()))
            .cloned()
            .collect();

        for info in new_remote {
            pending_downloads += 1;
            self.state.sessions.push(SessionSyncState {
                session_id: info.session_id.clone(),
                local_modified: 0,
                remote_modified: Some(info.modified_at),
                local_hash: String::new(),
                remote_hash: Some(info.content_hash.clone()),
                status: SyncStatus::PendingDownload,
                last_sync_attempt: None,
                last_sync_success: None,
                last_error: None,
            });
        }

        self.state.pending_uploads = pending_uploads;
        self.state.pending_downloads = pending_downloads;
        self.state.conflicts = conflicts;

        if pending_uploads == 0 && pending_downloads == 0 && conflicts == 0 {
            self.state.last_full_sync = Some(
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
            );
        }

        Ok(SyncResult {
            uploaded: 0,
            downloaded: 0,
            conflicts,
            errors: Vec::new(),
        })
    }

    /// Upload a specific session
    pub async fn upload_session(&mut self, session_id: &str, data: &[u8]) -> Result<UploadResult> {
        let service = self
            .service
            .as_ref()
            .ok_or_else(|| anyhow!("Sync service not initialized"))?;

        service.upload_session(session_id, data).await
    }

    /// Download a specific session
    pub async fn download_session(&self, session_id: &str) -> Result<Vec<u8>> {
        let service = self
            .service
            .as_ref()
            .ok_or_else(|| anyhow!("Sync service not initialized"))?;

        service.download_session(session_id).await
    }
}

/// Result of a sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub conflicts: u32,
    pub errors: Vec<String>,
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_local_sync_service() {
        let temp_dir = tempdir().unwrap();
        let sync_dir = temp_dir.path().join("sync");

        let service = LocalSyncService::new(sync_dir.clone());

        // Test connection
        assert!(service.test_connection().await.unwrap());

        // Test upload
        let data = b"test session data";
        let result = service.upload_session("test-session", data).await.unwrap();
        assert!(result.success);

        // Test list
        let sessions = service.list_remote_sessions().await.unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, "test-session");

        // Test download
        let downloaded = service.download_session("test-session").await.unwrap();
        assert_eq!(downloaded, data);

        // Test delete
        service.delete_remote_session("test-session").await.unwrap();
        let sessions = service.list_remote_sessions().await.unwrap();
        assert!(sessions.is_empty());
    }

    // =========================================================================
    // Reconciliation
    // =========================================================================

    /// A manager wired to a real `LocalSyncService` over a temp directory.
    fn manager_at(sync_dir: PathBuf) -> SyncManager {
        let mut manager = SyncManager::new(CloudSyncConfig::default());
        manager.service = Some(Box::new(LocalSyncService::new(sync_dir)));
        manager
    }

    /// Whatever hash `LocalSyncService` would report for a file it holds.
    ///
    /// Derived rather than hard-coded: the scheme is `len-mtime`, and a test
    /// that reimplements it would keep passing if the real one changed.
    async fn remote_hash(manager: &SyncManager, id: &str) -> String {
        manager
            .service
            .as_ref()
            .unwrap()
            .get_remote_metadata(id)
            .await
            .unwrap()
            .expect("session should exist remotely")
            .content_hash
    }

    fn tracked(id: &str, local_hash: &str, remote_hash: Option<&str>) -> SessionSyncState {
        SessionSyncState {
            session_id: id.to_string(),
            local_modified: 0,
            remote_modified: None,
            local_hash: local_hash.to_string(),
            remote_hash: remote_hash.map(str::to_string),
            status: SyncStatus::NeverSynced,
            last_sync_attempt: None,
            last_sync_success: None,
            last_error: None,
        }
    }

    #[tokio::test]
    async fn a_sync_that_moved_nothing_does_not_claim_a_full_sync() {
        // The regression this guards: `sync_all` used to stamp
        // `last_full_sync` unconditionally and return a spotless result, so a
        // caller deciding what still needed backing up would conclude that
        // nothing did.
        let temp = tempdir().unwrap();
        let mut manager = manager_at(temp.path().join("sync"));
        manager
            .state
            .sessions
            .push(tracked("never-uploaded", "abc", None));

        let result = manager.sync_all().await.unwrap();

        assert_eq!(manager.state.pending_uploads, 1);
        assert!(
            manager.state.last_full_sync.is_none(),
            "a sync with work outstanding must not record itself as complete"
        );
        assert_eq!(result.uploaded, 0, "nothing was transferred");
    }

    #[tokio::test]
    async fn a_genuinely_settled_state_does_record_a_full_sync() {
        let temp = tempdir().unwrap();
        let dir = temp.path().join("sync");
        let mut manager = manager_at(dir);

        manager
            .service
            .as_ref()
            .unwrap()
            .upload_session("s1", b"contents")
            .await
            .unwrap();
        let hash = remote_hash(&manager, "s1").await;
        manager
            .state
            .sessions
            .push(tracked("s1", &hash, Some(&hash)));

        manager.sync_all().await.unwrap();

        assert_eq!(manager.state.sessions[0].status, SyncStatus::Synced);
        assert_eq!(manager.state.pending_uploads, 0);
        assert!(manager.state.last_full_sync.is_some());
    }

    #[tokio::test]
    async fn a_remote_only_session_becomes_a_pending_download() {
        let temp = tempdir().unwrap();
        let mut manager = manager_at(temp.path().join("sync"));
        manager
            .service
            .as_ref()
            .unwrap()
            .upload_session("theirs", b"data")
            .await
            .unwrap();

        manager.sync_all().await.unwrap();

        assert_eq!(manager.state.pending_downloads, 1);
        assert_eq!(manager.state.sessions.len(), 1);
        assert_eq!(manager.state.sessions[0].session_id, "theirs");
        assert_eq!(
            manager.state.sessions[0].status,
            SyncStatus::PendingDownload
        );
        assert!(manager.state.last_full_sync.is_none());
    }

    #[tokio::test]
    async fn a_locally_edited_session_is_an_upload_not_a_conflict() {
        let temp = tempdir().unwrap();
        let mut manager = manager_at(temp.path().join("sync"));
        manager
            .service
            .as_ref()
            .unwrap()
            .upload_session("s1", b"data")
            .await
            .unwrap();
        let hash = remote_hash(&manager, "s1").await;

        // Remote is where we left it; only our copy moved on.
        manager
            .state
            .sessions
            .push(tracked("s1", "locally-changed", Some(&hash)));

        manager.sync_all().await.unwrap();

        assert_eq!(manager.state.sessions[0].status, SyncStatus::PendingUpload);
        assert_eq!(manager.state.conflicts, 0);
    }

    #[tokio::test]
    async fn both_sides_moving_is_a_conflict_rather_than_a_guess() {
        let temp = tempdir().unwrap();
        let mut manager = manager_at(temp.path().join("sync"));
        manager
            .service
            .as_ref()
            .unwrap()
            .upload_session("s1", b"their new data")
            .await
            .unwrap();

        // We last saw a different remote hash, and our copy differs too.
        manager
            .state
            .sessions
            .push(tracked("s1", "our-version", Some("a-stale-remote-hash")));

        let result = manager.sync_all().await.unwrap();

        assert_eq!(manager.state.sessions[0].status, SyncStatus::Conflict);
        assert_eq!(result.conflicts, 1);
        assert!(manager.state.last_full_sync.is_none());
    }

    #[tokio::test]
    async fn a_session_deleted_remotely_is_a_conflict_not_a_re_upload() {
        // We have uploaded this before -- `remote_hash` is set -- and now it is
        // gone from the remote. Silently re-uploading would undo a deliberate
        // deletion made from another machine.
        let temp = tempdir().unwrap();
        let mut manager = manager_at(temp.path().join("sync"));
        manager
            .state
            .sessions
            .push(tracked("was-there", "abc", Some("abc")));

        manager.sync_all().await.unwrap();

        assert_eq!(manager.state.sessions[0].status, SyncStatus::Conflict);
        assert_eq!(manager.state.pending_uploads, 0);
    }

    #[tokio::test]
    async fn reconciling_without_a_service_is_an_error() {
        let mut manager = SyncManager::new(CloudSyncConfig::default());
        assert!(manager.sync_all().await.is_err());
    }
}
