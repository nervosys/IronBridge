// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Research papers (`/api/research`)
//!
//! Searches arXiv, and keeps a list of the papers the user saved.
//!
//! # Fields are what arXiv publishes
//!
//! The pages this replaces showed each paper with a citation count, a view
//! count, a comment count, a star count and a "trend score", and ranked a
//! leaderboard by them.
//!
//! **arXiv's API reports none of those.** An entry carries a title, authors, an
//! abstract, categories, publication and update dates, and links. That is the
//! whole of it. The five engagement figures had no source anywhere -- not in
//! arXiv, not in this codebase -- so they are gone rather than estimated from
//! recency or filled with zeroes, either of which reads as a measurement.
//!
//! What *is* real and now shown: `totalResults`, which arXiv reports per query,
//! so "10 of 176,736" is distinguishable from "10, and that is all there is".
//!
//! # Saved papers are ours; everything else is arXiv's
//!
//! Saving is the one thing this server can honestly own, so it does: a small
//! table keyed by arXiv id. The mobile screen's bookmark used to flip a field
//! in component state that was discarded on unmount -- it looked like it
//! saved, and nothing was saved.
//!
//! # Not a caller-supplied URL
//!
//! The host is compiled in and the caller controls only the query. arXiv also
//! asks that clients identify themselves and not hammer the endpoint, so a
//! descriptive User-Agent is sent and the page size is capped.

use actix_web::{web, HttpResponse};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::state::AppState;

type State = web::Data<AppState>;

/// The only host this module talks to.
const ARXIV: &str = "https://export.arxiv.org/api/query";

/// arXiv asks that automated clients identify themselves.
const USER_AGENT: &str = concat!(
    "chasm/",
    env!("CARGO_PKG_VERSION"),
    " (+https://arxiv.org/help/api)"
);

const DEFAULT_LIMIT: usize = 20;

/// arXiv's guidance is to keep pages modest and slow down, so this is well
/// under what the endpoint would allow.
const MAX_LIMIT: usize = 50;

// =============================================================================
// Schema
// =============================================================================

