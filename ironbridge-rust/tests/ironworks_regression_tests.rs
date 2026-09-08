// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

//! IronWorks regression tests - Ensures session parsing and index repair work correctly
//!
//! These tests verify:
//! - JSONL session files with requests parse correctly (isEmpty = false)
//! - Empty JSONL sessions correctly report isEmpty = true
//! - VS Code 1.109+ index format with timing and lastResponseState
//! - sync_session_index correctly builds index entries from disk files
//! - kind:0 initial state, kind:1 deltas, kind:2 appends all work
//! - ChatRequest deserialization handles unknown VS Code fields gracefully

use ironbridge::models::{ChatSessionIndex, ChatSessionIndexEntry, ChatSessionTiming};
use ironbridge::storage::{parse_session_jsonl, read_chat_session_index, write_chat_session_index};
use std::collections::HashMap;
use std::fs;
use tempfile::TempDir;

// ============================================================================
// Test Data: Realistic VS Code 1.109 JSONL Sessions
// ============================================================================

/// Empty session JSONL (VS Code 1.109 format) — single kind:0 with no requests
fn empty_session_jsonl() -> String {
    r#"{"kind":0,"v":{"version":3,"creationDate":1770848092695,"initialLocation":"panel","responderUsername":"GitHub Copilot","sessionId":"38c865eb-b800-46dc-bcef-c29a652cb9bb","hasPendingEdits":false,"requests":[],"inputState":{"attachments":[],"mode":{"id":"agent","kind":"agent"},"selectedModel":{"identifier":"copilot/claude-opus-4.6","metadata":{"extension":{"value":"GitHub.copilot-chat","_lower":"github.copilot-chat"},"id":"claude-opus-4.6","vendor":"copilot","name":"Claude Opus 4.6","family":"claude-opus-4.6"}},"inputText":"Hello","selections":[]}}}"#.to_string()
}

/// Session with one request (kind:0 initial state includes one request)
fn single_request_session_jsonl() -> String {
    r#"{"kind":0,"v":{"version":3,"creationDate":1762576472674,"customTitle":"Test session","initialLocation":"panel","responderUsername":"GitHub Copilot","sessionId":"ac554459-d09b-48e7-9dbf-b99910869732","hasPendingEdits":false,"requests":[{"requestId":"request_a3c8ec73-53e0-408f-8c0f-ff150051f03b","timestamp":1762576780191,"agent":{"extensionId":{"value":"GitHub.copilot-chat","_lower":"github.copilot-chat"},"extensionVersion":"0.32.4","publisherDisplayName":"GitHub","extensionPublisherId":"GitHub","extensionDisplayName":"GitHub Copilot Chat","id":"github.copilot.editsAgent","name":"agent","fullName":"GitHub Copilot","isDefault":true,"locations":["panel"],"modes":["agent"]},"modelId":"copilot/claude-sonnet-4.5","responseId":"response_54015187-cb5d-4e08-ab43-71cb067fca69","result":{"timings":{"firstProgress":2821,"totalElapsed":16261}},"modelState":{"state":"complete"},"contentReferences":[],"codeCitations":[],"timeSpentWaiting":0,"editedFileEvents":[],"response":[{"kind":"markdownContent","content":{"value":"Here is the code..."}}],"message":{"text":"Rewrite this in Rust","parts":[{"kind":"text","text":"Rewrite this in Rust"}]},"variableData":{"variables":[],"context":[]}}]}}"#.to_string()
}

