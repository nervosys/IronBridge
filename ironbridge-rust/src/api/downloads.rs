// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Artifact downloads (`/api/downloads`)
//!
//! Fetches one file from a Hugging Face repository onto this machine, in the
//! background, with progress a client can poll.
//!
//! # Why this is not a single blocking request
//!
//! The files are large -- a model weight is routinely several gigabytes. A
//! handler that downloaded one before answering would hold the request open
//! for tens of minutes and time out every client in front of it, and the user
//! would have no idea how far along it was. So a POST records a job and
//! returns immediately, and the job reports `downloadedBytes` against
//! `totalBytes` as it goes.
//!
//! # Where files land
//!
//! `IRONBRIDGE_DOWNLOAD_DIR` if set, otherwise a `downloads` directory beside the
//! database this server opened. Under that, `<kind>/<repo id>/<path>`, so two
//! repositories with a file of the same name cannot overwrite each other.
//!
//! # Refusing rather than filling the disk
//!
//! The size is read from the Hub's file listing before anything is fetched,
//! and the job is refused if it would not fit with [`FREE_SPACE_RESERVE`] to
//! spare, or if it exceeds `IRONBRIDGE_MAX_DOWNLOAD_BYTES`. A download that fills
//! the volume it is running on takes the database with it.
//!
//! # The path is not the caller's to choose
//!
//! Two independent checks, because this is the part that would be worth
//! attacking:
//!
//! 1. The requested path must appear in that repository's own file listing.
//!    A caller cannot name a file the repository does not have.
//! 2. It is then re-checked with [`safe_relative_path`], which rejects
//!    absolute paths, drive letters, UNC prefixes and any `..` segment.
//!
//! Either alone would probably do. Both are cheap, and the failure mode --
//! writing anywhere on the disk the server can reach -- is bad enough to
//! justify not relying on the Hub to never serve a hostile path.

use actix_web::{web, HttpResponse};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use super::catalog::{fetch_repo_files, Kind, HUB, TOKEN_ENV};
use super::state::AppState;
use std::collections::HashMap;

type State = web::Data<AppState>;

/// Free space to leave behind after a download, in bytes.
///
/// Not zero: filling the volume would take out the SQLite database this
/// server is writing to, which is a far worse outcome than a refused
/// download.
const FREE_SPACE_RESERVE: u64 = 2 * 1024 * 1024 * 1024;

/// Ceiling on a single file, overridable with `IRONBRIDGE_MAX_DOWNLOAD_BYTES`.
const DEFAULT_MAX_BYTES: u64 = 20 * 1024 * 1024 * 1024;

/// How often the running task writes its progress back.
///
/// Every chunk would be a database write per few kilobytes of network, which
/// costs more than the progress is worth.
const PROGRESS_INTERVAL_BYTES: u64 = 4 * 1024 * 1024;

// =============================================================================
// Cancellation
// =============================================================================

/// Live jobs, so `DELETE` can stop one that is still running.
///
/// Process-local by design: a job does not survive a restart, and one marked
/// `running` in the database after a restart is stale rather than live. That
/// is reconciled on read -- see [`reconcile_stale_jobs`].
fn cancellations() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static REGISTRY: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

// =============================================================================
// Schema
// =============================================================================

fn init_download_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            repo_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            dest_path TEXT NOT NULL,
            total_bytes INTEGER NOT NULL,
            downloaded_bytes INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            error TEXT,
            started_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            completed_at INTEGER
        )",
        [],
    )?;
    Ok(())
}

/// Mark jobs that were running when the process died.
///
/// Their task is gone and nothing will ever advance them, so leaving them
/// `running` would show a progress bar that never moves -- indistinguishable
/// from a slow download, which is exactly the kind of frozen-but-plausible
/// state this codebase was audited for.
fn reconcile_stale_jobs(conn: &Connection) -> rusqlite::Result<()> {
    let live: Vec<String> = cancellations().lock().unwrap().keys().cloned().collect();

    let mut stmt = conn.prepare("SELECT id FROM downloads WHERE status = 'running'")?;
    let running = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    for id in running {
        if !live.contains(&id) {
            conn.execute(
                "UPDATE downloads SET status = 'failed', error = ?2, updated_at = ?3 WHERE id = ?1",
                params![
                    id,
                    "The server stopped while this download was running.",
                    now_ms()
                ],
            )?;
        }
    }
    Ok(())
}