fn init_research_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS saved_papers (
            arxiv_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            authors TEXT NOT NULL,
            summary TEXT NOT NULL,
            categories TEXT NOT NULL,
            published TEXT NOT NULL,
            url TEXT NOT NULL,
            saved_at INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

// =============================================================================
// Wire types
// =============================================================================

/// One arXiv entry, in the shape the clients render.
///
/// There is deliberately no `citations`, `views`, `comments`, `stars` or
/// `trendScore`. arXiv reports none of them.
#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Paper {
    /// arXiv identifier, e.g. `2201.00978v1`.
    pub arxiv_id: String,
    pub title: String,
    pub authors: Vec<String>,
    /// The abstract, as arXiv formats it -- hard-wrapped, with newlines.
    pub summary: String,
    pub categories: Vec<String>,
    /// ISO-8601, straight from the feed.
    pub published: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<String>,
    /// The abstract page.
    pub url: String,
    /// The PDF, when the entry links one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_url: Option<String>,
    /// The authors' own note, e.g. "Accepted at NeurIPS 2025". Often absent.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub limit: Option<usize>,
    pub start: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePaperRequest {
    pub paper: Paper,
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

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// arXiv wraps abstracts and titles at the source, so they arrive with
/// newlines and runs of spaces mid-sentence. Collapsed here rather than in
/// each client, which would otherwise each need the same fix.
fn tidy(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Pull the bare arXiv id out of the entry's id URL.
///
/// The feed gives `http://arxiv.org/abs/2201.00978v1`; the id is the last
/// segment. Returned as-is when it does not look like that, so an unexpected
/// shape degrades to something still usable rather than to an empty string.
fn arxiv_id_from(url: &str) -> String {
    url.rsplit('/').next().unwrap_or(url).to_string()
}

/// Parse an arXiv Atom feed into papers and the total match count.
///
/// Split out so every branch is reachable from a test: the alternative is a
/// live call to a third party that cannot be made to misbehave on demand.
pub(crate) fn parse_feed(xml: &str) -> Result<(Vec<Paper>, i64), String> {
    let doc = roxmltree::Document::parse(xml)
        .map_err(|e| format!("arXiv returned XML that would not parse: {e}"))?;

    let total = doc
        .descendants()
        .find(|n| n.has_tag_name("totalResults"))
        .and_then(|n| n.text())
        .and_then(|t| t.trim().parse::<i64>().ok())
        .unwrap_or(0);

    let papers = doc
        .descendants()
        .filter(|n| n.has_tag_name("entry"))
        .filter_map(|entry| {
            let child_text = |tag: &str| {
                entry
                    .children()
                    .find(|c| c.has_tag_name(tag))
                    .and_then(|c| c.text())
                    .map(tidy)
                    .filter(|s| !s.is_empty())
            };

            let id_url = child_text("id")?;

            // `link rel="alternate"` is the abstract page; the PDF is the one
            // titled "pdf". Selected by attribute rather than by position,
            // which the feed does not guarantee.
            let link_with = |predicate: &dyn Fn(&roxmltree::Node) -> bool| {
                entry
                    .children()
                    .find(|c| c.has_tag_name("link") && predicate(c))
                    .and_then(|c| c.attribute("href"))
                    .map(str::to_string)
            };

            Some(Paper {
                arxiv_id: arxiv_id_from(&id_url),
                title: child_text("title")?,
                authors: entry
                    .children()
                    .filter(|c| c.has_tag_name("author"))
                    .filter_map(|a| {
                        a.children()
                            .find(|n| n.has_tag_name("name"))
                            .and_then(|n| n.text())
                            .map(tidy)
                    })
                    .collect(),
                summary: child_text("summary").unwrap_or_default(),
                categories: entry
                    .children()
                    .filter(|c| c.has_tag_name("category"))
                    .filter_map(|c| c.attribute("term").map(str::to_string))
                    .collect(),
                published: child_text("published").unwrap_or_default(),
                updated: child_text("updated"),
                url: link_with(&|c| c.attribute("rel") == Some("alternate"))
                    .unwrap_or_else(|| id_url.clone()),
                pdf_url: link_with(&|c| c.attribute("title") == Some("pdf")),
                comment: child_text("comment"),
            })
        })
        .collect();

    Ok((papers, total))
}

// =============================================================================
// Handlers
// =============================================================================

/// Search arXiv.
///
/// An unreachable arXiv is a 502, never an empty list: "arXiv is down" and
/// "nothing matched" are different answers that an empty list cannot tell
/// apart.
pub async fn search_papers(query: web::Query<SearchQuery>) -> HttpResponse {
    let q = query.q.clone().unwrap_or_default();
    if q.trim().is_empty() {
        return fail(
            actix_web::http::StatusCode::BAD_REQUEST,
            "q is required, e.g. `q=retrieval augmented generation`",
        );
    }
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let start = query.start.unwrap_or(0).min(10_000);

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .user_agent(USER_AGENT)
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return fail(
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("HTTP client error: {e}"),
            )
        }
    };

    // `all:` searches every field. The query goes through reqwest's encoder
    // rather than into a format string, and the host is compiled in.
    let response = client
        .get(ARXIV)
        .query(&[
            ("search_query", format!("all:{}", q.trim())),
            ("start", start.to_string()),
            ("max_results", limit.to_string()),
            ("sortBy", "relevance".to_string()),
            ("sortOrder", "descending".to_string()),
        ])
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(e) => {
            return fail(
                actix_web::http::StatusCode::BAD_GATEWAY,
                format!("Could not reach arXiv: {e}"),
            )
        }
    };

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return fail(
            actix_web::http::StatusCode::BAD_GATEWAY,
            format!("arXiv returned {status}."),
        );
    }

    match parse_feed(&body) {
        Ok((papers, total)) => ok(json!({
            "query": q.trim(),
            "source": "arxiv",
            // arXiv's own count for the query, so a page of 20 out of 176,736
            // is distinguishable from 20 and no more.
            "totalResults": total,
            "start": start,
            "results": papers,
        })),
        Err(message) => fail(actix_web::http::StatusCode::BAD_GATEWAY, message),
    }
}