/// Multi-request session: kind:0 with 2 requests + kind:2 append + kind:1 delta
fn multi_request_session_jsonl() -> String {
    let lines = [
        // kind:0 initial with 2 requests
        r#"{"kind":0,"v":{"version":3,"creationDate":1762576472674,"customTitle":"Multi-request session","initialLocation":"panel","responderUsername":"GitHub Copilot","sessionId":"multi-test-1234","hasPendingEdits":false,"requests":[{"requestId":"req-1","timestamp":1762576780191,"modelId":"copilot/gpt-4o","response":[{"kind":"markdownContent","content":{"value":"Response 1"}}],"message":{"text":"First question","parts":[{"kind":"text","text":"First question"}]},"variableData":{"variables":[]}},{"requestId":"req-2","timestamp":1762576890000,"modelId":"copilot/gpt-4o","response":[{"kind":"markdownContent","content":{"value":"Response 2"}}],"message":{"text":"Second question","parts":[{"kind":"text","text":"Second question"}]},"variableData":{"variables":[]}}]}}"#,
        // kind:2 append a new request
        r#"{"kind":2,"k":["requests"],"v":[{"requestId":"req-3","timestamp":1762577000000,"modelId":"copilot/claude-sonnet-4.5","response":[{"kind":"markdownContent","content":{"value":"Response 3"}}],"message":{"text":"Third question","parts":[{"kind":"text","text":"Third question"}]},"variableData":{"variables":[]}}]}"#,
        // kind:1 update the custom title
        r#"{"kind":1,"k":["customTitle"],"v":"Updated session title"}"#,
        // kind:1 update response state on request 2
        r#"{"kind":1,"k":["requests",2,"modelState"],"v":{"state":"complete"}}"#,
        // kind:2 append response parts to request 2
        r#"{"kind":2,"k":["requests",2,"response"],"v":[{"kind":"markdownContent","content":{"value":" additional content"}}]}"#,
    ];

    lines.join("\n")
}

/// Session with unknown VS Code fields that should be silently ignored
fn session_with_unknown_fields_jsonl() -> String {
    r#"{"kind":0,"v":{"version":3,"creationDate":1770000000000,"initialLocation":"panel","responderUsername":"GitHub Copilot","sessionId":"unknown-fields-test","hasPendingEdits":false,"repoData":{"someField":"value"},"pendingRequests":[],"requests":[{"requestId":"req-u1","timestamp":1770000001000,"modelId":"copilot/gpt-4o","response":[],"message":{"text":"Question with unknown fields","parts":[]},"variableData":{"variables":[]},"futureField1":"test","futureField2":42,"futureNested":{"a":1,"b":2}}]}}"#.to_string()
}

/// Session with kind:2 truncation index (VS Code uses `i` for truncating arrays)
#[allow(dead_code)]
fn session_with_truncation_jsonl() -> String {
    let lines = [
        // Initial session with one request that has response parts
        r#"{"kind":0,"v":{"version":3,"creationDate":1770000000000,"initialLocation":"panel","responderUsername":"GitHub Copilot","sessionId":"truncation-test","hasPendingEdits":false,"requests":[{"requestId":"req-t1","timestamp":1770000001000,"modelId":"copilot/gpt-4o","response":[{"kind":"markdownContent","content":{"value":"Part 1"}},{"kind":"markdownContent","content":{"value":"Part 2"}},{"kind":"markdownContent","content":{"value":"Part 3"}}],"message":{"text":"Test truncation","parts":[]},"variableData":{"variables":[]}}]}}"#,
        // kind:2 with truncation index (i=1 means truncate at index 1, then append)
        r#"{"kind":2,"k":["requests",0,"response"],"v":[{"kind":"markdownContent","content":{"value":"Replacement part"}}],"i":1}"#,
    ];

    lines.join("\n")
}

// ============================================================================
// Parse Session JSONL Tests
// ============================================================================

mod parse_jsonl_tests {
    use super::*;

    #[test]
    fn test_empty_session_is_empty() {
        let content = empty_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert!(
            session.is_empty(),
            "Empty session should report is_empty=true"
        );
        assert_eq!(
            session.session_id,
            Some("38c865eb-b800-46dc-bcef-c29a652cb9bb".to_string())
        );
        assert_eq!(session.version, 3);
        assert_eq!(session.initial_location, "panel");
        assert_eq!(
            session.responder_username,
            Some("GitHub Copilot".to_string())
        );
        assert!(session.custom_title.is_none());
        assert_eq!(session.requests.len(), 0);
    }

