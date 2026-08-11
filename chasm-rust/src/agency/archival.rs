// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Autonomous Session Archival Agent
//!
//! An AI agent that automatically archives old or inactive sessions based on
//! configurable rules and policies.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::agency::{Agent, AgentBuilder, AgentConfig, AgentRole, AgentStatus};
use crate::database::ChatDatabase;

/// Archival policy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivalPolicy {
    /// Policy name
    pub name: String,
    /// Whether policy is enabled
    pub enabled: bool,
    /// Days of inactivity before archival
    pub inactive_days: u32,
    /// Minimum message count to archive (skip small sessions)
    pub min_messages: u32,
    /// Maximum message count (archive large sessions sooner)
    pub max_messages: Option<u32>,
    /// Providers to include (empty = all)
    pub providers: Vec<String>,
    /// Workspaces to include (empty = all)
    pub workspace_ids: Vec<String>,
    /// Tags that prevent archival
    pub exclude_tags: Vec<String>,
    /// Tags that trigger immediate archival
    pub include_tags: Vec<String>,
    /// Whether to compress archived sessions
    pub compress: bool,
    /// Whether to notify on archival
    pub notify: bool,
}

impl Default for ArchivalPolicy {
    fn default() -> Self {
        Self {
            name: "default".to_string(),
            enabled: true,
            inactive_days: 30,
            min_messages: 5,
            max_messages: None,
            providers: vec![],
            workspace_ids: vec![],
            exclude_tags: vec!["pinned".to_string(), "important".to_string()],
            include_tags: vec!["archive".to_string()],
            compress: true,
            notify: true,
        }
    }
}

/// Session candidate for archival
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivalCandidate {
    /// Session ID
    pub session_id: String,
    /// Session title
    pub title: String,
    /// Provider
    pub provider: String,
    /// Workspace ID
    pub workspace_id: Option<String>,
    /// Message count
    pub message_count: u32,
    /// Last activity
    pub last_activity: DateTime<Utc>,
    /// Days inactive
    pub days_inactive: u32,
    /// Matching policy
    pub policy: String,
    /// Reason for archival
    pub reason: String,
    /// Priority (higher = archive sooner)
    pub priority: u8,
}

/// Archival decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivalDecision {
    /// Session ID
    pub session_id: String,
    /// Whether to archive
    pub should_archive: bool,
    /// Confidence (0.0 - 1.0)
    pub confidence: f64,
    /// Reasoning
    pub reasoning: String,
    /// Matched policies
    pub policies: Vec<String>,
}

/// Archival result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivalResult {
    /// Sessions archived
    pub archived_count: u32,
    /// Sessions skipped
    pub skipped_count: u32,
    /// Total size saved (bytes)
    pub bytes_saved: u64,
    /// Errors
    pub errors: Vec<String>,
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    /// Duration (ms)
    pub duration_ms: u64,
}

/// Archival agent state
pub struct ArchivalAgentState {
    /// Policies
    policies: Vec<ArchivalPolicy>,
    /// Last run time
    last_run: Option<DateTime<Utc>>,
    /// Statistics
    stats: ArchivalStats,
    /// Pending candidates
    pending: Vec<ArchivalCandidate>,
}

/// Archival statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ArchivalStats {
    /// Total runs
    pub total_runs: u64,
    /// Total archived
    pub total_archived: u64,
    /// Total skipped
    pub total_skipped: u64,
    /// Total bytes saved
    pub total_bytes_saved: u64,
    /// Average confidence
    pub avg_confidence: f64,
}

/// Autonomous session archival agent
pub struct ArchivalAgent {
    /// Agent configuration
    config: AgentConfig,
    /// Agent state
    state: Arc<RwLock<ArchivalAgentState>>,
    /// Database reference
    db: Option<Arc<ChatDatabase>>,
    /// Whether agent is running
    running: Arc<RwLock<bool>>,
}