/// The papers the user saved, most recent first.
pub async fn list_saved_papers(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    if let Err(e) = init_research_tables(&db.conn) {
        return db_error(e);
    }

    let result: rusqlite::Result<Vec<Paper>> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT arxiv_id, title, authors, summary, categories, published, url
             FROM saved_papers ORDER BY saved_at DESC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                let authors: String = row.get(2)?;
                let categories: String = row.get(4)?;
                Ok(Paper {
                    arxiv_id: row.get(0)?,
                    title: row.get(1)?,
                    // Stored as JSON so a name containing a comma survives.
                    authors: serde_json::from_str(&authors).unwrap_or_default(),
                    summary: row.get(3)?,
                    categories: serde_json::from_str(&categories).unwrap_or_default(),
                    published: row.get(5)?,
                    updated: None,
                    url: row.get(6)?,
                    pdf_url: None,
                    comment: None,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })();

    match result {
        Ok(papers) => ok(papers),
        Err(e) => db_error(e),
    }
}

/// Save a paper.
///
/// Idempotent: saving one twice is what a client does when it is unsure, and
/// a second save is not an error worth reporting.
pub async fn save_paper(state: State, body: web::Json<SavePaperRequest>) -> HttpResponse {
    let paper = body.into_inner().paper;

    if paper.arxiv_id.trim().is_empty() {
        return fail(
            actix_web::http::StatusCode::BAD_REQUEST,
            "paper.arxivId is required",
        );
    }

    let db = state.db.lock().unwrap();
    if let Err(e) = init_research_tables(&db.conn) {
        return db_error(e);
    }

    let result = db.conn.execute(
        "INSERT INTO saved_papers
         (arxiv_id, title, authors, summary, categories, published, url, saved_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(arxiv_id) DO UPDATE SET
           title=?2, authors=?3, summary=?4, categories=?5, published=?6, url=?7",
        params![
            paper.arxiv_id.trim(),
            paper.title,
            serde_json::to_string(&paper.authors).unwrap_or_else(|_| "[]".into()),
            paper.summary,
            serde_json::to_string(&paper.categories).unwrap_or_else(|_| "[]".into()),
            paper.published,
            paper.url,
            now_ms(),
        ],
    );

    match result {
        Ok(_) => ok(json!({ "saved": true, "arxivId": paper.arxiv_id.trim() })),
        Err(e) => db_error(e),
    }
}

pub async fn unsave_paper(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();
    if let Err(e) = init_research_tables(&db.conn) {
        return db_error(e);
    }

    match db
        .conn
        .execute("DELETE FROM saved_papers WHERE arxiv_id = ?1", params![id])
    {
        Ok(0) => fail(
            actix_web::http::StatusCode::NOT_FOUND,
            "That paper is not saved",
        ),
        Ok(_) => ok(json!({ "deleted": true })),
        Err(e) => db_error(e),
    }
}

pub fn configure_research_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/research")
            .route("/papers", web::get().to(search_papers))
            // Before `/saved/{id}`, so the literal is not captured as an id.
            .route("/saved", web::get().to(list_saved_papers))
            .route("/saved", web::post().to(save_paper))
            .route("/saved/{id}", web::delete().to(unsave_paper)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};
    use std::path::PathBuf;

    /// A real feed, trimmed, captured from arXiv on 2026-08-26.
    ///
    /// Kept verbatim so the parser is tested against what arXiv sends rather
    /// than what this module wishes it sent.
    const FEED: &str = r#"<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"
      xmlns:arxiv="http://arxiv.org/schemas/atom"
      xmlns="http://www.w3.org/2005/Atom">
  <title>arXiv Query</title>
  <opensearch:itemsPerPage>2</opensearch:itemsPerPage>
  <opensearch:totalResults>176736</opensearch:totalResults>
  <opensearch:startIndex>0</opensearch:startIndex>
  <entry>
    <id>http://arxiv.org/abs/2201.00978v1</id>
    <title>PyramidTNT: Improved Transformer-in-Transformer
  Baselines with Pyramid Architecture</title>
    <updated>2022-01-04T04:56:57Z</updated>
    <link href="https://arxiv.org/abs/2201.00978v1" rel="alternate" type="text/html"/>
    <link href="https://arxiv.org/pdf/2201.00978v1" rel="related" type="application/pdf" title="pdf"/>
    <summary>Transformer networks have achieved
  great progress.</summary>
    <category term="cs.CV" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <published>2022-01-04T04:56:57Z</published>
    <arxiv:comment>Tech Report.</arxiv:comment>
    <arxiv:primary_category term="cs.CV"/>
    <author><name>Kai Han</name></author>
    <author><name>Jianyuan Guo</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/1706.03762v7</id>
    <title>Attention Is All You Need</title>
    <link href="https://arxiv.org/abs/1706.03762v7" rel="alternate" type="text/html"/>
    <summary>The dominant sequence transduction models.</summary>
    <published>2017-06-12T17:57:34Z</published>
    <author><name>Ashish Vaswani</name></author>
  </entry>
</feed>"#;

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
                    .configure(configure_research_routes),
            )
            .await
        };
    }

    async fn body_json(resp: actix_web::dev::ServiceResponse) -> serde_json::Value {
        serde_json::from_slice(&test::read_body(resp).await).expect("json body")
    }

    #[test]
    fn a_real_feed_parses_into_papers_and_a_total() {
        let (papers, total) = parse_feed(FEED).expect("parses");
        assert_eq!(total, 176_736);
        assert_eq!(papers.len(), 2);

        let first = &papers[0];
        assert_eq!(first.arxiv_id, "2201.00978v1");
        assert_eq!(first.authors, vec!["Kai Han", "Jianyuan Guo"]);
        assert_eq!(first.categories, vec!["cs.CV", "cs.LG"]);
        assert_eq!(first.published, "2022-01-04T04:56:57Z");
        assert_eq!(first.url, "https://arxiv.org/abs/2201.00978v1");
        assert_eq!(
            first.pdf_url.as_deref(),
            Some("https://arxiv.org/pdf/2201.00978v1")
        );
        assert_eq!(first.comment.as_deref(), Some("Tech Report."));
    }

    /// arXiv hard-wraps titles and abstracts; the newlines must not survive.
    #[test]
    fn wrapped_text_is_collapsed_to_single_spaces() {
        let (papers, _) = parse_feed(FEED).expect("parses");
        assert_eq!(
            papers[0].title,
            "PyramidTNT: Improved Transformer-in-Transformer Baselines with Pyramid Architecture"
        );
        assert_eq!(
            papers[0].summary,
            "Transformer networks have achieved great progress."
        );
        assert!(!papers[0].title.contains('\n'));
    }

    /// An entry missing the optional parts still parses.
    #[test]
    fn an_entry_without_a_pdf_or_comment_still_parses() {
        let (papers, _) = parse_feed(FEED).expect("parses");
        let second = &papers[1];
        assert_eq!(second.arxiv_id, "1706.03762v7");
        assert_eq!(second.pdf_url, None);
        assert_eq!(second.comment, None);
        assert_eq!(second.updated, None);
        assert!(second.categories.is_empty());
    }

    /// The engagement figures the old pages showed must not reappear.
    ///
    /// arXiv reports none of them. Asserted on the serialised shape, which is
    /// what a client could read.
    #[test]
    fn the_serialised_paper_has_no_citations_views_or_stars() {
        let (papers, _) = parse_feed(FEED).expect("parses");
        let value = serde_json::to_value(&papers[0]).expect("serialise");
        let keys: Vec<&String> = value.as_object().expect("object").keys().collect();

        for invented in [
            "citations",
            "views",
            "comments",
            "stars",
            "trendScore",
            "trend",
        ] {
            assert!(
                !keys.iter().any(|k| k.as_str() == invented),
                "`{invented}` is back in the paper shape: {keys:?}"
            );
        }
    }

    #[test]
    fn a_body_that_is_not_xml_is_an_error() {
        let err = parse_feed("<html>down for maintenance").expect_err("should fail");
        assert!(err.contains("would not parse"), "{err}");
    }

    /// A feed with no entries is a real answer, not a failure.
    #[test]
    fn an_empty_feed_is_success_with_no_papers() {
        let empty = r#"<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns="http://www.w3.org/2005/Atom">
  <opensearch:totalResults>0</opensearch:totalResults>
</feed>"#;
        let (papers, total) = parse_feed(empty).expect("parses");
        assert!(papers.is_empty());
        assert_eq!(total, 0);
    }

    #[test]
    fn an_id_url_reduces_to_the_bare_arxiv_id() {
        assert_eq!(
            arxiv_id_from("http://arxiv.org/abs/2201.00978v1"),
            "2201.00978v1"
        );
        assert_eq!(arxiv_id_from("2201.00978"), "2201.00978");
    }

    #[tokio::test]
    async fn a_search_without_a_query_is_rejected_before_arxiv_is_touched() {
        let (state, _dir) = temp_state("rs-noq");
        let app = app!(&state);
        for uri in ["/api/research/papers", "/api/research/papers?q=%20"] {
            let resp =
                test::call_service(&app, test::TestRequest::get().uri(uri).to_request()).await;
            assert_eq!(resp.status(), 400, "{uri}");
        }
    }

    #[tokio::test]
    async fn saved_papers_work_before_anything_is_saved() {
        let (state, _dir) = temp_state("rs-empty");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/research/saved")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);
        assert_eq!(
            body_json(resp).await["data"].as_array().map(|a| a.len()),
            Some(0)
        );
    }

    /// Saving persists, which is the whole point: the bookmark it replaces
    /// flipped a field in component state and lost it on unmount.
    #[tokio::test]
    async fn a_saved_paper_survives_and_round_trips() {
        let (state, _dir) = temp_state("rs-save");
        let (papers, _) = parse_feed(FEED).expect("parses");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/research/saved")
                .set_json(json!({ "paper": papers[0] }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/research/saved")
                .to_request(),
        )
        .await;
        let body = body_json(resp).await;
        let saved = body["data"].as_array().expect("array");
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0]["arxivId"], "2201.00978v1");
        // Authors survive as a list, not a joined string -- a name with a
        // comma in it would not come back from that.
        assert_eq!(
            saved[0]["authors"].as_array().map(|a| a.len()),
            Some(2),
            "{body}"
        );
        assert_eq!(saved[0]["categories"].as_array().map(|a| a.len()), Some(2));
    }

    /// Saving twice is what an unsure client does, and is not an error.
    #[tokio::test]
    async fn saving_the_same_paper_twice_is_idempotent() {
        let (state, _dir) = temp_state("rs-twice");
        let (papers, _) = parse_feed(FEED).expect("parses");
        let app = app!(&state);

        for _ in 0..2 {
            let resp = test::call_service(
                &app,
                test::TestRequest::post()
                    .uri("/api/research/saved")
                    .set_json(json!({ "paper": papers[0] }))
                    .to_request(),
            )
            .await;
            assert_eq!(resp.status(), 200);
        }

        let db = state.db.lock().unwrap();
        let count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM saved_papers", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn unsaving_a_paper_that_is_not_saved_is_a_404() {
        let (state, _dir) = temp_state("rs-404");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri("/api/research/saved/nope")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 404);
    }

    /// `/saved` must not be captured by a `{id}` route.
    #[tokio::test]
    async fn the_saved_listing_is_not_captured_as_an_id() {
        let (state, _dir) = temp_state("rs-shadow");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/research/saved")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);
        assert!(body_json(resp).await["data"].is_array());
    }
}