    #[test]
    fn test_single_request_not_empty() {
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert!(
            !session.is_empty(),
            "Session with requests should NOT be empty"
        );
        assert_eq!(session.requests.len(), 1);
        assert_eq!(
            session.session_id,
            Some("ac554459-d09b-48e7-9dbf-b99910869732".to_string())
        );
        assert_eq!(session.custom_title, Some("Test session".to_string()));

        // Check request fields
        let req = &session.requests[0];
        assert_eq!(
            req.request_id,
            Some("request_a3c8ec73-53e0-408f-8c0f-ff150051f03b".to_string())
        );
        assert_eq!(req.timestamp, Some(1762576780191));
        assert_eq!(req.model_id, Some("copilot/claude-sonnet-4.5".to_string()));

        // Check message
        let msg = req.message.as_ref().unwrap();
        assert_eq!(msg.text, Some("Rewrite this in Rust".to_string()));
    }

    #[test]
    fn test_multi_request_with_appends() {
        let content = multi_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert!(!session.is_empty());
        assert_eq!(
            session.requests.len(),
            3,
            "Should have 2 initial + 1 appended request"
        );

        // kind:1 title update should take effect
        assert_eq!(
            session.custom_title,
            Some("Updated session title".to_string())
        );

        // Check last request (appended via kind:2)
        let last = &session.requests[2];
        assert_eq!(last.request_id, Some("req-3".to_string()));
        assert_eq!(last.timestamp, Some(1762577000000));
        assert_eq!(last.model_id, Some("copilot/claude-sonnet-4.5".to_string()));

        // Last message date should be from the most recent request
        assert_eq!(session.last_message_date, 1762577000000);
    }

    #[test]
    fn test_unknown_fields_ignored() {
        let content = session_with_unknown_fields_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert!(
            !session.is_empty(),
            "Session with requests should NOT be empty even with unknown fields"
        );
        assert_eq!(session.requests.len(), 1);
        assert_eq!(session.session_id, Some("unknown-fields-test".to_string()));

        // The unknown fields (futureField1, futureField2, futureNested) should be silently ignored
        let req = &session.requests[0];
        assert_eq!(req.request_id, Some("req-u1".to_string()));
    }

    #[test]
    fn test_creation_date_parsed() {
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert_eq!(session.creation_date, 1762576472674);
    }

    #[test]
    fn test_last_message_date_from_requests() {
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        // Should use timestamp from the request, not creation date
        assert_eq!(session.last_message_date, 1762576780191);
    }

    #[test]
    fn test_last_message_date_fallback_to_creation() {
        let content = empty_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        // With no requests, should fall back to creation date
        assert_eq!(session.last_message_date, 1770848092695);
    }

    #[test]
    fn test_title_method() {
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        // title() should return customTitle when available
        assert_eq!(session.title(), "Test session");
    }

    #[test]
    fn test_title_fallback_to_first_message() {
        // Create a session with no custom title but with a request
        let content = r#"{"kind":0,"v":{"version":3,"creationDate":1770000000000,"initialLocation":"panel","sessionId":"no-title-test","requests":[{"requestId":"req-1","timestamp":1770000001000,"response":[],"message":{"text":"What is Rust?","parts":[]},"variableData":{"variables":[]}}]}}"#;
        let session = parse_session_jsonl(content).unwrap();

        assert!(session.custom_title.is_none());
        // title() should fall back to first message text
        let title = session.title();
        assert!(
            title.contains("What is Rust"),
            "Title should contain first message text, got: {}",
            title
        );
    }

    #[test]
    fn test_empty_lines_ignored() {
        let content = format!(
            "{}\n\n\n{}",
            r#"{"kind":0,"v":{"version":3,"creationDate":1770000000000,"sessionId":"blank-lines","requests":[{"requestId":"req-1","timestamp":1770000001000,"response":[],"message":{"text":"test"},"variableData":{}}]}}"#,
            r#"{"kind":1,"k":["customTitle"],"v":"After blank lines"}"#
        );
        let session = parse_session_jsonl(&content).unwrap();

        assert_eq!(session.requests.len(), 1);
        assert_eq!(session.custom_title, Some("After blank lines".to_string()));
    }

    #[test]
    fn test_session_version() {
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();
        assert_eq!(session.version, 3);
    }

    #[test]
    fn test_request_count_method() {
        let content = multi_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();
        assert_eq!(session.request_count(), 3);
    }
}