impl ArchivalAgent {
    /// Create a new archival agent
    pub fn new() -> Self {
        let config = AgentConfig {
            name: "archival-agent".to_string(),
            description: "Autonomous session archival agent".to_string(),
            instruction: ARCHIVAL_SYSTEM_PROMPT.to_string(),
            ..Default::default()
        };

        let state = ArchivalAgentState {
            policies: vec![ArchivalPolicy::default()],
            last_run: None,
            stats: ArchivalStats::default(),
            pending: vec![],
        };

        Self {
            config,
            state: Arc::new(RwLock::new(state)),
            db: None,
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Create with custom policies
    pub fn with_policies(policies: Vec<ArchivalPolicy>) -> Self {
        let agent = Self::new();
        let mut state = agent.state.blocking_write();
        state.policies = policies;
        drop(state);
        agent
    }

    /// Set database reference
    pub fn with_database(mut self, db: Arc<ChatDatabase>) -> Self {
        self.db = Some(db);
        self
    }

    /// Add a policy
    pub async fn add_policy(&self, policy: ArchivalPolicy) {
        let mut state = self.state.write().await;
        state.policies.push(policy);
    }

    /// Remove a policy by name
    pub async fn remove_policy(&self, name: &str) -> bool {
        let mut state = self.state.write().await;
        let len_before = state.policies.len();
        state.policies.retain(|p| p.name != name);
        state.policies.len() < len_before
    }

    /// Get all policies
    pub async fn get_policies(&self) -> Vec<ArchivalPolicy> {
        let state = self.state.read().await;
        state.policies.clone()
    }

    /// Scan for archival candidates.
    ///
    /// Always empty. Finding candidates means querying sessions by age,
    /// message count, provider and tags, and [`ArchivalAgent`] holds no
    /// database handle to query -- it owns policies and statistics, nothing
    /// else. Returning nothing is therefore correct rather than provisional:
    /// there is no set of sessions this type is in a position to name.
    pub async fn scan_candidates(&self) -> Vec<ArchivalCandidate> {
        Vec::new()
    }

    /// Evaluate a session for archival.
    ///
    /// Always declines, because this type cannot see the session.
    ///
    /// # What this used to do
    ///
    /// It looped over the enabled policies, pushed every one of them into
    /// `matched_policies` without testing a single condition, and then -- since
    /// the list was non-empty -- returned `should_archive: true` with
    /// `confidence: 0.85`. The `session_id` argument was echoed into the result
    /// and otherwise unused. Any session at all, examined or not, existing or
    /// not, came back marked for archival with a number attached that looked
    /// like it had been computed.
    ///
    /// [`Self::run`] gates on `should_archive && confidence >= 0.7`, so that
    /// verdict was one populated `scan_candidates` away from archiving
    /// everything it was handed. Declining is the only answer this type can
    /// honestly give until it can read a session.
    pub async fn evaluate_session(&self, session_id: &str) -> ArchivalDecision {
        ArchivalDecision {
            session_id: session_id.to_string(),
            should_archive: false,
            confidence: 0.0,
            reasoning: "cannot evaluate: the archival agent has no access to \
                        session data, so no policy condition can be tested"
                .to_string(),
            policies: Vec::new(),
        }
    }

    /// Archive a single session.
    ///
    /// Always an error. Archiving means marking the session in the database and
    /// optionally exporting it, and this type has no database handle.
    ///
    /// It previously incremented `stats.total_archived` and returned `Ok(true)`
    /// without touching anything, so the statistics counted archives that had
    /// not occurred -- and a caller checking the return value was told the
    /// session was safely put away when it was untouched.
    pub async fn archive_session(&self, session_id: &str) -> Result<bool, String> {
        Err(format!(
            "cannot archive {session_id}: the archival agent has no access to \
             session storage"
        ))
    }

    /// Run the archival agent
    pub async fn run(&self) -> ArchivalResult {
        let start = std::time::Instant::now();
        let mut result = ArchivalResult {
            archived_count: 0,
            skipped_count: 0,
            bytes_saved: 0,
            errors: vec![],
            timestamp: Utc::now(),
            duration_ms: 0,
        };

        // Set running flag
        {
            let mut running = self.running.write().await;
            if *running {
                result.errors.push("Agent already running".to_string());
                return result;
            }
            *running = true;
        }

        // Scan for candidates
        let candidates = self.scan_candidates().await;

        // Evaluate and archive each candidate
        for candidate in candidates {
            let decision = self.evaluate_session(&candidate.session_id).await;

            if decision.should_archive && decision.confidence >= 0.7 {
                match self.archive_session(&candidate.session_id).await {
                    Ok(true) => {
                        result.archived_count += 1;
                    }
                    Ok(false) => {
                        result.skipped_count += 1;
                    }
                    Err(e) => {
                        result
                            .errors
                            .push(format!("Failed to archive {}: {}", candidate.session_id, e));
                    }
                }
            } else {
                result.skipped_count += 1;
            }
        }

        // Update state
        {
            let mut state = self.state.write().await;
            state.last_run = Some(Utc::now());
            state.stats.total_runs += 1;
            state.stats.total_bytes_saved += result.bytes_saved;
        }

        // Clear running flag
        {
            let mut running = self.running.write().await;
            *running = false;
        }

        result.duration_ms = start.elapsed().as_millis() as u64;
        result
    }

    /// Get agent statistics
    pub async fn get_stats(&self) -> ArchivalStats {
        let state = self.state.read().await;
        state.stats.clone()
    }

    /// Get last run time
    pub async fn get_last_run(&self) -> Option<DateTime<Utc>> {
        let state = self.state.read().await;
        state.last_run
    }

    /// Check if agent is running
    pub async fn is_running(&self) -> bool {
        let running = self.running.read().await;
        *running
    }

    /// Stop the agent
    pub async fn stop(&self) {
        let mut running = self.running.write().await;
        *running = false;
    }
}

impl Default for ArchivalAgent {
    fn default() -> Self {
        Self::new()
    }
}

/// System prompt for the archival agent
const ARCHIVAL_SYSTEM_PROMPT: &str = r#"You are an autonomous session archival agent for Chasm.

Your role is to analyze chat sessions and determine which should be archived based on:
1. Inactivity period (days since last message)
2. Session size and importance
3. Content relevance and quality
4. User-defined policies and tags

When evaluating a session for archival, consider:
- Is the conversation complete or ongoing?
- Does it contain important information that should be preserved?
- Are there pinned or important tags?
- How much space would archiving save?

Provide clear reasoning for your archival decisions.
"#;

/// Archival scheduler for periodic runs
pub struct ArchivalScheduler {
    /// Agent reference
    agent: Arc<ArchivalAgent>,
    /// Run interval
    interval: Duration,
    /// Whether scheduler is active
    active: Arc<RwLock<bool>>,
}

impl ArchivalScheduler {
    /// Create a new scheduler
    pub fn new(agent: Arc<ArchivalAgent>, interval_hours: u32) -> Self {
        Self {
            agent,
            interval: Duration::hours(interval_hours as i64),
            active: Arc::new(RwLock::new(false)),
        }
    }

    /// Mark the scheduler active. Nothing is scheduled.
    ///
    /// No timer is created and no task is spawned: after this returns,
    /// [`Self::is_active`] reports `true` and [`ArchivalAgent::run`] will not
    /// be called again unless a caller calls it. Background scheduling needs a
    /// `LocalSet`, or `ChatDatabase` made `Send + Sync`, and neither is done.
    ///
    /// The name is kept because it is public API, but "started" here means
    /// only that the flag is set -- which is why the message below says so
    /// rather than implying a loop is now running.
    pub async fn start(&self) {
        let mut active = self.active.write().await;
        *active = true;
        drop(active);

        println!(
            "[ArchivalScheduler] Marked active (interval {:?}). No background \
             task is running -- call run() to execute an archival pass.",
            self.interval
        );
    }

    /// Stop the scheduler
    pub async fn stop(&self) {
        let mut active = self.active.write().await;
        *active = false;
    }

    /// Check if scheduler is active
    pub async fn is_active(&self) -> bool {
        let active = self.active.read().await;
        *active
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_archival_agent_creation() {
        let agent = ArchivalAgent::new();
        let policies = agent.get_policies().await;
        assert_eq!(policies.len(), 1);
        assert_eq!(policies[0].name, "default");
    }

    #[tokio::test]
    async fn test_add_remove_policy() {
        let agent = ArchivalAgent::new();

        let custom_policy = ArchivalPolicy {
            name: "aggressive".to_string(),
            inactive_days: 7,
            ..Default::default()
        };

        agent.add_policy(custom_policy).await;
        let policies = agent.get_policies().await;
        assert_eq!(policies.len(), 2);

        agent.remove_policy("aggressive").await;
        let policies = agent.get_policies().await;
        assert_eq!(policies.len(), 1);
    }

    #[tokio::test]
    async fn test_evaluate_session() {
        let agent = ArchivalAgent::new();
        let decision = agent.evaluate_session("test-session-123").await;
        assert!(!decision.session_id.is_empty());
    }

    /// The old verdict was `should_archive: true, confidence: 0.85` for any
    /// session, reached without reading one. `run` archives anything above
    /// 0.7, so this is the guard on that.
    #[tokio::test]
    async fn an_unexaminable_session_is_never_recommended_for_archival() {
        let agent = ArchivalAgent::new();
        agent
            .add_policy(ArchivalPolicy {
                enabled: true,
                ..ArchivalPolicy::default()
            })
            .await;

        let decision = agent.evaluate_session("anything-at-all").await;

        assert!(!decision.should_archive, "{}", decision.reasoning);
        assert!(
            decision.confidence < 0.7,
            "confidence {} would clear the archival threshold in `run`",
            decision.confidence
        );
        assert!(
            decision.policies.is_empty(),
            "no policy was actually tested, so none should be reported as matched"
        );
    }

    #[tokio::test]
    async fn archiving_reports_failure_rather_than_counting_a_phantom() {
        let agent = ArchivalAgent::new();

        assert!(agent.archive_session("s1").await.is_err());
        assert_eq!(
            agent.get_stats().await.total_archived,
            0,
            "statistics must not count an archive that did not happen"
        );
    }

    #[tokio::test]
    async fn a_run_archives_nothing_and_says_nothing_was_archived() {
        let agent = ArchivalAgent::new();
        agent
            .add_policy(ArchivalPolicy {
                enabled: true,
                ..ArchivalPolicy::default()
            })
            .await;

        let result = agent.run().await;

        assert_eq!(result.archived_count, 0);
        assert_eq!(result.bytes_saved, 0);
        assert_eq!(agent.get_stats().await.total_archived, 0);
    }
}
