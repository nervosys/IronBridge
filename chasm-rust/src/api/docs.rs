// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! OpenAPI documentation module
//!
//! Serves the OpenAPI specification and Swagger UI.

use actix_web::{web, HttpResponse, Responder};

/// OpenAPI specification as YAML
const OPENAPI_YAML: &str = include_str!("../../openapi.yaml");

/// The copy MkDocs publishes. Embedded only so a test can assert it matches
/// the spec this server actually serves -- the two drifted once already, and
/// the published docs spent a release advertising a base URL that 404'd.
#[cfg(test)]
const OPENAPI_YAML_DOCS_COPY: &str = include_str!("../../docs/assets/openapi.yaml");

/// Get OpenAPI specification (YAML)
pub async fn openapi_yaml() -> impl Responder {
    HttpResponse::Ok()
        .content_type("application/yaml")
        .body(OPENAPI_YAML)
}

/// Get OpenAPI specification (JSON)
pub async fn openapi_json() -> impl Responder {
    // Parse YAML and convert to JSON
    match serde_yaml_to_json(OPENAPI_YAML) {
        Ok(json) => HttpResponse::Ok()
            .content_type("application/json")
            .body(json),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error: {}", e)),
    }
}

/// Swagger UI HTML page
pub async fn swagger_ui() -> impl Responder {
    HttpResponse::Ok()
        .content_type("text/html")
        .body(SWAGGER_UI_HTML)
}

/// Convert YAML to JSON string
fn serde_yaml_to_json(yaml: &str) -> Result<String, String> {
    // Simple YAML to JSON conversion using serde_json
    let value: serde_json::Value =
        serde_yaml::from_str(yaml).map_err(|e| format!("YAML parse error: {}", e))?;
    serde_json::to_string_pretty(&value).map_err(|e| format!("JSON serialize error: {}", e))
}

/// Configure documentation routes
pub fn configure_docs_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/docs")
            .route("", web::get().to(swagger_ui))
            .route("/", web::get().to(swagger_ui))
            .route("/openapi.yaml", web::get().to(openapi_yaml))
            .route("/openapi.json", web::get().to(openapi_json)),
    );
}

/// Embedded Swagger UI HTML
const SWAGGER_UI_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chasm API Documentation</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
    <style>
        body {
            margin: 0;
            padding: 0;
        }
        .swagger-ui .topbar {
            display: none;
        }
        .swagger-ui .info {
            margin: 20px 0;
        }
        .swagger-ui .info .title {
            color: #3b4151;
        }
        .swagger-ui .info hgroup.main {
            margin: 0;
        }
        .custom-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 40px;
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .custom-header h1 {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 24px;
            font-weight: 600;
        }
        .custom-header .version {
            background: rgba(255,255,255,0.2);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 14px;
        }
        .custom-header a {
            color: white;
            text-decoration: none;
            margin-left: auto;
            opacity: 0.9;
        }
        .custom-header a:hover {
            opacity: 1;
        }
    </style>
</head>
<body>
    <div class="custom-header">
        <h1>🔗 Chasm API</h1>
        <span class="version">v2.0.0</span>
        <a href="https://github.com/nervosys/chasm" target="_blank">GitHub →</a>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: "/docs/openapi.yaml",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout",
                defaultModelsExpandDepth: 1,
                docExpansion: "list",
                filter: true,
                showExtensions: true,
                showCommonExtensions: true,
                syntaxHighlight: {
                    theme: "monokai"
                }
            });
        };
    </script>