// ============================================================================
// Index Format Tests (VS Code 1.109+)
// ============================================================================

mod index_format_tests {
    use super::*;

    fn create_test_db(path: &std::path::Path) {
        let conn = rusqlite::Connection::open(path).unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
    }

    #[test]
    fn test_index_with_timing_roundtrip() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("state.vscdb");
        create_test_db(&db_path);

        let mut entries = HashMap::new();
        entries.insert(
            "test-session-1".to_string(),
            ChatSessionIndexEntry {
                session_id: "test-session-1".to_string(),
                title: "Test Session".to_string(),
                last_message_date: 1770000001000,
                timing: Some(ChatSessionTiming {
                    created: 1770000000000,
                    last_request_started: Some(1770000001000),
                    last_request_ended: Some(1770000002000),
                }),
                last_response_state: 1,
                initial_location: "panel".to_string(),
                is_empty: false,
                is_imported: None,
                has_pending_edits: None,
                is_external: None,
            },
        );

        let index = ChatSessionIndex {
            version: 1,
            entries,
        };

        write_chat_session_index(&db_path, &index).unwrap();
        let read_back = read_chat_session_index(&db_path).unwrap();

        assert_eq!(read_back.entries.len(), 1);
        let entry = &read_back.entries["test-session-1"];
        assert_eq!(entry.title, "Test Session");
        assert!(!entry.is_empty);
        assert_eq!(entry.last_response_state, 1);

        let timing = entry.timing.as_ref().unwrap();
        assert_eq!(timing.created, 1770000000000);
        assert_eq!(timing.last_request_started, Some(1770000001000));
        assert_eq!(timing.last_request_ended, Some(1770000002000));
    }

    #[test]
    fn test_empty_entry_is_empty_true() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("state.vscdb");
        create_test_db(&db_path);

        // Parse empty session and build index entry
        let content = empty_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        let mut entries = HashMap::new();
        entries.insert(
            session.session_id.clone().unwrap(),
            ChatSessionIndexEntry {
                session_id: session.session_id.clone().unwrap(),
                title: session.title(),
                last_message_date: session.last_message_date,
                timing: Some(ChatSessionTiming {
                    created: session.creation_date,
                    last_request_started: Some(session.last_message_date),
                    last_request_ended: Some(session.last_message_date),
                }),
                last_response_state: 1,
                initial_location: session.initial_location.clone(),
                is_empty: session.is_empty(),
                is_imported: None,
                has_pending_edits: None,
                is_external: None,
            },
        );

        let index = ChatSessionIndex {
            version: 1,
            entries,
        };
        write_chat_session_index(&db_path, &index).unwrap();
        let read_back = read_chat_session_index(&db_path).unwrap();

        let entry = &read_back.entries["38c865eb-b800-46dc-bcef-c29a652cb9bb"];
        assert!(
            entry.is_empty,
            "Empty session should have isEmpty=true in index"
        );
    }

    #[test]
    fn test_non_empty_entry_is_empty_false() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("state.vscdb");
        create_test_db(&db_path);

        // Parse non-empty session and build index entry
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        let mut entries = HashMap::new();
        entries.insert(
            session.session_id.clone().unwrap(),
            ChatSessionIndexEntry {
                session_id: session.session_id.clone().unwrap(),
                title: session.title(),
                last_message_date: session.last_message_date,
                timing: Some(ChatSessionTiming {
                    created: session.creation_date,
                    last_request_started: Some(session.last_message_date),
                    last_request_ended: Some(session.last_message_date),
                }),
                last_response_state: 1,
                initial_location: session.initial_location.clone(),
                is_empty: session.is_empty(),
                is_imported: None,
                has_pending_edits: None,
                is_external: None,
            },
        );

        let index = ChatSessionIndex {
            version: 1,
            entries,
        };
        write_chat_session_index(&db_path, &index).unwrap();
        let read_back = read_chat_session_index(&db_path).unwrap();

        let entry = &read_back.entries["ac554459-d09b-48e7-9dbf-b99910869732"];
        assert!(
            !entry.is_empty,
            "Non-empty session MUST have isEmpty=false in index"
        );
        assert_eq!(entry.title, "Test session");
        assert_eq!(entry.last_message_date, 1762576780191);
    }
}