// =============================================================================
// Wire types
// =============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDownloadRequest {
    /// `models` or `datasets`.
    pub kind: String,
    /// `author/name`, or a bare name for the canonical repositories.
    pub repo_id: String,
    /// Path within the repository, as the file listing reports it.
    pub file_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadJob {
    pub id: String,
    pub kind: String,
    pub repo_id: String,
    pub file_path: String,
    /// Absolute path on this machine. Shown so a user can find the file.
    pub dest_path: String,
    pub total_bytes: i64,
    pub downloaded_bytes: i64,
    /// `running`, `completed`, `failed` or `cancelled`.
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub started_at: i64,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<i64>,
}

// =============================================================================
// Helpers
// =============================================================================

fn ok<T: Serialize>(payload: T) -> HttpResponse {
    HttpResponse::Ok().json(json!({ "success": true, "data": payload, "error": null }))
}

fn fail(status: actix_web::http::StatusCode, message: impl Into<String>) -> HttpResponse {
    HttpResponse::build(status).json(json!({
        "success": false,
        "data": null,
        "error": message.into(),
    }))
}

fn db_error(e: rusqlite::Error) -> HttpResponse {
    fail(
        actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
        format!("Database error: {e}"),
    )
}

fn bad_request(message: impl Into<String>) -> HttpResponse {
    fail(actix_web::http::StatusCode::BAD_REQUEST, message)
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Reduce a repository-relative path to something safe to join onto a root.
///
/// Returns `None` for anything that could escape: an absolute path, a Windows
/// drive letter or UNC prefix, a `..` segment, or an empty result.
///
/// `Component` is used rather than string matching because the string forms
/// are endless -- `..`, `..\\`, `a/../..`, `C:`, `\\\\server\\share` -- and the
/// parser already classifies every one of them correctly.
pub(crate) fn safe_relative_path(raw: &str) -> Option<PathBuf> {
    if raw.trim().is_empty() {
        return None;
    }

    let mut out = PathBuf::new();
    for component in Path::new(raw).components() {
        match component {
            Component::Normal(part) => {
                // A component that is only dots is not a name anyone means.
                let text = part.to_str()?;
                if text.chars().all(|c| c == '.') {
                    return None;
                }
                out.push(part);
            }
            // Every one of these leaves, or could leave, the root.
            Component::ParentDir
            | Component::RootDir
            | Component::Prefix(_)
            | Component::CurDir => return None,
        }
    }

    if out.as_os_str().is_empty() {
        None
    } else {
        Some(out)
    }
}

/// Where downloads are written.
fn download_root(db_path: &Path) -> PathBuf {
    if let Ok(dir) = std::env::var("IRONBRIDGE_DOWNLOAD_DIR") {
        if !dir.trim().is_empty() {
            return PathBuf::from(dir.trim());
        }
    }
    db_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("downloads")
}

fn max_download_bytes() -> u64 {
    std::env::var("IRONBRIDGE_MAX_DOWNLOAD_BYTES")
        .ok()
        .and_then(|v| v.trim().parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(DEFAULT_MAX_BYTES)
}

/// Free bytes on the volume holding `path`.
///
/// `None` when it cannot be determined, which is treated as "do not know"
/// rather than "plenty": the caller refuses instead of guessing.
fn free_space_for(path: &Path) -> Option<u64> {
    let disks = sysinfo::Disks::new_with_refreshed_list();

    // The longest matching mount point wins: on Windows `C:\` and
    // `C:\mnt\data` can both be disks, and the nested one is the real answer.
    disks
        .list()
        .iter()
        .filter(|d| path.starts_with(d.mount_point()))
        .max_by_key(|d| d.mount_point().as_os_str().len())
        .map(|d| d.available_space())
}

fn read_job(conn: &Connection, id: &str) -> rusqlite::Result<Option<DownloadJob>> {
    conn.query_row(
        "SELECT id, kind, repo_id, file_path, dest_path, total_bytes,
                downloaded_bytes, status, error, started_at, updated_at, completed_at
         FROM downloads WHERE id = ?1",
        params![id],
        |row| {
            Ok(DownloadJob {
                id: row.get(0)?,
                kind: row.get(1)?,
                repo_id: row.get(2)?,
                file_path: row.get(3)?,
                dest_path: row.get(4)?,
                total_bytes: row.get(5)?,
                downloaded_bytes: row.get(6)?,
                status: row.get(7)?,
                error: row.get(8)?,
                started_at: row.get(9)?,
                updated_at: row.get(10)?,
                completed_at: row.get(11)?,
            })
        },
    )
    .optional()
}

// =============================================================================
// The running download
// =============================================================================

/// Stream the file to disk, updating progress as it goes.
///
/// Written to `<dest>.part` and renamed on success, so a file that is present
/// at its final name is complete. A partial file under the real name would
/// look finished to anything that later reads the directory.
async fn run_download(
    db_path: PathBuf,
    id: String,
    url: String,
    dest: PathBuf,
    cancel: Arc<AtomicBool>,
) {
    let outcome = download_to_disk(&id, &url, &dest, &cancel).await;

    cancellations().lock().unwrap().remove(&id);

    // Its own connection: the task outlives the request that started it, so it
    // cannot hold the handler's guard. The inbox recorder does the same.
    let Ok(conn) = Connection::open(&db_path) else {
        eprintln!("[WARN] downloads: could not record the outcome of {id}");
        return;
    };
    let now = now_ms();
    let result = match outcome {
        Ok(bytes) => conn.execute(
            "UPDATE downloads SET status='completed', downloaded_bytes=?2,
                    updated_at=?3, completed_at=?3, error=NULL WHERE id=?1",
            params![id, bytes as i64, now],
        ),
        Err(DownloadError::Cancelled) => {
            let _ = std::fs::remove_file(dest.with_extension("part"));
            conn.execute(
                "UPDATE downloads SET status='cancelled', updated_at=?2, completed_at=?2
                 WHERE id=?1",
                params![id, now],
            )
        }
        Err(DownloadError::Failed(message)) => {
            let _ = std::fs::remove_file(dest.with_extension("part"));
            conn.execute(
                "UPDATE downloads SET status='failed', error=?2, updated_at=?3, completed_at=?3
                 WHERE id=?1",
                params![id, message, now],
            )
        }
    };
    if let Err(e) = result {
        eprintln!("[WARN] downloads: could not record the outcome of {id}: {e}");
    }
}

enum DownloadError {
    Cancelled,
    Failed(String),
}

async fn download_to_disk(
    id: &str,
    url: &str,
    dest: &Path,
    cancel: &AtomicBool,
) -> Result<u64, DownloadError> {
    use std::io::Write;

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| DownloadError::Failed(format!("Could not create {parent:?}: {e}")))?;
    }

    let client = reqwest::Client::builder()
        // No overall timeout: a large file legitimately takes a long time. The
        // connect timeout still bounds a server that never answers, and
        // cancellation covers the rest.
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| DownloadError::Failed(format!("HTTP client error: {e}")))?;

    let mut request = client.get(url);
    if let Ok(token) = std::env::var(TOKEN_ENV) {
        if !token.trim().is_empty() {
            request = request.bearer_auth(token.trim());
        }
    }

    let mut response = request
        .send()
        .await
        .map_err(|e| DownloadError::Failed(format!("Could not reach the Hub: {e}")))?;

    if !response.status().is_success() {
        return Err(DownloadError::Failed(format!(
            "The Hub returned {} for this file. Gated repositories need {TOKEN_ENV} set \
             on the server, and the terms accepted on the Hub first.",
            response.status()
        )));
    }

    let part = dest.with_extension("part");
    let mut file = std::fs::File::create(&part)
        .map_err(|e| DownloadError::Failed(format!("Could not open {part:?}: {e}")))?;

    let mut written: u64 = 0;
    let mut since_report: u64 = 0;

    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err(DownloadError::Cancelled);
        }
        let chunk = match response.chunk().await {
            Ok(Some(c)) => c,
            Ok(None) => break,
            Err(e) => return Err(DownloadError::Failed(format!("Transfer failed: {e}"))),
        };
        file.write_all(&chunk)
            .map_err(|e| DownloadError::Failed(format!("Write failed: {e}")))?;
        written += chunk.len() as u64;
        since_report += chunk.len() as u64;

        if since_report >= PROGRESS_INTERVAL_BYTES {
            since_report = 0;
            report_progress(id, written);
        }
    }

    file.flush()
        .map_err(|e| DownloadError::Failed(format!("Flush failed: {e}")))?;
    drop(file);

    std::fs::rename(&part, dest)
        .map_err(|e| DownloadError::Failed(format!("Could not finalise {dest:?}: {e}")))?;

    Ok(written)
}

