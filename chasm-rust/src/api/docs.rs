// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
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
        use crate::api::{configure_inbox_routes, AppState};
        use crate::ChatDatabase;
        use actix_web::web::Data;

        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("spec-routes.db");
        let db = ChatDatabase::open(&db_path).expect("open db");
        let state = Data::new(AppState::new(db, db_path));

        let app = test::init_service(
            App::new()
                .app_data(state)
                .configure(configure_inbox_routes)
                .configure(super::super::configure_routes)
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
        for (path, item) in paths {
            // Path parameters match any value, so the placeholder only has to
            // be non-empty -- routing does not care whether the record exists.
            let concrete = substitute_params(path);
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
                let uri = format!("/api{concrete}");
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
}