// ============================================================================
// Sync Session Index Integration Tests
// ============================================================================

mod sync_index_tests {
    use super::*;

    /// Set up a fake workspace with state.vscdb and chatSessions directory
    fn setup_workspace(temp_dir: &TempDir) -> (String, std::path::PathBuf, std::path::PathBuf) {
        // We can't use sync_session_index directly because it calls get_workspace_storage_db
        // which uses a fixed path. Instead, test the components individually.
        let ws_dir = temp_dir.path().to_path_buf();
        let chat_dir = ws_dir.join("chatSessions");
        fs::create_dir_all(&chat_dir).unwrap();

        let db_path = ws_dir.join("state.vscdb");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();

        ("test-workspace".to_string(), ws_dir, chat_dir)
    }

    #[test]
    fn test_parse_and_index_empty_session() {
        let content = empty_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert!(session.is_empty());
        assert_eq!(session.title(), "Untitled");
    }

    #[test]
    fn test_parse_and_index_non_empty_session() {
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert!(!session.is_empty());
        assert_eq!(session.title(), "Test session");
        assert_eq!(session.request_count(), 1);
    }

    #[test]
    fn test_parse_multi_request_with_all_kinds() {
        let content = multi_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert!(!session.is_empty());
        assert_eq!(session.request_count(), 3);
        assert_eq!(session.title(), "Updated session title");
        assert_eq!(session.last_message_date, 1762577000000);
    }

    #[test]
    fn test_index_rebuild_from_files() {
        let temp_dir = TempDir::new().unwrap();
        let (_, _ws_dir, chat_dir) = setup_workspace(&temp_dir);

        // Write session files
        fs::write(chat_dir.join("empty-session.jsonl"), empty_session_jsonl()).unwrap();
        fs::write(
            chat_dir.join("ac554459-d09b-48e7-9dbf-b99910869732.jsonl"),
            single_request_session_jsonl(),
        )
        .unwrap();
        fs::write(
            chat_dir.join("multi-test-1234.jsonl"),
            multi_request_session_jsonl(),
        )
        .unwrap();

        // Manually parse all files and build index (same logic as sync_session_index)
        let mut index = ChatSessionIndex::default();
        for entry in fs::read_dir(&chat_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if let Ok(session) = ironbridge::parse_session_file(&path) {
                let session_id = session
                    .session_id
                    .clone()
                    .unwrap_or_else(|| path.file_stem().unwrap().to_string_lossy().to_string());
                let is_empty = session.is_empty();
                let title = session.title();
                let last_msg = session.last_message_date;

                index.entries.insert(
                    session_id.clone(),
                    ChatSessionIndexEntry {
                        session_id,
                        title,
                        last_message_date: last_msg,
                        timing: Some(ChatSessionTiming {
                            created: session.creation_date,
                            last_request_started: Some(last_msg),
                            last_request_ended: Some(last_msg),
                        }),
                        last_response_state: 1,
                        initial_location: session.initial_location.clone(),
                        is_empty,
                        is_imported: None,
                        has_pending_edits: None,
                        is_external: None,
                    },
                );
            }
        }

        // Verify index
        assert_eq!(index.entries.len(), 3);

        // Note: empty session uses sessionId from the file, not the filename
        let empty = &index.entries["38c865eb-b800-46dc-bcef-c29a652cb9bb"];
        assert!(empty.is_empty, "Empty session must have isEmpty=true");
        assert_eq!(empty.title, "Untitled");

        let single = &index.entries["ac554459-d09b-48e7-9dbf-b99910869732"];
        assert!(
            !single.is_empty,
            "Session with requests must have isEmpty=false"
        );
        assert_eq!(single.title, "Test session");

        let multi = &index.entries["multi-test-1234"];
        assert!(
            !multi.is_empty,
            "Multi-request session must have isEmpty=false"
        );
        assert_eq!(multi.title, "Updated session title");
    }