/// Best-effort progress write.
///
/// A failure here is not worth aborting a download for -- the bytes are still
/// arriving -- so it is logged and the transfer continues.
fn report_progress(id: &str, written: u64) {
    let Some(path) = PROGRESS_DB.get() else {
        return;
    };
    if let Ok(conn) = Connection::open(path) {
        let _ = conn.execute(
            "UPDATE downloads SET downloaded_bytes = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, written as i64, now_ms()],
        );
    }
}

/// Tell [`report_progress`] which database to write to.
///
/// Set once, from the first request that starts a download. It cannot be
/// passed down instead: progress is written from deep inside the transfer
/// loop, and threading a path through every chunk would obscure the loop for
/// no gain.
fn remember_db_path(path: &Path) {
    PROGRESS_DB.get_or_init(|| path.to_path_buf());
}

static PROGRESS_DB: OnceLock<PathBuf> = OnceLock::new();

// =============================================================================
// Handlers
// =============================================================================

/// Start a download.
///
/// Everything that can be checked is checked before a job appears: the
/// repository is real, the file is in it, its size fits the cap and the disk.
/// A job that is going to fail immediately is better refused, because a failed
/// row still has to be explained to whoever reads the list.
pub async fn start_download(state: State, body: web::Json<StartDownloadRequest>) -> HttpResponse {
    let body = body.into_inner();

    let Some(kind) = Kind::parse(body.kind.trim()) else {
        return bad_request("kind is required and must be `models` or `datasets`");
    };
    let repo_id = body.repo_id.trim().to_string();
    let file_path = body.file_path.trim().to_string();

    // Check 1: the path must be one this repository actually publishes.
    let files = match fetch_repo_files(kind, &repo_id).await {
        Ok(f) => f,
        Err(message) if message.contains("not a repository id") => return bad_request(message),
        Err(message) => return fail(actix_web::http::StatusCode::BAD_GATEWAY, message),
    };
    let Some(entry) = files.iter().find(|f| f.path == file_path) else {
        return bad_request(format!(
            "`{file_path}` is not a file in {} `{repo_id}`.",
            kind.noun()
        ));
    };

    // Check 2: and it must still be safe to join onto a directory.
    let Some(relative) = safe_relative_path(&file_path) else {
        return bad_request(format!("`{file_path}` is not a usable file path."));
    };

    let size = entry.size.max(0) as u64;
    let cap = max_download_bytes();
    if size > cap {
        return bad_request(format!(
            "That file is {size} bytes, over the {cap}-byte limit. Raise \
             IRONBRIDGE_MAX_DOWNLOAD_BYTES on the server to allow it."
        ));
    }

    let root = download_root(&state.db_path);
    let Some(repo_dir) = safe_relative_path(&repo_id) else {
        return bad_request(format!("`{repo_id}` is not a usable repository id."));
    };
    let dest = root.join(kind.noun()).join(repo_dir).join(&relative);

    if dest.exists() {
        return bad_request(format!(
            "{} already exists. Delete it first to download again.",
            dest.display()
        ));
    }

    // Created up front so the free-space check reads the right volume: an
    // unborn directory belongs to no disk sysinfo knows about.
    if let Some(parent) = dest.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return fail(
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("Could not create {}: {e}", parent.display()),
            );
        }
    }

    match free_space_for(&dest) {
        Some(free) if free < size.saturating_add(FREE_SPACE_RESERVE) => {
            return bad_request(format!(
                "That file is {size} bytes and only {free} are free. IronBridge keeps \
                 {FREE_SPACE_RESERVE} bytes in reserve so a download cannot fill the \
                 volume its database is on."
            ));
        }
        // Unknown is refused rather than assumed roomy: guessing here is how a
        // download fills the disk the database lives on.
        None => {
            return fail(
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!(
                    "Could not determine free space on the volume holding {}.",
                    dest.display()
                ),
            );
        }
        Some(_) => {}
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();

    {
        let db = state.db.lock().unwrap();
        if let Err(e) = init_download_tables(&db.conn) {
            return db_error(e);
        }
        if let Err(e) = db.conn.execute(
            "INSERT INTO downloads
             (id, kind, repo_id, file_path, dest_path, total_bytes, downloaded_bytes,
              status, started_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 'running', ?7, ?7)",
            params![
                id,
                kind.noun(),
                repo_id,
                file_path,
                dest.to_string_lossy(),
                size as i64,
                now,
            ],
        ) {
            return db_error(e);
        }
    }

    remember_db_path(&state.db_path);

    let cancel = Arc::new(AtomicBool::new(false));
    cancellations()
        .lock()
        .unwrap()
        .insert(id.clone(), cancel.clone());

    // Path built here, not taken from the caller: `resolve/main` on the fixed
    // Hub host, with the repository and file already validated above.
    let url = format!(
        "{HUB}/{}{repo_id}/resolve/main/{file_path}",
        match kind {
            Kind::Models => "",
            Kind::Datasets => "datasets/",
        }
    );

    let db_path = state.db_path.clone();
    let job_id = id.clone();
    let dest_for_task = dest.clone();
    actix_web::rt::spawn(async move {
        run_download(db_path, job_id, url, dest_for_task, cancel).await;
    });

    ok(DownloadJob {
        id,
        kind: kind.noun().to_string(),
        repo_id,
        file_path,
        dest_path: dest.to_string_lossy().to_string(),
        total_bytes: size as i64,
        downloaded_bytes: 0,
        status: "running".to_string(),
        error: None,
        started_at: now,
        updated_at: now,
        completed_at: None,
    })
}

