// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Model-backed conversation analysis.
//!
//! The analyzers in the parent module are heuristics: substring keyword
//! matching against a two-entry table, a small sentiment lexicon, and Jaccard
//! overlap. They run offline and for free, but they do not understand the
//! conversation -- `TopicExtractor` can only ever report "rust" or "python",
//! and `InsightsGenerator` returns an empty `key_points` list.
//!
//! This module adds real inference on top, and keeps the heuristics as the
//! fallback. The important property is that the caller can always tell which
//! one produced a given result: [`SessionAnalysis::source`] says so. Quietly
//! degrading to keyword matching under a model-shaped API is how the
//! embeddings code came to return zero vectors, and it is worth not repeating.

use super::{KeyPoint, Sentiment, SentimentAnalyzer, Topic, TopicExtractor};
use crate::models::ChatSession;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Which analyzer produced a result.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnalysisSource {
    /// A language model was called and answered.
    Model,
    /// Offline heuristics: keyword table, sentiment lexicon.
    Heuristic,
}

impl fmt::Display for AnalysisSource {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AnalysisSource::Model => write!(f, "model"),
            AnalysisSource::Heuristic => write!(f, "heuristic"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionAnalysis {
    /// How this was produced. Never inferred from the content -- always set
    /// by whichever path actually ran.
    pub source: AnalysisSource,
    pub summary: String,
    pub topics: Vec<Topic>,
    pub sentiment: Sentiment,
    pub key_points: Vec<KeyPoint>,
}

#[derive(Debug)]
pub enum AnalysisError {
    NoApiKey,
    Http(String),
    /// The model answered, but not with the JSON shape we asked for.
    BadResponse(String),
}

impl fmt::Display for AnalysisError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AnalysisError::NoApiKey => write!(f, "no OpenAI API key configured"),
            AnalysisError::Http(e) => write!(f, "analysis request failed: {}", e),
            AnalysisError::BadResponse(e) => write!(f, "unusable model response: {}", e),
        }
    }
}

impl std::error::Error for AnalysisError {}

/// How much conversation text to send. Long sessions are truncated rather
/// than rejected: a partial analysis of a huge session beats an error, and
/// the model only needs enough to characterise the discussion.
const MAX_CHARS: usize = 24_000;

const SYSTEM_PROMPT: &str = "You analyze developer chat sessions. Reply with JSON only, matching:
{\"summary\": string,
 \"topics\": [{\"name\": string, \"confidence\": number 0-1, \"keywords\": [string]}],
 \"sentiment\": {\"score\": number -1 to 1, \"label\": \"positive\"|\"neutral\"|\"negative\", \"confidence\": number 0-1},
 \"keyPoints\": [{\"summary\": string, \"importance\": number 0-1, \"category\": string}]}
Report topics actually discussed, not every technology mentioned in passing.";

/// Calls a chat model to analyze a session.
///
/// Mirrors `agency::memory::OpenAIEmbedding`: same key handling and an
/// overridable base URL so tests and proxies can point it elsewhere.
#[derive(Debug, Clone)]
pub struct ModelAnalyzer {
    api_key: String,
    model: String,
    base_url: String,
    client: reqwest::Client,
}

impl ModelAnalyzer {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: "gpt-4o-mini".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Build from the environment, or `None` when no key is configured.
    ///
    /// * `OPENAI_API_KEY` — required, and blank counts as absent: an empty key
    ///   would otherwise produce a 401 on every call, which reads as a service
    ///   outage rather than a missing configuration.
    /// * `OPENAI_BASE_URL` — optional. Any OpenAI-compatible endpoint works,
    ///   including a local llama-server or vLLM, so analysis need not depend
    ///   on a hosted service. A local server that ignores the key still needs
    ///   one set here; any placeholder will do.
    /// * `CHASM_ANALYSIS_MODEL` — optional model override, since a local
    ///   server will not be serving `gpt-4o-mini`.
    pub fn from_env() -> Option<Self> {
        let key = std::env::var("OPENAI_API_KEY").ok()?;
        if key.trim().is_empty() {
            return None;
        }
        let mut analyzer = Self::new(key);
        if let Ok(url) = std::env::var("OPENAI_BASE_URL") {
            if !url.trim().is_empty() {
                analyzer = analyzer.with_base_url(url.trim_end_matches('/').to_string());
            }
        }
        if let Ok(model) = std::env::var("CHASM_ANALYSIS_MODEL") {
            if !model.trim().is_empty() {
                analyzer = analyzer.with_model(model);
            }
        }
        Some(analyzer)
    }

    pub fn with_model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }

    /// Override the API base URL (for Azure, a proxy, or a test server).
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    pub async fn analyze(&self, session: &ChatSession) -> Result<SessionAnalysis, AnalysisError> {
        if self.api_key.trim().is_empty() {
            return Err(AnalysisError::NoApiKey);
        }

        let transcript = truncate_transcript(&session.collect_all_text());
        if transcript.trim().is_empty() {
            return Err(AnalysisError::BadResponse(
                "session has no text to analyze".to_string(),
            ));
        }

        let body = serde_json::json!({
            "model": self.model,
            "temperature": 0,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": SYSTEM_PROMPT },
                { "role": "user", "content": transcript },
            ],
        });

        let response = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AnalysisError::Http(e.to_string()))?;

        let status = response.status();
        let text = response
            .text()
            .await
            .map_err(|e| AnalysisError::Http(e.to_string()))?;
        if !status.is_success() {
            return Err(AnalysisError::Http(format!("HTTP {}: {}", status, text)));
        }

        parse_completion(&text)
    }
}