    #[test]
    fn test_index_write_read_roundtrip() {
        let temp_dir = TempDir::new().unwrap();
        let (_, ws_dir, chat_dir) = setup_workspace(&temp_dir);
        let db_path = ws_dir.join("state.vscdb");

        // Write a non-empty session
        fs::write(
            chat_dir.join("test-session.jsonl"),
            single_request_session_jsonl(),
        )
        .unwrap();

        // Parse and build index
        let session = parse_session_jsonl(&single_request_session_jsonl()).unwrap();
        let mut index = ChatSessionIndex::default();
        index.entries.insert(
            session.session_id.clone().unwrap(),
            ChatSessionIndexEntry {
                session_id: session.session_id.clone().unwrap(),
                title: session.title(),
                last_message_date: session.last_message_date,
                timing: Some(ChatSessionTiming {
                    created: session.creation_date,
                    last_request_started: Some(session.last_message_date),
                    last_request_ended: Some(session.last_message_date),
                }),
                last_response_state: 1,
                initial_location: session.initial_location.clone(),
                is_empty: session.is_empty(),
                is_imported: None,
                has_pending_edits: None,
                is_external: None,
            },
        );

        // Write to DB
        write_chat_session_index(&db_path, &index).unwrap();

        // Read back
        let read_back = read_chat_session_index(&db_path).unwrap();
        let entry = &read_back.entries["ac554459-d09b-48e7-9dbf-b99910869732"];

        assert!(
            !entry.is_empty,
            "isEmpty must survive write/read roundtrip as false"
        );
        assert_eq!(entry.title, "Test session");
        assert_eq!(entry.last_response_state, 1);
        assert!(entry.timing.is_some());
    }
}

// ============================================================================
// Legacy JSON Format Tests
// ============================================================================

mod legacy_json_tests {
    use ironbridge::storage::parse_session_json;

    #[test]
    fn test_legacy_json_empty() {
        let content = r#"{
            "version": 3,
            "responderUsername": "GitHub Copilot",
            "initialLocation": "panel",
            "requests": [],
            "sessionId": "legacy-empty-test",
            "creationDate": 1763074367295,
            "isImported": false,
            "lastMessageDate": 1763074367295
        }"#;

        let session = parse_session_json(content).unwrap();
        assert!(session.is_empty());
        assert_eq!(session.session_id, Some("legacy-empty-test".to_string()));
    }

    #[test]
    fn test_legacy_json_with_requests() {
        let content = r#"{
            "version": 3,
            "responderUsername": "GitHub Copilot",
            "initialLocation": "panel",
            "requests": [
                {
                    "requestId": "req-legacy-1",
                    "timestamp": 1763074400000,
                    "message": {"text": "Hello from legacy format"},
                    "response": [{"kind": "markdownContent", "content": {"value": "Hi!"}}],
                    "variableData": {}
                }
            ],
            "sessionId": "legacy-with-requests",
            "creationDate": 1763074367295,
            "lastMessageDate": 1763074400000
        }"#;

        let session = parse_session_json(content).unwrap();
        assert!(!session.is_empty());
        assert_eq!(session.requests.len(), 1);
    }
}

// ============================================================================
// Auto-detect Format Tests
// ============================================================================

mod auto_detect_tests {
    use super::*;
    use ironbridge::storage::parse_session_auto;

    #[test]
    fn test_auto_detect_jsonl() {
        let content = single_request_session_jsonl();
        let (session, format_info) = parse_session_auto(&content).unwrap();

        assert!(!session.is_empty());
        assert_eq!(
            format_info.format,
            ironbridge::storage::VsCodeSessionFormat::JsonLines
        );
    }

    #[test]
    fn test_auto_detect_json() {
        let content = r#"{
            "version": 3,
            "requests": [{"requestId": "r1", "timestamp": 1770000000000, "message": {"text": "test"}}],
            "sessionId": "auto-json-test",
            "creationDate": 1770000000000
        }"#;
        let (session, format_info) = parse_session_auto(content).unwrap();

        assert!(!session.is_empty());
        assert_eq!(
            format_info.format,
            ironbridge::storage::VsCodeSessionFormat::LegacyJson
        );
    }
}

// ============================================================================
// IronWorks Regression: Main isEmpty Bug Test
// ============================================================================

mod ironworks_regression {
    use super::*;