pub async fn list_downloads(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    if let Err(e) = init_download_tables(&db.conn) {
        return db_error(e);
    }
    if let Err(e) = reconcile_stale_jobs(&db.conn) {
        return db_error(e);
    }

    let result: rusqlite::Result<Vec<DownloadJob>> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT id, kind, repo_id, file_path, dest_path, total_bytes,
                    downloaded_bytes, status, error, started_at, updated_at, completed_at
             FROM downloads ORDER BY started_at DESC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DownloadJob {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    repo_id: row.get(2)?,
                    file_path: row.get(3)?,
                    dest_path: row.get(4)?,
                    total_bytes: row.get(5)?,
                    downloaded_bytes: row.get(6)?,
                    status: row.get(7)?,
                    error: row.get(8)?,
                    started_at: row.get(9)?,
                    updated_at: row.get(10)?,
                    completed_at: row.get(11)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })();

    match result {
        Ok(jobs) => ok(jobs),
        Err(e) => db_error(e),
    }
}

pub async fn get_download(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();
    if let Err(e) = init_download_tables(&db.conn) {
        return db_error(e);
    }
    if let Err(e) = reconcile_stale_jobs(&db.conn) {
        return db_error(e);
    }
    match read_job(&db.conn, &id) {
        Ok(Some(job)) => ok(job),
        Ok(None) => fail(
            actix_web::http::StatusCode::NOT_FOUND,
            "No download with that id",
        ),
        Err(e) => db_error(e),
    }
}