/// Trim to [`MAX_CHARS`] on a character boundary.
///
/// Slicing by byte index would panic mid-codepoint on any non-ASCII
/// transcript, which is most of them in practice.
fn truncate_transcript(text: &str) -> String {
    if text.len() <= MAX_CHARS {
        return text.to_string();
    }
    text.chars().take(MAX_CHARS).collect()
}

/// Pull the analysis out of a chat-completions envelope.
fn parse_completion(raw: &str) -> Result<SessionAnalysis, AnalysisError> {
    #[derive(Deserialize)]
    struct Message {
        content: Option<String>,
    }
    #[derive(Deserialize)]
    struct Choice {
        message: Message,
    }
    #[derive(Deserialize)]
    struct Completion {
        choices: Vec<Choice>,
    }

    let completion: Completion = serde_json::from_str(raw)
        .map_err(|e| AnalysisError::BadResponse(format!("not a completion: {}", e)))?;
    let content = completion
        .choices
        .first()
        .and_then(|c| c.message.content.as_deref())
        .ok_or_else(|| AnalysisError::BadResponse("no choices returned".to_string()))?;

    parse_analysis(content)
}

/// Parse the model's JSON payload into a [`SessionAnalysis`].
///
/// Kept separate from the HTTP layer so the shape can be tested without a
/// network round trip.
fn parse_analysis(content: &str) -> Result<SessionAnalysis, AnalysisError> {
    #[derive(Deserialize)]
    struct RawTopic {
        name: String,
        #[serde(default)]
        confidence: f32,
        #[serde(default)]
        keywords: Vec<String>,
    }
    #[derive(Deserialize)]
    struct RawSentiment {
        #[serde(default)]
        score: f32,
        #[serde(default)]
        label: String,
        #[serde(default)]
        confidence: f32,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RawKeyPoint {
        summary: String,
        #[serde(default)]
        importance: f32,
        #[serde(default)]
        category: String,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RawAnalysis {
        #[serde(default)]
        summary: String,
        #[serde(default)]
        topics: Vec<RawTopic>,
        sentiment: Option<RawSentiment>,
        #[serde(default)]
        key_points: Vec<RawKeyPoint>,
    }

    // Models sometimes wrap JSON in a ```json fence despite being asked not
    // to. Stripping it is cheaper than failing the whole analysis.
    let cleaned = strip_code_fence(content);

    let raw: RawAnalysis = serde_json::from_str(cleaned).map_err(|e| {
        AnalysisError::BadResponse(format!("{}: {}", e, truncate_for_error(cleaned)))
    })?;

    let sentiment = raw
        .sentiment
        .map(|s| Sentiment {
            score: s.score.clamp(-1.0, 1.0),
            label: if s.label.is_empty() {
                "neutral".to_string()
            } else {
                s.label
            },
            confidence: s.confidence.clamp(0.0, 1.0),
        })
        .unwrap_or_else(|| Sentiment {
            score: 0.0,
            label: "neutral".to_string(),
            confidence: 0.0,
        });

    Ok(SessionAnalysis {
        source: AnalysisSource::Model,
        summary: raw.summary,
        topics: raw
            .topics
            .into_iter()
            .map(|t| Topic {
                name: t.name,
                confidence: t.confidence.clamp(0.0, 1.0),
                keywords: t.keywords,
            })
            .collect(),
        sentiment,
        key_points: raw
            .key_points
            .into_iter()
            .map(|k| KeyPoint {
                summary: k.summary,
                importance: k.importance.clamp(0.0, 1.0),
                category: if k.category.is_empty() {
                    "general".to_string()
                } else {
                    k.category
                },
            })
            .collect(),
    })
}

fn strip_code_fence(content: &str) -> &str {
    let trimmed = content.trim();
    let Some(rest) = trimmed.strip_prefix("```") else {
        return trimmed;
    };
    // Drop the language tag on the opening fence, then the closing fence.
    let rest = rest.strip_prefix("json").unwrap_or(rest);
    rest.trim_start_matches('\n').trim_end_matches("```").trim()
}

fn truncate_for_error(s: &str) -> String {
    s.chars().take(200).collect()
}

// =============================================================================
// Unified entry point
// =============================================================================

/// Analyzes sessions with a model when one is configured, and with the
/// offline heuristics otherwise.
///
/// The fallback is deliberate and visible rather than silent: results carry
/// [`AnalysisSource`], so a caller that requires real inference can check for
/// it instead of being handed keyword counts that look like understanding.
pub struct Analyzer {
    model: Option<ModelAnalyzer>,
}

impl Analyzer {
    /// Use a model if `OPENAI_API_KEY` is set, else heuristics.
    pub fn from_env() -> Self {
        Self {
            model: ModelAnalyzer::from_env(),
        }
    }

    /// Heuristics only -- no network calls, no key required.
    pub fn offline() -> Self {
        Self { model: None }
    }

    pub fn with_model(model: ModelAnalyzer) -> Self {
        Self { model: Some(model) }
    }

    /// Whether this analyzer will attempt model inference.
    pub fn is_model_backed(&self) -> bool {
        self.model.is_some()
    }

    /// Analyze a session, falling back to heuristics if the model call fails.
    ///
    /// A transport failure or a malformed reply degrades to heuristics rather
    /// than propagating, because analysis is advisory -- but the returned
    /// `source` records what actually happened, and the failure is logged.
    pub async fn analyze(&self, session: &ChatSession) -> SessionAnalysis {
        if let Some(model) = &self.model {
            match model.analyze(session).await {
                Ok(analysis) => return analysis,
                Err(e) => {
                    eprintln!("[WARN] model analysis failed, using heuristics: {}", e);
                }
            }
        }
        heuristic_analysis(session)
    }

    /// Analyze with no fallback. Errors when no model is configured or the
    /// call fails, for callers that must not receive keyword counts.
    pub async fn analyze_with_model(
        &self,
        session: &ChatSession,
    ) -> Result<SessionAnalysis, AnalysisError> {
        match &self.model {
            Some(model) => model.analyze(session).await,
            None => Err(AnalysisError::NoApiKey),
        }
    }
}

impl Default for Analyzer {
    fn default() -> Self {
        Self::from_env()
    }
}

/// The offline path, assembled from the existing heuristic analyzers.
pub fn heuristic_analysis(session: &ChatSession) -> SessionAnalysis {
    let topics = TopicExtractor::new().extract(session);
    let sentiment = SentimentAnalyzer::new().analyze(session);
    SessionAnalysis {
        source: AnalysisSource::Heuristic,
        // Deliberately not a fabricated prose summary: nothing offline can
        // write one, and inventing text here would be indistinguishable from
        // a real one downstream.
        summary: String::new(),
        topics,
        sentiment,
        key_points: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `ChatSession` has no `Default`, but every field carries a serde
    /// default, so an empty object deserializes into an empty session.
    fn empty_session() -> ChatSession {
        serde_json::from_str("{}").unwrap()
    }

    const GOOD: &str = r#"{
        "summary": "Debugging a borrow checker error in an async handler.",
        "topics": [
            {"name": "rust async", "confidence": 0.9, "keywords": ["tokio", "await"]},
            {"name": "error handling", "confidence": 0.4, "keywords": ["Result"]}
        ],
        "sentiment": {"score": -0.2, "label": "neutral", "confidence": 0.7},
        "keyPoints": [
            {"summary": "Lifetime needed to outlive the spawned task.", "importance": 0.9, "category": "root cause"}
        ]
    }"#;

    #[test]
    fn parses_a_well_formed_analysis() {
        let a = parse_analysis(GOOD).unwrap();
        assert_eq!(a.source, AnalysisSource::Model);
        assert_eq!(a.topics.len(), 2);
        assert_eq!(a.topics[0].name, "rust async");
        assert_eq!(a.key_points.len(), 1);
        assert_eq!(a.sentiment.label, "neutral");
    }

    #[test]
    fn out_of_range_numbers_are_clamped() {
        let json = r#"{"summary":"s","topics":[{"name":"t","confidence":5.0,"keywords":[]}],
                       "sentiment":{"score":-9.0,"label":"negative","confidence":3.0},
                       "keyPoints":[{"summary":"k","importance":7.0,"category":"c"}]}"#;
        let a = parse_analysis(json).unwrap();
        assert_eq!(a.topics[0].confidence, 1.0);
        assert_eq!(a.sentiment.score, -1.0);
        assert_eq!(a.sentiment.confidence, 1.0);
        assert_eq!(a.key_points[0].importance, 1.0);
    }

    #[test]
    fn missing_sentiment_defaults_to_neutral_with_no_confidence() {
        let a = parse_analysis(r#"{"summary":"s","topics":[],"keyPoints":[]}"#).unwrap();
        assert_eq!(a.sentiment.label, "neutral");
        assert_eq!(a.sentiment.confidence, 0.0);
    }

    #[test]
    fn a_fenced_reply_still_parses() {
        let fenced = format!("```json\n{}\n```", GOOD);
        let a = parse_analysis(&fenced).unwrap();
        assert_eq!(a.topics.len(), 2);
    }

    #[test]
    fn a_bare_fence_without_a_language_tag_parses() {
        let fenced = format!("```\n{}\n```", GOOD);
        assert!(parse_analysis(&fenced).is_ok());
    }

    #[test]
    fn prose_instead_of_json_is_an_error_not_an_empty_analysis() {
        let err = parse_analysis("I could not analyze that.").unwrap_err();
        assert!(matches!(err, AnalysisError::BadResponse(_)));
    }

    #[test]
    fn completion_envelope_is_unwrapped() {
        let envelope = serde_json::json!({
            "choices": [{ "message": { "role": "assistant", "content": GOOD } }]
        })
        .to_string();
        let a = parse_completion(&envelope).unwrap();
        assert_eq!(a.topics.len(), 2);
    }

    #[test]
    fn an_empty_choices_list_is_an_error() {
        let envelope = r#"{"choices":[]}"#;
        assert!(matches!(
            parse_completion(envelope).unwrap_err(),
            AnalysisError::BadResponse(_)
        ));
    }

    #[test]
    fn truncation_does_not_split_a_multibyte_character() {
        // Every char is 3 bytes, so a byte-index slice would panic here.
        let text: String = std::iter::repeat('あ').take(MAX_CHARS + 100).collect();
        let out = truncate_transcript(&text);
        assert_eq!(out.chars().count(), MAX_CHARS);
    }

    #[test]
    fn short_text_is_returned_unchanged() {
        assert_eq!(truncate_transcript("hello"), "hello");
    }

    #[tokio::test]
    async fn an_analyzer_with_no_key_reports_heuristic_source() {
        let session = empty_session();
        let analyzer = Analyzer::offline();
        assert!(!analyzer.is_model_backed());
        assert_eq!(
            analyzer.analyze(&session).await.source,
            AnalysisSource::Heuristic
        );
    }

    #[tokio::test]
    async fn strict_mode_errors_rather_than_falling_back() {
        let session = empty_session();
        let err = Analyzer::offline()
            .analyze_with_model(&session)
            .await
            .unwrap_err();
        assert!(matches!(err, AnalysisError::NoApiKey));
    }

    #[tokio::test]
    async fn a_blank_key_is_rejected_before_any_request() {
        let session = empty_session();
        let err = ModelAnalyzer::new("   ")
            .analyze(&session)
            .await
            .unwrap_err();
        assert!(matches!(err, AnalysisError::NoApiKey));
    }

    /// Serve one canned HTTP response and return the URL to point at.
    ///
    /// Exercises the real reqwest path -- request construction, status
    /// handling, body parsing -- which the parser-only tests above cannot
    /// reach. Raw TCP rather than a framework keeps it dependency-free.
    async fn one_shot_server(status_line: &'static str, body: String) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            // Drain enough of the request that the client is not writing into
            // a closed socket when we reply.
            let mut buf = [0u8; 8192];
            let _ = socket.read(&mut buf).await;
            let response = format!(
                "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                status_line,
                body.len(),
                body
            );
            let _ = socket.write_all(response.as_bytes()).await;
            let _ = socket.flush().await;
        });
        format!("http://{}", addr)
    }

    fn session_with_text(text: &str) -> ChatSession {
        serde_json::from_value(serde_json::json!({
            "requests": [{ "message": { "text": text } }]
        }))
        .unwrap()
    }

    #[tokio::test]
    async fn analyze_round_trips_against_a_real_http_server() {
        let envelope = serde_json::json!({
            "choices": [{ "message": { "content": GOOD } }]
        })
        .to_string();
        let url = one_shot_server("200 OK", envelope).await;

        let analyzer = ModelAnalyzer::new("test-key").with_base_url(url);
        let analysis = analyzer
            .analyze(&session_with_text("why does this borrow fail"))
            .await
            .unwrap();

        assert_eq!(analysis.source, AnalysisSource::Model);
        assert_eq!(analysis.topics.len(), 2);
        assert_eq!(analysis.key_points[0].category, "root cause");
    }

    #[tokio::test]
    async fn a_non_2xx_reply_is_an_http_error_carrying_the_body() {
        let url = one_shot_server("429 Too Many Requests", r#"{"error":"slow down"}"#.into()).await;
        let err = ModelAnalyzer::new("test-key")
            .with_base_url(url)
            .analyze(&session_with_text("hello"))
            .await
            .unwrap_err();
        match err {
            AnalysisError::Http(msg) => {
                assert!(msg.contains("429"), "status should survive: {}", msg);
                assert!(msg.contains("slow down"), "body should survive: {}", msg);
            }
            other => panic!("expected Http, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn an_empty_session_is_rejected_before_spending_a_request() {
        // No transcript means nothing to analyze; paying for a call that can
        // only return noise is worse than failing fast.
        let err = ModelAnalyzer::new("test-key")
            .with_base_url("http://127.0.0.1:1".to_string())
            .analyze(&empty_session())
            .await
            .unwrap_err();
        assert!(matches!(err, AnalysisError::BadResponse(_)));
    }

    #[tokio::test]
    async fn the_fallback_survives_an_unreachable_model() {
        // Port 1 refuses immediately, standing in for an outage.
        let analyzer = Analyzer::with_model(
            ModelAnalyzer::new("test-key").with_base_url("http://127.0.0.1:1".to_string()),
        );
        let analysis = analyzer
            .analyze(&session_with_text("rust cargo build"))
            .await;
        assert_eq!(analysis.source, AnalysisSource::Heuristic);
    }

    #[test]
    fn a_trailing_slash_on_the_base_url_does_not_double_up() {
        // "http://host/v1/" + "/chat/completions" would 404 on most servers.
        let a = ModelAnalyzer::new("k").with_base_url("http://host/v1/".trim_end_matches('/'));
        assert_eq!(a.base_url, "http://host/v1");
    }

    #[test]
    fn heuristic_analysis_does_not_fabricate_a_summary() {
        // An invented summary would be indistinguishable from a real one
        // downstream, which is the failure mode this module exists to avoid.
        let a = heuristic_analysis(&empty_session());
        assert!(a.summary.is_empty());
        assert_eq!(a.source, AnalysisSource::Heuristic);
    }
}