</body>
</html>
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{http::StatusCode, test, App};

    /// Returned by the test app's default service. Any request answered with
    /// this reached no route at all, which is what distinguishes an unrouted
    /// path from a handler that legitimately answers 404 for a missing record.
    /// This server returns 404 for a method mismatch too, so status alone
    /// cannot tell those apart -- hence the sentinel.
    const UNROUTED: StatusCode = StatusCode::IM_A_TEAPOT;

    fn spec() -> serde_json::Value {
        serde_yaml::from_str(OPENAPI_YAML).expect("openapi.yaml must parse")
    }

    #[test]
    fn spec_parses_as_yaml_and_converts_to_json() {
        let json = serde_yaml_to_json(OPENAPI_YAML).expect("spec must convert to JSON");
        assert!(json.contains("\"openapi\""));
    }

    #[test]
    fn published_docs_copy_matches_the_served_spec() {
        assert_eq!(
            OPENAPI_YAML, OPENAPI_YAML_DOCS_COPY,
            "docs/assets/openapi.yaml has drifted from openapi.yaml; \
             copy the root spec over it so the published docs match the server"
        );
    }

    #[test]
    fn every_ref_in_the_spec_resolves() {
        let spec = spec();
        let mut refs = Vec::new();
        collect_refs(&spec, &mut refs);
        assert!(!refs.is_empty(), "expected the spec to use $ref");

        for r in refs {
            let pointer = r.trim_start_matches('#');
            assert!(
                spec.pointer(pointer).is_some(),
                "dangling $ref in openapi.yaml: {r}"
            );
        }
    }

    fn collect_refs(value: &serde_json::Value, out: &mut Vec<String>) {
        match value {
            serde_json::Value::Object(map) => {
                for (k, v) in map {
                    if k == "$ref" {
                        if let Some(s) = v.as_str() {
                            out.push(s.to_string());
                        }
                    } else {
                        collect_refs(v, out);
                    }
                }
            }
            serde_json::Value::Array(items) => items.iter().for_each(|v| collect_refs(v, out)),
            _ => {}
        }
    }

    /// Every path in the spec must resolve to a real route.
    ///
    /// This is the guard that was missing: `openapi.yaml` accumulated twenty
    /// documented-but-unimplemented paths, so a generated client compiled and
    /// then 404'd on every call to them.
    #[tokio::test]
    async fn every_documented_path_is_actually_routed() {
        use crate::api::{configure_document_routes, configure_inbox_routes, AppState};
        use crate::ChatDatabase;
        use actix_web::web::Data;

        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("spec-routes.db");
        let db = ChatDatabase::open(&db_path).expect("open db");
        let state = Data::new(AppState::new(db, db_path));

        // The root-mounted scopes must be here too, or every path carrying a
        // `servers` override would be reported unrouted -- a failure of the
        // harness rather than of the spec.
        let sync_state = Data::new(super::super::create_sync_state());
        let recording_state = Data::new(super::super::create_recording_state());
        let webhook_state = Data::new(std::sync::Arc::new(super::super::WebhookState::new()));
        #[cfg(feature = "enterprise")]
        let enterprise = super::super::EnterpriseServices::open(
            &dir.path().join("spec-routes-enterprise.db"),
            "http://127.0.0.1:8787",
        )
        .expect("open enterprise store");

        let app = test::init_service(
            App::new()
                .app_data(state)
                .app_data(sync_state)
                .app_data(recording_state)
                .configure(configure_inbox_routes)
                .configure(configure_document_routes)
                .configure(super::super::configure_routes)
                .configure(super::super::configure_sync_routes)
                .configure(super::super::configure_auth_routes)
                .configure(super::super::configure_recording_routes)
                .configure(move |cfg| {
                    super::super::configure_webhook_routes(cfg, webhook_state.clone())
                })
                // Through the same call `start_server` uses, deliberately.
                // This harness used to mount the enterprise scopes itself,
                // and because it did, the scopes were compiled, tested and
                // documented for as long as the server never served them --
                // the test passed on routes that existed nowhere else.
                .configure({
                    #[cfg(feature = "enterprise")]
                    let enterprise = enterprise.clone();
                    move |cfg: &mut actix_web::web::ServiceConfig| {
                        #[cfg(feature = "enterprise")]
                        enterprise.configure(cfg);
                        #[cfg(not(feature = "enterprise"))]
                        let _ = cfg;
                    }
                })
                .default_service(web::to(|| async { HttpResponse::ImATeapot().finish() })),
        )
        .await;

        let spec = spec();
        let paths = spec["paths"].as_object().expect("spec has paths");
        assert!(!paths.is_empty());

        // Probing a route means executing its handler -- there is no
        // match-without-invoke in actix. These do real work (a filesystem-wide
        // harvest taking minutes), so they are asserted by registration
        // instead, below, rather than by being called.
        const TOO_EXPENSIVE_TO_PROBE: &[(&str, &str)] = &[("post", "/harvest")];

        let mut unrouted = Vec::new();
        let mut skipped = Vec::new();
        let mut gated = Vec::new();
        for (path, item) in paths {
            if gated_out(item) {
                gated.push(path.clone());
                continue;
            }
            // Path parameters match any value, so the placeholder only has to
            // be non-empty -- routing does not care whether the record exists.
            let concrete = substitute_params(path);
            let prefix = mount_prefix(item);
            let methods = item.as_object().expect("path item is a map");

            for method in methods.keys() {
                if TOO_EXPENSIVE_TO_PROBE
                    .iter()
                    .any(|(m, p)| *m == method && *p == path)
                {
                    skipped.push(format!("{} {}", method.to_uppercase(), path));
                    continue;
                }
                let req = match method.as_str() {
                    "get" => test::TestRequest::get(),
                    "post" => test::TestRequest::post(),
                    "put" => test::TestRequest::put(),
                    "delete" => test::TestRequest::delete(),
                    "patch" => test::TestRequest::patch(),
                    // parameters, summary, description and friends
                    _ => continue,
                };
                let uri = format!("{prefix}{concrete}");
                let resp = test::call_service(&app, req.uri(&uri).to_request()).await;
                if resp.status() == UNROUTED {
                    unrouted.push(format!("{} {}", method.to_uppercase(), uri));
                }
            }
        }

        assert!(
            unrouted.is_empty(),
            "openapi.yaml documents paths the server does not route: {unrouted:#?}\n\
             Either implement them or remove them from the spec."
        );

        // Not silent: an endpoint excluded from the probe must still be
        // accounted for, or "the suite passed" would quietly stop meaning
        // "everything documented is reachable".
        assert_eq!(
            skipped.len(),
            TOO_EXPENSIVE_TO_PROBE.len(),
            "the skip list is stale -- it names operations the spec no longer \
             documents. Skipped: {skipped:?}"
        );
        for (method, path) in TOO_EXPENSIVE_TO_PROBE {
            assert!(
                registered_in_write_routes(method, path),
                "{} {path} is skipped by the probe but not registered either",
                method.to_uppercase()
            );
        }

        // Feature-gated paths are unprobed on this build. That is legitimate,
        // but it must not be silent: if the marking ever drifted onto a path
        // that is in fact always served, this test would quietly stop
        // covering it.
        if cfg!(feature = "enterprise") {
            assert!(
                gated.is_empty(),
                "enterprise is enabled, so nothing should be gated out: {gated:?}"
            );
        } else {
            assert!(
                gated.iter().all(|p| {
                    p.starts_with("/audit")
                        || p.starts_with("/retention")
                        || p.starts_with("/sso")
                        || p.starts_with("/oidc")
                }),
                "a path outside the enterprise scopes is marked enterprise-gated: {gated:?}"
            );
            eprintln!(
                "[spec] {} enterprise paths unprobed on this build; \
                 run with --features enterprise to cover them",
                gated.len()
            );
        }
    }

    /// Registration check for the handful of routes the probe cannot call.
    ///
    /// Reads the source rather than the router because actix exposes no route
    /// introspection; it is weaker than an actual request, which is exactly why
    /// the skip list is kept to one entry.
    fn registered_in_write_routes(method: &str, path: &str) -> bool {
        const SOURCE: &str = include_str!("handlers_write.rs");
        let needle = format!("\"{path}\", web::{method}()");
        SOURCE.contains(&needle)
    }

    /// True when a path is behind a Cargo feature this build does not have.
    ///
    /// The enterprise scopes are `#[cfg(feature = "enterprise")]`, so a
    /// default build genuinely does not route them and probing would
    /// correctly find nothing. On an enterprise build this returns false and
    /// they are probed like everything else, which is what actually verifies
    /// them -- the marking suppresses a false failure, it does not excuse the
    /// path from ever being checked.
    fn gated_out(item: &serde_json::Value) -> bool {
        item.get("x-chasm-feature").and_then(|f| f.as_str()) == Some("enterprise")
            && !cfg!(feature = "enterprise")
    }

    /// Where a documented path is actually mounted.
    ///
    /// The document's base URL ends in `/api`, but `/auth`, `/sync`,
    /// `/recording` and `/webhooks` are registered on the App rather than
    /// inside the `/api` scope. Those carry a path-level `servers` override
    /// pointing at the server root, which is how OpenAPI 3 expresses a path
    /// that does not sit under the global base. Honour it here, or the probe
    /// would ask for `/api/auth/login` and correctly find nothing.
    fn mount_prefix(item: &serde_json::Value) -> &'static str {
        if item.get("servers").is_some() {
            ""
        } else {
            "/api"
        }
    }

    fn substitute_params(path: &str) -> String {
        let mut out = String::with_capacity(path.len());
        let mut in_param = false;
        for c in path.chars() {
            match c {
                '{' => {
                    in_param = true;
                    out.push_str("spec-probe");
                }
                '}' => in_param = false,
                _ if in_param => {}
                _ => out.push(c),
            }
        }
        out
    }

    /// The spec's declared response body must match what the server sends.
    ///
    /// Route coverage only proves a path resolves. This proves the *body* is
    /// what the spec claims -- the failure that route coverage cannot see, and
    /// the one that breaks a generated client at deserialization rather than
    /// at the request. It was worth writing: when first run, the spec was
    /// wrong about nearly every endpoint, describing a snake_case API that
    /// returned different fields from the camelCase one that actually exists.
    ///
    /// Compares top-level property names only. Types and nested shapes are not
    /// checked; this catches wholesale drift, not every detail.
    #[tokio::test]
    async fn documented_response_bodies_match_what_the_server_sends() {
        use crate::api::{configure_document_routes, configure_inbox_routes, AppState};
        use crate::ChatDatabase;
        use actix_web::web::Data;

        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("shapes.db");
        crate::commands::create_harvest_database(&db_path).expect("harvest schema");

        // Mirror what `start_server` does. Without this the inbox tables do
        // not exist and its endpoints answer 500 -- a difference between the
        // harness and the real server, not a difference in the spec.
        {
            let conn = rusqlite::Connection::open(&db_path).expect("open conn");
            super::super::inbox::init_inbox_tables(&conn).expect("inbox tables");
            super::super::handlers_swe::init_swe_tables(&conn).expect("swe tables");
        }

        let db = ChatDatabase::open(&db_path).expect("open");
        let state = Data::new(AppState::new(db, db_path));

        let sync_state = Data::new(super::super::create_sync_state());
        let recording_state = Data::new(super::super::create_recording_state());
        let webhook_state = Data::new(std::sync::Arc::new(super::super::WebhookState::new()));
        #[cfg(feature = "enterprise")]
        let enterprise = super::super::EnterpriseServices::open(
            &dir.path().join("spec-bodies-enterprise.db"),
            "http://127.0.0.1:8787",
        )
        .expect("open enterprise store");

        let app = test::init_service(
            App::new()
                .app_data(state)
                .app_data(sync_state)
                .app_data(recording_state)
                .configure(configure_inbox_routes)
                .configure(configure_document_routes)
                .configure(super::super::configure_routes)
                .configure(super::super::configure_sync_routes)
                .configure(super::super::configure_auth_routes)
                .configure(super::super::configure_recording_routes)
                .configure(move |cfg| {
                    super::super::configure_webhook_routes(cfg, webhook_state.clone())
                })
                // The enterprise scopes document response bodies now, so this
                // test probes them -- which it can only do if they are here.
                .configure({
                    #[cfg(feature = "enterprise")]
                    let enterprise = enterprise.clone();
                    move |cfg: &mut actix_web::web::ServiceConfig| {
                        #[cfg(feature = "enterprise")]
                        enterprise.configure(cfg);
                        #[cfg(not(feature = "enterprise"))]
                        let _ = cfg;
                    }
                }),
        )
        .await;

        let spec = spec();
        let paths = spec["paths"].as_object().expect("paths");
        let mut problems = Vec::new();

        for (path, item) in paths {
            // GETs with no path parameters: everything else needs a record to
            // exist first, which would make this test a fixture factory.
            if path.contains('{') || gated_out(item) {
                continue;
            }
            let Some(op) = item.get("get") else { continue };
            let Some(schema) = op.pointer("/responses/200/content/application~1json/schema") else {
                continue;
            };

            // Supply every query parameter the spec marks required, read from
            // the spec rather than guessed from the path. A name-based rule
            // ("paths ending in search need q") silently missed
            // /search/semantic and reported its correct 400 as drift.
            let uri = format!("{}{path}{}", mount_prefix(item), required_query_string(op));
            let resp =
                test::call_service(&app, test::TestRequest::get().uri(&uri).to_request()).await;

            // An endpoint that documents a 401 and answers 401 to an
            // unauthenticated probe is behaving exactly as described. Reading
            // its success body would need a real session, which this test
            // deliberately does not build -- so its 200 shape is unverified
            // here rather than wrongly reported as drift.
            if resp.status() == StatusCode::UNAUTHORIZED && op.pointer("/responses/401").is_some() {
                continue;
            }
            // Same reasoning for an endpoint that needs a model configured and
            // says so: 503 here is the documented behaviour of a server
            // without OPENAI_API_KEY, not a spec that has drifted.
            if resp.status() == StatusCode::SERVICE_UNAVAILABLE
                && op.pointer("/responses/503").is_some()
            {
                continue;
            }
            // Some endpoints cannot reach 200 from a cold probe at all: the
            // OIDC callback consumes a single-use login state that only a real
            // browser round trip creates. Those declare it in the spec, and
            // the declaration is checked below rather than trusted -- the
            // operation must actually document the status it answers with, so
            // this cannot become a blanket excuse for any 4xx.
            if op.get("x-chasm-probe").and_then(|v| v.as_str()) == Some("needs-prior-state") {
                let documented = format!("/responses/{}", resp.status().as_u16());
                assert!(
                    op.pointer(&documented).is_some(),
                    "GET {uri} is marked needs-prior-state but answered {} , \
                     which the spec does not document",
                    resp.status()
                );
                continue;
            }
            if resp.status() != StatusCode::OK {
                problems.push(format!("GET {uri} answered {}", resp.status()));
                continue;
            }

            let body: serde_json::Value = match serde_json::from_slice(&test::read_body(resp).await)
            {
                Ok(v) => v,
                Err(e) => {
                    problems.push(format!("GET {uri} returned unparseable JSON: {e}"));
                    continue;
                }
            };

            // Unwrap the envelope only when the spec says there is one, so a
            // spec that forgets it is reported rather than silently accepted.
            let spec_enveloped = declares_envelope(&spec, schema);
            let real_enveloped = body.get("success").is_some() && body.get("data").is_some();
            if spec_enveloped != real_enveloped {
                problems.push(format!(
                    "GET {uri}: spec says {}, server sends {}",
                    if spec_enveloped { "enveloped" } else { "bare" },
                    if real_enveloped { "enveloped" } else { "bare" },
                ));
                continue;
            }

            let payload = if real_enveloped { &body["data"] } else { &body };
            let documented = declared_properties(&spec, schema, spec_enveloped);
            let (Some(documented), Some(actual)) = (documented, object_keys(payload)) else {
                continue; // array or untyped: nothing to compare
            };

            if documented != actual {
                problems.push(format!(
                    "GET {uri}\n       spec: {}\n       real: {}",
                    documented.join(","),
                    actual.join(",")
                ));
            }
        }

        assert!(
            problems.is_empty(),
            "openapi.yaml does not describe the responses the server sends:\n  {}\n\n\
             A client generated from this spec fails to deserialize these.",
            problems.join("\n  ")
        );
    }

    /// `?a=x&b=x` for the operation's required query parameters, or empty.
    ///
    /// The value does not matter -- these probes only need the request to be
    /// well-formed enough to reach the handler's success path.
    fn required_query_string(op: &serde_json::Value) -> String {
        let Some(params) = op.get("parameters").and_then(|p| p.as_array()) else {
            return String::new();
        };
        let names: Vec<&str> = params
            .iter()
            .filter(|p| {
                p.get("in").and_then(|i| i.as_str()) == Some("query")
                    && p.get("required").and_then(|r| r.as_bool()) == Some(true)
            })
            .filter_map(|p| p.get("name").and_then(|n| n.as_str()))
            .collect();
        if names.is_empty() {
            return String::new();
        }
        format!(
            "?{}",
            names
                .iter()
                .map(|n| format!("{n}=x"))
                .collect::<Vec<_>>()
                .join("&")
        )
    }

    fn object_keys(value: &serde_json::Value) -> Option<Vec<String>> {
        let map = value.as_object()?;
        let mut keys: Vec<String> = map.keys().cloned().collect();
        keys.sort();
        Some(keys)
    }

    /// Follow `$ref` one level at a time; the spec nests them only shallowly.
    fn deref<'a>(
        spec: &'a serde_json::Value,
        schema: &'a serde_json::Value,
    ) -> &'a serde_json::Value {
        let mut current = schema;
        for _ in 0..8 {
            let Some(r) = current.get("$ref").and_then(|r| r.as_str()) else {
                break;
            };
            match spec.pointer(r.trim_start_matches('#')) {
                Some(next) => current = next,
                None => break,
            }
        }
        current
    }

    /// True when the schema is the `{success, data, error}` wrapper.
    fn declares_envelope(spec: &serde_json::Value, schema: &serde_json::Value) -> bool {
        let resolved = deref(spec, schema);
        if let Some(all_of) = resolved.get("allOf").and_then(|a| a.as_array()) {
            return all_of.iter().any(|s| declares_envelope(spec, s));
        }
        resolved
            .get("properties")
            .and_then(|p| p.as_object())
            .is_some_and(|p| p.contains_key("success") && p.contains_key("data"))
    }

    /// Property names the spec declares for the payload, unwrapping the
    /// envelope's `data` when there is one.
    fn declared_properties(
        spec: &serde_json::Value,
        schema: &serde_json::Value,
        enveloped: bool,
    ) -> Option<Vec<String>> {
        let resolved = deref(spec, schema);

        // allOf: merge the members, then take `data` if we want the payload.
        if let Some(all_of) = resolved.get("allOf").and_then(|a| a.as_array()) {
            let mut merged = serde_json::Map::new();
            for member in all_of {
                if let Some(props) = deref(spec, member)
                    .get("properties")
                    .and_then(|p| p.as_object())
                {
                    for (k, v) in props {
                        merged.insert(k.clone(), v.clone());
                    }
                }
            }
            let combined = serde_json::Value::Object(
                [("properties".to_string(), serde_json::Value::Object(merged))]
                    .into_iter()
                    .collect(),
            );
            return declared_properties(spec, &combined, enveloped);
        }

        let props = resolved.get("properties")?.as_object()?;
        if enveloped {
            let data = props.get("data")?;
            let inner = deref(spec, data);
            if inner.get("type").and_then(|t| t.as_str()) == Some("array") {
                return None;
            }
            let inner_props = inner.get("properties")?.as_object()?;
            let mut keys: Vec<String> = inner_props.keys().cloned().collect();
            keys.sort();
            return Some(keys);
        }
        let mut keys: Vec<String> = props.keys().cloned().collect();
        keys.sort();
        Some(keys)
    }
}