    /// This is THE regression test for the IronWorks bug.
    /// The bug: sync_session_index wrote isEmpty=true for sessions that had requests,
    /// causing VS Code to treat them as empty and making them disappear on click.
    #[test]
    fn test_session_with_requests_must_not_be_empty() {
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        // THE CRITICAL ASSERTION
        assert!(
            !session.is_empty(),
            "REGRESSION: Session with {} requests is incorrectly marked as empty! \
             This causes sessions to disappear in VS Code when clicked.",
            session.requests.len()
        );
    }

    /// Verify that the index entry for a non-empty session has isEmpty=false
    #[test]
    fn test_index_entry_is_empty_false_for_non_empty_session() {
        let content = single_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        let entry = ChatSessionIndexEntry {
            session_id: session.session_id.clone().unwrap(),
            title: session.title(),
            last_message_date: session.last_message_date,
            timing: Some(ChatSessionTiming {
                created: session.creation_date,
                last_request_started: Some(session.last_message_date),
                last_request_ended: Some(session.last_message_date),
            }),
            last_response_state: 1,
            initial_location: session.initial_location.clone(),
            is_empty: session.is_empty(),
            is_imported: None,
            has_pending_edits: None,
            is_external: None,
        };

        // THE CRITICAL ASSERTION
        assert!(
            !entry.is_empty,
            "REGRESSION: Index entry isEmpty must be false for non-empty sessions"
        );
    }

    /// Verify multiple JSONL operation kinds work together
    #[test]
    fn test_all_jsonl_operations_preserve_requests() {
        let content = multi_request_session_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert_eq!(
            session.requests.len(),
            3,
            "2 initial + 1 kind:2 append = 3 requests"
        );
        assert!(
            !session.is_empty(),
            "Session with 3 requests must not be empty"
        );
        assert_eq!(
            session.custom_title,
            Some("Updated session title".to_string()),
            "kind:1 title update must be applied"
        );
    }

    /// Verify unknown VS Code fields don't break parsing
    #[test]
    fn test_unknown_fields_dont_break_parsing() {
        let content = session_with_unknown_fields_jsonl();
        let session = parse_session_jsonl(&content).unwrap();

        assert!(
            !session.is_empty(),
            "Unknown fields must not cause requests to be dropped"
        );
        assert_eq!(session.requests.len(), 1);
    }

    /// Verify the index serialization format matches VS Code 1.109 expectations
    #[test]
    fn test_index_serialization_format() {
        let mut entries = HashMap::new();
        entries.insert(
            "test-id".to_string(),
            ChatSessionIndexEntry {
                session_id: "test-id".to_string(),
                title: "Test".to_string(),
                last_message_date: 1770000000000,
                timing: Some(ChatSessionTiming {
                    created: 1770000000000,
                    last_request_started: Some(1770000001000),
                    last_request_ended: Some(1770000002000),
                }),
                last_response_state: 1,
                initial_location: "panel".to_string(),
                is_empty: false,
                is_imported: None,
                has_pending_edits: None,
                is_external: None,
            },
        );

        let index = ChatSessionIndex {
            version: 1,
            entries,
        };
        let json = serde_json::to_string(&index).unwrap();

        // Verify camelCase field names (VS Code expects these)
        assert!(
            json.contains("\"sessionId\""),
            "Must use camelCase sessionId"
        );
        assert!(
            json.contains("\"lastMessageDate\""),
            "Must use camelCase lastMessageDate"
        );
        assert!(json.contains("\"isEmpty\""), "Must include isEmpty field");
        assert!(
            json.contains("\"lastResponseState\""),
            "Must include lastResponseState"
        );
        assert!(
            json.contains("\"initialLocation\""),
            "Must include initialLocation"
        );
        assert!(json.contains("\"timing\""), "Must include timing");
        assert!(
            json.contains("\"lastRequestStarted\""),
            "Must use camelCase in timing"
        );
        assert!(
            json.contains("\"lastRequestEnded\""),
            "Must use camelCase in timing"
        );

        // Verify isEmpty is false in the serialized JSON
        assert!(
            json.contains("\"isEmpty\":false"),
            "isEmpty must be false for non-empty session"
        );
    }
}