/// Cancel a running download, or forget a finished one.
///
/// The downloaded file is left alone. Someone deleting a job record is asking
/// to stop tracking it, not asking to lose a file that finished an hour ago --
/// and this endpoint deleting things off the disk would be a much bigger
/// promise than its name makes.
pub async fn cancel_download(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();

    let db = state.db.lock().unwrap();
    if let Err(e) = init_download_tables(&db.conn) {
        return db_error(e);
    }

    let job = match read_job(&db.conn, &id) {
        Ok(Some(j)) => j,
        Ok(None) => {
            return fail(
                actix_web::http::StatusCode::NOT_FOUND,
                "No download with that id",
            )
        }
        Err(e) => return db_error(e),
    };

    if job.status == "running" {
        // The task notices the flag between chunks and records the outcome
        // itself, so the status is not written here -- two writers would race
        // and the loser would overwrite the truth.
        if let Some(flag) = cancellations().lock().unwrap().get(&id) {
            flag.store(true, Ordering::Relaxed);
            return ok(json!({ "cancelling": true }));
        }
        // Running in the database with no live task: the process restarted.
        if let Err(e) = db.conn.execute(
            "UPDATE downloads SET status='failed', error=?2, updated_at=?3 WHERE id=?1",
            params![
                id,
                "The server stopped while this download was running.",
                now_ms()
            ],
        ) {
            return db_error(e);
        }
        return ok(json!({ "cancelling": false, "reconciled": true }));
    }

    match db
        .conn
        .execute("DELETE FROM downloads WHERE id = ?1", params![id])
    {
        Ok(0) => fail(
            actix_web::http::StatusCode::NOT_FOUND,
            "No download with that id",
        ),
        Ok(_) => ok(json!({ "deleted": true })),
        Err(e) => db_error(e),
    }
}

pub fn configure_download_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/downloads")
            .route("", web::get().to(list_downloads))
            .route("", web::post().to(start_download))
            .route("/{id}", web::get().to(get_download))
            .route("/{id}", web::delete().to(cancel_download)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};

    fn temp_state(tag: &str) -> (web::Data<AppState>, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path: PathBuf = dir.path().join(format!("{tag}.db"));
        crate::commands::create_harvest_database(&path).expect("harvest schema");
        let db = ChatDatabase::open(&path).expect("open");
        (web::Data::new(AppState::new(db, path)), dir)
    }

    macro_rules! app {
        ($state:expr) => {
            test::init_service(
                App::new()
                    .app_data($state.clone())
                    .configure(configure_download_routes),
            )
            .await
        };
    }

    async fn body_json(resp: actix_web::dev::ServiceResponse) -> serde_json::Value {
        serde_json::from_slice(&test::read_body(resp).await).expect("json body")
    }

    /// Paths that escape the root on every platform this builds for.
    ///
    /// Everything rejected here is a way to write outside the download root.
    /// A miss lets a repository -- or anyone who can name a path -- put a file
    /// anywhere this process can write.
    ///
    /// Windows-shaped paths are *not* in this list. See the two tests below:
    /// whether `C:\Windows` is a path or a filename is a question only the
    /// platform can answer, and it answers differently.
    #[test]
    fn no_path_that_could_escape_the_root_is_accepted() {
        for bad in [
            "",
            "   ",
            "..",
            "../secrets",
            "../../etc/passwd",
            "a/../../b",
            "/absolute/path",
            ".",
            "./",
            "a/./../..",
            "...",
        ] {
            assert!(
                safe_relative_path(bad).is_none(),
                "accepted an escaping path: {bad:?}"
            );
        }
    }

    /// Strings that are absolute or UNC paths *on Windows*.
    ///
    /// `std::path` parses per platform. Here a drive letter is a `Prefix` and
    /// a backslash is a separator, so each of these is genuinely absolute and
    /// the guard must refuse it.
    #[cfg(windows)]
    #[test]
    fn windows_absolute_and_unc_paths_are_rejected() {
        for bad in [
            "\\windows\\absolute",
            "C:\\Windows\\System32\\drivers\\etc\\hosts",
            "C:/Windows/System32",
            "\\\\server\\share\\file",
        ] {
            assert!(
                safe_relative_path(bad).is_none(),
                "accepted an absolute Windows path: {bad:?}"
            );
        }
    }

    /// The same strings on Unix, where they are filenames, not paths.
    ///
    /// `\` is an ordinary character in a Unix filename and there are no path
    /// prefixes, so `C:\Windows\System32` names one file in the current
    /// directory. Accepting it is correct, and this test asserts the thing
    /// that actually matters: the join still lands under the root.
    ///
    /// This is why the list above no longer holds them. Asserting rejection
    /// unconditionally would have failed on Linux and macOS while proving
    /// nothing about safety on either.
    #[cfg(unix)]
    #[test]
    fn a_windows_shaped_path_is_an_ordinary_filename_on_unix() {
        let root = Path::new("/downloads/models/org/repo");
        for raw in [
            "\\windows\\absolute",
            "C:\\Windows\\System32\\drivers\\etc\\hosts",
            "\\\\server\\share\\file",
        ] {
            let safe = safe_relative_path(raw)
                .unwrap_or_else(|| panic!("{raw:?} is a legal Unix filename"));
            let joined = root.join(&safe);
            assert!(
                joined.starts_with(root),
                "{raw:?} escaped the root as {}",
                joined.display()
            );
        }

        // `C:/Windows/System32` splits on `/` here, into three ordinary
        // components. Still under the root.
        let joined = root.join(safe_relative_path("C:/Windows/System32").expect("relative"));
        assert!(joined.starts_with(root));
    }

    /// Ordinary repository paths, including nested ones, survive intact.
    #[test]
    fn ordinary_repository_paths_are_kept() {
        for (raw, expected) in [
            ("config.json", "config.json"),
            ("onnx/model.onnx", "onnx/model.onnx"),
            ("a/b/c/weights.safetensors", "a/b/c/weights.safetensors"),
            ("model-00001-of-00002.bin", "model-00001-of-00002.bin"),
        ] {
            let got = safe_relative_path(raw).unwrap_or_else(|| panic!("rejected {raw}"));
            let normalised = got.to_string_lossy().replace('\\', "/");
            assert_eq!(normalised, expected);
        }
    }

    /// A joined path stays under the root it was joined to.
    ///
    /// The property the whole guard exists for, asserted directly rather than
    /// inferred from the rejection list above.
    #[test]
    fn a_safe_path_always_stays_under_its_root() {
        let root = Path::new("/downloads/models/org/repo");

        // Ordinary paths, plus the platform-shaped ones. Whatever the platform
        // decides those are -- a rejected absolute path or an accepted
        // filename -- anything that comes back must land under the root. That
        // is the guarantee, and unlike the rejection lists it is the same
        // sentence on every platform.
        for raw in [
            "a.bin",
            "sub/dir/b.bin",
            "deep/deeper/deepest/c.safetensors",
            "\\windows\\absolute",
            "C:\\Windows\\System32",
            "C:/Windows/System32",
            "\\\\server\\share\\file",
        ] {
            let Some(safe) = safe_relative_path(raw) else {
                continue; // Refused outright, which is also safe.
            };
            let joined = root.join(&safe);
            assert!(
                joined.starts_with(root),
                "{raw} escaped: {}",
                joined.display()
            );
        }
    }

    #[tokio::test]
    async fn listing_works_before_anything_is_downloaded() {
        let (state, _dir) = temp_state("dl-empty");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/downloads").to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);
        assert_eq!(
            body_json(resp).await["data"].as_array().map(|a| a.len()),
            Some(0)
        );
    }

    #[tokio::test]
    async fn an_unknown_kind_is_rejected_before_the_hub_is_touched() {
        let (state, _dir) = temp_state("dl-kind");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/downloads")
                .set_json(json!({
                    "kind": "spaces",
                    "repoId": "openai-community/gpt2",
                    "filePath": "config.json",
                }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 400);
    }

    /// A repository id that could walk out of the namespace is refused here,
    /// before it reaches a URL.
    #[tokio::test]
    async fn a_traversing_repo_id_is_rejected() {
        let (state, _dir) = temp_state("dl-repo");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/downloads")
                .set_json(json!({
                    "kind": "models",
                    "repoId": "../../etc",
                    "filePath": "passwd",
                }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 400);
    }

    #[tokio::test]
    async fn an_unknown_job_is_a_404() {
        let (state, _dir) = temp_state("dl-404");
        let app = app!(&state);
        for req in [
            test::TestRequest::get()
                .uri("/api/downloads/nope")
                .to_request(),
            test::TestRequest::delete()
                .uri("/api/downloads/nope")
                .to_request(),
        ] {
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 404);
        }
    }

    /// A job left `running` by a dead process is reported as failed.
    ///
    /// Otherwise it renders as a progress bar that never moves, which is
    /// indistinguishable from a slow download and is the frozen-but-plausible
    /// state this codebase keeps being audited for.
    #[tokio::test]
    async fn a_job_orphaned_by_a_restart_is_reported_as_failed() {
        let (state, _dir) = temp_state("dl-stale");
        {
            let db = state.db.lock().unwrap();
            init_download_tables(&db.conn).expect("tables");
            db.conn
                .execute(
                    "INSERT INTO downloads
                     (id, kind, repo_id, file_path, dest_path, total_bytes,
                      downloaded_bytes, status, started_at, updated_at)
                     VALUES ('ghost','models','a/b','f.bin','/tmp/f.bin',100,40,'running',1,1)",
                    [],
                )
                .expect("insert");
        }

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/downloads/ghost")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let body = body_json(resp).await;
        assert_eq!(body["data"]["status"], "failed");
        assert!(
            body["data"]["error"]
                .as_str()
                .unwrap_or_default()
                .contains("server stopped"),
            "{body}"
        );
        // The progress it had reached is preserved rather than zeroed.
        assert_eq!(body["data"]["downloadedBytes"], 40);
    }

    /// Deleting a finished job forgets the record and leaves the file.
    #[tokio::test]
    async fn deleting_a_finished_job_removes_only_the_record() {
        let (state, dir) = temp_state("dl-del");
        let artifact = dir.path().join("kept.bin");
        std::fs::write(&artifact, b"payload").expect("write");

        {
            let db = state.db.lock().unwrap();
            init_download_tables(&db.conn).expect("tables");
            db.conn
                .execute(
                    "INSERT INTO downloads
                     (id, kind, repo_id, file_path, dest_path, total_bytes,
                      downloaded_bytes, status, started_at, updated_at, completed_at)
                     VALUES ('done','models','a/b','kept.bin',?1,7,7,'completed',1,1,1)",
                    params![artifact.to_string_lossy()],
                )
                .expect("insert");
        }

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri("/api/downloads/done")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        assert!(artifact.exists(), "deleting the record deleted the file");

        let db = state.db.lock().unwrap();
        let left: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM downloads", [], |r| r.get(0))
            .expect("count");
        assert_eq!(left, 0);
    }

    /// The default root sits beside the database, not in the process's cwd.
    #[test]
    fn the_download_root_defaults_beside_the_database() {
        std::env::remove_var("IRONBRIDGE_DOWNLOAD_DIR");
        let root = download_root(Path::new("/var/lib/ironbridge/ironbridge.db"));
        assert!(root.ends_with("downloads"), "{}", root.display());
        assert!(
            root.starts_with("/var/lib/ironbridge"),
            "{}",
            root.display()
        );
    }

    #[test]
    fn the_size_cap_falls_back_to_the_default() {
        std::env::remove_var("IRONBRIDGE_MAX_DOWNLOAD_BYTES");
        assert_eq!(max_download_bytes(), DEFAULT_MAX_BYTES);

        std::env::set_var("IRONBRIDGE_MAX_DOWNLOAD_BYTES", "not a number");
        assert_eq!(max_download_bytes(), DEFAULT_MAX_BYTES);

        std::env::set_var("IRONBRIDGE_MAX_DOWNLOAD_BYTES", "0");
        assert_eq!(max_download_bytes(), DEFAULT_MAX_BYTES, "zero disables");

        std::env::set_var("IRONBRIDGE_MAX_DOWNLOAD_BYTES", "1024");
        assert_eq!(max_download_bytes(), 1024);
        std::env::remove_var("IRONBRIDGE_MAX_DOWNLOAD_BYTES");
    }

    /// Free space is readable for a path that exists.
    ///
    /// A weak assertion on purpose -- the number is the machine's -- but it
    /// catches the failure that matters: `None`, which makes every download
    /// refuse.
    #[test]
    fn free_space_is_readable_for_a_real_directory() {
        let dir = tempfile::tempdir().expect("tempdir");
        assert!(
            free_space_for(dir.path()).is_some(),
            "no disk matched {}",
            dir.path().display()
        );
    }
}
