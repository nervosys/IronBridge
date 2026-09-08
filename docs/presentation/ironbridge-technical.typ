// IronBridge Technical Deep-Dive
// Nervosys LLC — Defense-Grade AI Session Intelligence Platform
// Defense Tech Style: Dark theme, tactical aesthetics, technical depth
// Compile: typst compile ironbridge-technical.typ ironbridge-technical.pdf

// ============================================================================
// THEME — Defense Tech / Tactical
// ============================================================================

#let primary = rgb("#00d4ff")
#let secondary = rgb("#ff6b35")
#let success = rgb("#00ff88")
#let warning = rgb("#ffd93d")
#let danger = rgb("#ff4757")

#let bg-dark = rgb("#0a0a0f")
#let bg-panel = rgb("#12121a")
#let bg-card = rgb("#1a1a25")
#let bg-code = rgb("#0d1117")

#let text-primary = rgb("#e8e8e8")
#let text-secondary = rgb("#8b8b9a")
#let text-muted = rgb("#5a5a6a")

#let grid-line = rgb("#1e1e2e")
#let border-subtle = rgb("#2a2a3a")

#let slide-counter = counter("slide")

#let classification-banner = text(size: 5.5pt, fill: text-muted, tracking: 1pt)[
  CUI // DFARS 252.227-7015 // Nervosys Proprietary // Distribution Authorized to U.S. Government Agencies Only
]

// ============================================================================
// TYPOGRAPHY
// ============================================================================

#let title-hero = text.with(
  size: 36pt,
  weight: "bold",
  tracking: 4pt,
  fill: white,
)

#let title-section = text.with(
  size: 24pt,
  weight: "bold",
  tracking: 2pt,
  fill: primary,
)

#let title-slide-fn = text.with(
  size: 18pt,
  weight: "bold",
  tracking: 1pt,
  fill: white,
)

#let label-text = text.with(
  size: 7pt,
  weight: "medium",
  tracking: 1pt,
  fill: text-muted,
)

// ============================================================================
// COMPONENTS
// ============================================================================

#let tech-card(title: none, accent-color: primary, body) = {
  rect(
    width: 100%,
    fill: bg-card,
    stroke: 1pt + accent-color.transparentize(60%),
    radius: 4pt,
    inset: 12pt,
  )[
    #if title != none [
      #text(size: 8pt, fill: accent-color, weight: "bold", tracking: 0.5pt)[#upper(title)]
      #v(6pt)
    ]
    #set text(fill: text-primary, size: 8pt)
    #body
  ]
}

#let status-badge(label, color) = {
  box(
    fill: color.transparentize(80%),
    stroke: 1pt + color.transparentize(50%),
    radius: 2pt,
    inset: (x: 6pt, y: 2pt),
  )[
    #text(size: 6pt, fill: color, weight: "bold", tracking: 0.5pt)[#upper(label)]
  ]
}

#let code-block(code, lang: "rust", title: none) = {
  rect(
    width: 100%,
    fill: bg-code,
    stroke: 1pt + border-subtle,
    radius: 4pt,
    inset: 0pt,
  )[
    #if title != none [
      #rect(width: 100%, fill: rgb("#161b22"), inset: (x: 10pt, y: 6pt), radius: (top: 4pt))[
        #grid(
          columns: (auto, 1fr, auto),
          gutter: 8pt,
          [
            #box(fill: danger, width: 8pt, height: 8pt, radius: 50%)
            #h(3pt)
            #box(fill: warning, width: 8pt, height: 8pt, radius: 50%)
            #h(3pt)
            #box(fill: success, width: 8pt, height: 8pt, radius: 50%)
          ],
          align(center)[#text(size: 7pt, fill: text-muted, font: "JetBrains Mono")[#title]],
          text(size: 6pt, fill: text-muted)[#lang],
        )
      ]
    ]
    #block(inset: 10pt)[
      #set text(font: "JetBrains Mono", size: 7pt, fill: text-primary)
      #raw(code, lang: lang)
    ]
  ]
}

#let terminal-block(output) = {
  rect(
    width: 100%,
    fill: rgb("#000000"),
    stroke: 1pt + primary.transparentize(70%),
    radius: 4pt,
    inset: 10pt,
  )[
    #set text(font: "JetBrains Mono", size: 7pt, fill: success)
    #raw(output)
  ]
}

#let metric(value, label, color: primary) = {
  box(inset: 8pt)[
    #align(center)[
      #text(size: 24pt, weight: "bold", fill: color)[#value]
      #v(-2pt)
      #text(size: 6pt, fill: text-muted, tracking: 0.5pt)[#upper(label)]
    ]
  ]
}

#let screenshot-frame(path, caption: none, border-color: primary) = {
  rect(
    fill: bg-panel,
    stroke: 1pt + border-color.transparentize(60%),
    radius: 4pt,
    inset: 4pt,
  )[
    #image(path, width: 100%)
  ]
  if caption != none {
    v(4pt)
    align(center)[#text(size: 6pt, fill: text-muted)[#caption]]
  }
}

// ============================================================================
// SLIDE TEMPLATES
// ============================================================================

#let title-slide-template(title-text: none, subtitle-text: none) = {
  slide-counter.step()
  page(
    paper: "presentation-16-9",
    margin: 0pt,
    fill: bg-dark,
    header: rect(width: 100%, height: 20pt, fill: danger.transparentize(70%))[
      #align(center + horizon)[
        #text(size: 6pt, fill: danger, weight: "bold", tracking: 1pt)[
          CUI // CONTROLLED UNCLASSIFIED INFORMATION
        ]
      ]
    ],
    footer: [
      #v(4pt)
      #align(center)[#classification-banner]
      #v(8pt)
    ],
  )[
    #place(center + horizon)[
      #box(inset: 2cm)[
        #align(center)[
          #rect(width: 60pt, height: 60pt, fill: none, stroke: 2pt + primary, radius: 4pt)[
            #align(center + horizon)[
              #text(size: 24pt, fill: primary, weight: "bold")[N]
            ]
          ]
          #v(1.5cm)
          #title-hero[#upper(title-text)]
          #v(0.5cm)
          #rect(width: 8cm, height: 2pt, fill: gradient.linear(primary, secondary))
          #v(0.5cm)
          #text(size: 14pt, fill: text-secondary, weight: "light")[#subtitle-text]
          #v(2cm)
          #text(size: 9pt, fill: text-muted, tracking: 1pt)[NERVOSYS LLC]
          #v(0.3cm)
          #text(size: 8pt, fill: text-muted)[Defense-Grade AI Infrastructure]
        ]
      ]
    ]
  ]
}

#let section-divider-slide(title-text: none, number: none) = {
  slide-counter.step()
  page(
    paper: "presentation-16-9",
    margin: 0pt,
    fill: bg-dark,
    footer: [
      #v(4pt)
      #align(center)[#classification-banner]
      #v(8pt)
    ],
  )[
    #place(center + horizon)[
      #box[
        #if number != none [
          #text(size: 72pt, fill: primary.transparentize(70%), weight: "bold")[#number]
          #v(-20pt)
        ]
        #title-section[#upper(title-text)]
        #v(8pt)
        #rect(width: 4cm, height: 2pt, fill: primary)
      ]
    ]
  ]
}

#let content-slide(title: none, subtitle: none, body) = {
  slide-counter.step()
  page(
    paper: "presentation-16-9",
    margin: (x: 1cm, top: 0.8cm, bottom: 0.6cm),
    fill: bg-dark,
    header: rect(width: 100%, height: 14pt, fill: primary.transparentize(90%))[
      #grid(
        columns: (1fr, auto),
        align: (left + horizon, right + horizon),
        inset: (x: 12pt),
        text(size: 6pt, fill: primary, tracking: 0.5pt)[IRONBRIDGE TECHNICAL OVERVIEW],
        text(size: 6pt, fill: text-muted)[#context slide-counter.display("01") / 28],
      )
    ],
    footer: [
      #line(length: 100%, stroke: 0.5pt + border-subtle)
      #v(4pt)
      #align(center)[#classification-banner]
      #v(4pt)
    ],
  )[
    #if title != none [
      #title-slide-fn[#upper(title)]
      #if subtitle != none [
        #v(2pt)
        #text(size: 9pt, fill: text-secondary)[#subtitle]
      ]
      #v(8pt)
      #line(length: 100%, stroke: 0.5pt + border-subtle)
      #v(8pt)
    ]
    #set text(fill: text-primary, size: 8pt)
    #body
  ]
}

#let screenshot-slide(title: none, path: none, caption: none) = {
  slide-counter.step()
  page(
    paper: "presentation-16-9",
    margin: (x: 0.8cm, top: 0.6cm, bottom: 0.5cm),
    fill: bg-dark,
    header: rect(width: 100%, height: 14pt, fill: primary.transparentize(90%))[
      #grid(
        columns: (1fr, auto),
        align: (left + horizon, right + horizon),
        inset: (x: 12pt),
        text(size: 6pt, fill: primary, tracking: 0.5pt)[#upper(title)],
        text(size: 6pt, fill: text-muted)[#context slide-counter.display("01") / 28],
      )
    ],
    footer: [
      #v(2pt)
      #align(center)[#classification-banner]
      #v(2pt)
    ],
  )[
    #align(center)[
      #rect(
        fill: bg-panel,
        stroke: 1pt + primary.transparentize(70%),
        radius: 6pt,
        inset: 6pt,
      )[
        #image(path, height: 82%)
      ]
    ]
    #if caption != none [
      #v(4pt)
      #align(center)[#text(size: 7pt, fill: text-muted)[#caption]]
    ]
  ]
}

// ============================================================================
// DOCUMENT START
// ============================================================================

#set document(
  title: "IronBridge Technical Deep-Dive",
  author: "Nervosys LLC",
  keywords: ("AI", "Chat Management", "Defense", "Security", "Rust"),
)

// ============================================================================
// SLIDES
// ============================================================================

#title-slide-template(
  title-text: "IronBridge",
  subtitle-text: "Universal AI Session Intelligence Platform",
)

// --- EXECUTIVE SUMMARY ---

#content-slide(title: "Mission Critical Problem")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #tech-card(title: "Operational Gap", accent-color: danger)[
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: danger)[▸],
          [
            #text(fill: text-primary, weight: "bold")[Fragmented AI Conversations]
            #v(1pt)
            #text(size: 7pt, fill: text-muted)[47% of sessions lost on workspace change]
          ],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: danger)[▸],
          [
            #text(fill: text-primary, weight: "bold")[Zero Audit Trail]
            #v(1pt)
            #text(size: 7pt, fill: text-muted)[No visibility into AI-assisted development]
          ],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: danger)[▸],
          [
            #text(fill: text-primary, weight: "bold")[Provider Lock-in]
            #v(1pt)
            #text(size: 7pt, fill: text-muted)[5+ AI tools per organization, siloed data]
          ],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: danger)[▸],
          [
            #text(fill: text-primary, weight: "bold")[Compliance Failure]
            #v(1pt)
            #text(size: 7pt, fill: text-muted)[Cannot meet DFARS/CMMC requirements]
          ],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: danger)[▸],
          [
            #text(fill: text-primary, weight: "bold")[Knowledge Hemorrhage]
            #v(1pt)
            #text(size: 7pt, fill: text-muted)[\$2.3M annual loss per 100 engineers]
          ],
        )
      ]
    ],
    [
      #tech-card(title: "IronBridge Solution", accent-color: success)[
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "bold")[Harvest] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Extract sessions from all AI providers]],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "bold")[Unify] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Merge across workspaces and machines]],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "bold")[Search] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Full-text + semantic across all history]],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "bold")[Audit] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Complete activity logging with timestamps]],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "bold")[Comply] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[DFARS, CMMC, FedRAMP, NIST 800-171]],
        )
      ]

      #v(8pt)

      #grid(
        columns: (1fr, 1fr, 1fr),
        gutter: 8pt,
        metric("< 5MB", "Binary Size"), metric("< 50MB", "Memory"), metric("< 1ms", "Query P99"),
      )
    ],
  )
]

// --- ARCHITECTURE SECTION ---

#section-divider-slide(title-text: "System Architecture", number: "01")

#content-slide(title: "Platform Architecture", subtitle: "Defense-in-Depth Design")[
  #grid(
    columns: (40%, 60%),
    gutter: 1cm,
    [
      #tech-card(title: "Core Components")[
        #v(4pt)
        #rect(fill: bg-panel, radius: 3pt, inset: 8pt, width: 100%)[
          #grid(
            columns: (1fr, auto),
            text(size: 8pt, fill: text-primary, weight: "semibold")[ironbridge-rust], status-badge("OPERATIONAL", success),
          )
          #v(2pt)
          #text(size: 6pt, fill: text-muted)[Rust 1.83 / Axum]
        ]
        #v(4pt)
        #rect(fill: bg-panel, radius: 3pt, inset: 8pt, width: 100%)[
          #grid(
            columns: (1fr, auto),
            text(size: 8pt, fill: text-primary, weight: "semibold")[ironbridge-web], status-badge("OPERATIONAL", success),
          )
          #v(2pt)
          #text(size: 6pt, fill: text-muted)[React 19 / Vite 7]
        ]
        #v(4pt)
        #rect(fill: bg-panel, radius: 3pt, inset: 8pt, width: 100%)[
          #grid(
            columns: (1fr, auto),
            text(size: 8pt, fill: text-primary, weight: "semibold")[ironbridge-desktop],
            status-badge("OPERATIONAL", success),
          )
          #v(2pt)
          #text(size: 6pt, fill: text-muted)[Tauri 2 / WebView2]
        ]
        #v(4pt)
        #rect(fill: bg-panel, radius: 3pt, inset: 8pt, width: 100%)[
          #grid(
            columns: (1fr, auto),
            text(size: 8pt, fill: text-primary, weight: "semibold")[ironbridge-app], status-badge("OPERATIONAL", success),
          )
          #v(2pt)
          #text(size: 6pt, fill: text-muted)[React Native / Expo]
        ]
        #v(4pt)
        #rect(fill: bg-panel, radius: 3pt, inset: 8pt, width: 100%)[
          #grid(
            columns: (1fr, auto),
            text(size: 8pt, fill: text-primary, weight: "semibold")[vscode-ext], status-badge("OPERATIONAL", success),
          )
          #v(2pt)
          #text(size: 6pt, fill: text-muted)[TypeScript / VS Code API]
        ]
      ]
    ],
    [
      #code-block(
        title: "src/main.rs",
        lang: "rust",
        "// IronBridge Core Server — Defense-Grade Session Management
use axum::{Router, routing::get};
use ironbridge_core::{Database, SessionHarvester, MCP};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize encrypted SQLite with FTS5
    let db = Database::open_encrypted(\"ironbridge.db\", &key)?;

    // Configure harvesters for all providers
    let harvester = SessionHarvester::new()
        .add_provider(CopilotProvider::new())
        .add_provider(CursorProvider::new())
        .add_provider(OllamaProvider::new())
        .build();

    // Build API routes
    let app = Router::new()
        .route(\"/api/sessions\", get(list_sessions))
        .route(\"/api/harvest\", post(run_harvest))
        .route(\"/api/search\", get(search_sessions))
        .layer(CorsLayer::permissive())
        .with_state(AppState { db, harvester });

    // Serve with TLS
    axum_server::bind_rustls(addr, tls_config)
        .serve(app.into_make_service())
        .await
}",
      )
    ],
  )
]

#content-slide(title: "Data Flow Architecture", subtitle: "Session Lifecycle Management")[
  #align(center)[
    #rect(fill: bg-panel, stroke: 1pt + border-subtle, radius: 6pt, inset: 16pt)[
      #grid(
        columns: (1fr, auto, 1fr, auto, 1fr, auto, 1fr),
        gutter: 8pt,
        align: center + horizon,
        rect(fill: bg-card, stroke: 1pt + secondary, radius: 4pt, inset: 10pt)[
          #text(size: 7pt, fill: secondary, weight: "bold")[SOURCES]
          #v(6pt)
          #text(size: 6pt, fill: text-muted)[Copilot \ Cursor \ Claude \ Ollama]
        ],
        text(size: 16pt, fill: primary)[→],
        rect(fill: bg-card, stroke: 1pt + primary, radius: 4pt, inset: 10pt)[
          #text(size: 7pt, fill: primary, weight: "bold")[HARVEST]
          #v(6pt)
          #text(size: 6pt, fill: text-muted)[Detection \ Extraction \ Validation \ Dedup]
        ],
        text(size: 16pt, fill: primary)[→],
        rect(fill: bg-card, stroke: 1pt + success, radius: 4pt, inset: 10pt)[
          #text(size: 7pt, fill: success, weight: "bold")[STORAGE]
          #v(6pt)
          #text(size: 6pt, fill: text-muted)[SQLite \ FTS5 Index \ AES-256 \ Audit Log]
        ],
        text(size: 16pt, fill: primary)[→],
        rect(fill: bg-card, stroke: 1pt + warning, radius: 4pt, inset: 10pt)[
          #text(size: 7pt, fill: warning, weight: "bold")[CLIENTS]
          #v(6pt)
          #text(size: 6pt, fill: text-muted)[CLI / TUI \ Web App \ Desktop \ Mobile]
        ],
      )
    ]
  ]

  #v(12pt)

  #grid(
    columns: (1fr, 1fr, 1fr, 1fr),
    gutter: 8pt,
    tech-card(
      title: "Transport",
      accent-color: primary,
    )[REST API (JSON) \ WebSocket (Real-time) \ SSE (Push updates) \ MCP Protocol],
    tech-card(
      title: "Security",
      accent-color: success,
    )[TLS 1.3 in transit \ AES-256-GCM at rest \ RBAC authorization \ Audit logging],
    tech-card(title: "Sync", accent-color: warning)[Local SQLite \ S3 / Azure / GCS \ WebDAV support \ Offline-first],
    tech-card(
      title: "Scale",
      accent-color: secondary,
    )[10M+ messages \ < 1ms P99 queries \ < 50MB memory \ Zero dependencies],
  )
]

// --- CLI SECTION ---

#section-divider-slide(title-text: "Command Line Interface", number: "02")

#content-slide(title: "CLI Operations", subtitle: "Power User Workflows")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #label-text[WORKSPACE DISCOVERY]
      #v(4pt)
      #terminal-block(
        "$ ironbridge list workspaces --format table

┌─────────────────────────────────────────────────┐
│ WORKSPACE DISCOVERY                             │
├──────────────────────┬──────────┬───────────────┤
│ Path                 │ Sessions │ Last Activity │
├──────────────────────┼──────────┼───────────────┤
│ /secure-comms        │ 47       │ 2 hours ago   │
│ /defense-ai-platform │ 123      │ 15 min ago    │
│ /classified-research │ 89       │ 1 day ago     │
│ /mission-planning    │ 34       │ 3 hours ago   │
└──────────────────────┴──────────┴───────────────┘

Total: 4 workspaces, 293 sessions",
      )

      #v(8pt)

      #label-text[SESSION SEARCH]
      #v(4pt)
      #terminal-block(
        "$ ironbridge search \"authentication vulnerability\" --limit 5

Found 12 matches across 8 sessions:

[1] Session: debug-auth-bypass (3 matches)
    Workspace: /secure-comms
    Date: 2026-01-28 14:32:00

[2] Session: security-review-jan (2 matches)
    Workspace: /defense-ai-platform
    Date: 2026-01-27 09:15:00",
      )
    ],
    [
      #label-text[HARVEST OPERATIONS]
      #v(4pt)
      #terminal-block(
        "$ ironbridge harvest run --provider all --verbose

[INFO] Starting harvest operation...
[INFO] Provider: GitHub Copilot
  → Scanning workspaceStorage...
  → Found 47 sessions
  → Extracted 1,234 messages
  → Duration: 0.34s

[INFO] Provider: Cursor
  → Scanning cursor-state...
  → Found 23 sessions
  → Extracted 567 messages
  → Duration: 0.21s

[SUCCESS] Harvest complete
  Total sessions: 70
  Total messages: 1,801
  New sessions: 12
  Updated: 58",
      )

      #v(8pt)

      #label-text[EXPORT & BACKUP]
      #v(4pt)
      #terminal-block(
        "$ ironbridge export --format json --encrypt \\
    --output /backup/sessions-2026-01-29.enc

Exporting 293 sessions...
Encrypting with AES-256-GCM...
Written: /backup/sessions-2026-01-29.enc (4.2 MB)
SHA-256: a3f2b1c9d8e7...",
      )
    ],
  )
]

#screenshot-slide(
  title: "CLI — Workspace Discovery",
  path: "screenshots/ironbridge_cli_list.png",
  caption: "Terminal output showing workspace discovery and session enumeration",
)

#screenshot-slide(
  title: "CLI — Agency ADK",
  path: "screenshots/ironbridge_cli_agency.png",
  caption: "Multi-agent orchestration via command line interface",
)

// --- WEB APPLICATION SECTION ---

#section-divider-slide(title-text: "Web Application", number: "03")

#content-slide(title: "Web Dashboard", subtitle: "React 19 • Vite 7 • TailwindCSS 4")[
  #grid(
    columns: (35%, 65%),
    gutter: 1cm,
    [
      #tech-card(title: "Core Features", accent-color: primary)[
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Real-time session sync],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Interactive chat replay],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Syntax highlighting (50+ langs)],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Full-text search with filters],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Session annotations & tags],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[40+ keyboard shortcuts],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Provider comparison view],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Export: JSON, MD, HTML, PDF],
        )
      ]

      #v(8pt)

      #tech-card(title: "Q1-Q2 2026", accent-color: success)[
        #v(2pt)
        #status-badge("NEW", success)
        #v(6pt)
        Session templates \ Batch operations \ Keyboard shortcuts \ Advanced annotations
      ]
    ],
    [
      #rect(fill: bg-panel, stroke: 1pt + primary.transparentize(60%), radius: 4pt, inset: 4pt)[
        #image("screenshots/ironbridge_web_home.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[#text(size: 6pt, fill: text-muted)[Dashboard with real-time statistics and recent activity]]
    ],
  )
]

#screenshot-slide(
  title: "Web — Chat Interface",
  path: "screenshots/ironbridge_web_chat.png",
  caption: "Full conversation view with syntax highlighting and message actions",
)

#screenshot-slide(
  title: "Web — Sessions Explorer",
  path: "screenshots/ironbridge_web_sessions.png",
  caption: "Session list with filtering, sorting, and bulk operations",
)

#screenshot-slide(
  title: "Web — Workspaces",
  path: "screenshots/ironbridge_web_workspaces.png",
  caption: "Workspace browser showing linked projects and session counts",
)

#content-slide(title: "Web — Agent Management", subtitle: "Multi-Agent Inbox & Orchestration")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #rect(fill: bg-panel, stroke: 1pt + secondary.transparentize(60%), radius: 4pt, inset: 4pt)[
        #image("screenshots/ironbridge_web_agents.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[#text(size: 6pt, fill: text-muted)[Agent configuration and management]]
    ],
    [
      #rect(fill: bg-panel, stroke: 1pt + success.transparentize(60%), radius: 4pt, inset: 4pt)[
        #image("screenshots/ironbridge_web_agents_inbox.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[#text(size: 6pt, fill: text-muted)[Agent inbox with pending tasks]]
    ],
  )
]

#screenshot-slide(
  title: "Web — Provider Comparison",
  path: "screenshots/ironbridge_web_comparison.png",
  caption: "Side-by-side comparison of AI provider responses",
)

#screenshot-slide(
  title: "Web — Developer Tools",
  path: "screenshots/ironbridge_web_developer.png",
  caption: "API explorer, debugging, and diagnostic tools",
)

// --- DESKTOP APPLICATION SECTION ---

#section-divider-slide(title-text: "Desktop Application", number: "04")

#content-slide(title: "Desktop App", subtitle: "Tauri 2 • Rust • WebView2/WebKit")[
  #grid(
    columns: (35%, 65%),
    gutter: 1cm,
    [
      #tech-card(title: "Native Advantages", accent-color: warning)[
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: warning)[◆],
          [#text(fill: text-primary, weight: "semibold")[~10MB binary] #h(4pt) #text(
              size: 7pt,
              fill: text-muted,
            )[vs 150MB Electron]],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: warning)[◆],
          [#text(fill: text-primary, weight: "semibold")[< 30MB memory] #h(4pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Efficient WebView2]],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: warning)[◆],
          [#text(fill: text-primary, weight: "semibold")[System tray] #h(4pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Quick actions]],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: warning)[◆],
          [#text(fill: text-primary, weight: "semibold")[Native dialogs] #h(4pt) #text(
              size: 7pt,
              fill: text-muted,
            )[File picker, notifications]],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: warning)[◆],
          [#text(fill: text-primary, weight: "semibold")[Auto-updates] #h(4pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Code-signed releases]],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: warning)[◆],
          [#text(fill: text-primary, weight: "semibold")[Air-gapped] #h(4pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Works fully offline]],
        )
      ]

      #v(8pt)

      #rect(fill: bg-card, stroke: 1pt + warning.transparentize(60%), radius: 4pt, inset: 10pt)[
        #grid(
          columns: (1fr, 1fr, 1fr),
          gutter: 4pt,
          align: center,
          [#image("screenshots/ironbridge_desktop_home.png", width: 100%)],
          [#image("screenshots/ironbridge_desktop_chat.png", width: 100%)],
          [#image("screenshots/ironbridge_desktop_agents.png", width: 100%)],
        )
        #v(4pt)
        #align(center)[#text(size: 6pt, fill: text-muted)[Win / Mac / Linux]]
      ]
    ],
    [
      #rect(fill: bg-panel, stroke: 1pt + warning.transparentize(60%), radius: 4pt, inset: 4pt)[
        #image("screenshots/ironbridge_desktop_overview.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[#text(size: 6pt, fill: text-muted)[Desktop application with native system integration]]
    ],
  )
]

#screenshot-slide(
  title: "Desktop — Session View",
  path: "screenshots/ironbridge_desktop_sessions.png",
  caption: "Native session browser with workspace filtering",
)

#screenshot-slide(
  title: "Desktop — Agent Orchestration",
  path: "screenshots/ironbridge_desktop_agents.png",
  caption: "Multi-agent management in native desktop environment",
)

// --- MOBILE APPLICATION SECTION ---

#section-divider-slide(title-text: "Mobile Application", number: "05")

#content-slide(title: "Mobile App", subtitle: "React Native • Expo • iOS & Android")[
  #grid(
    columns: (1fr, 1fr, 1fr, 1fr),
    gutter: 12pt,
    [
      #rect(fill: bg-card, stroke: 1pt + primary.transparentize(60%), radius: 12pt, inset: 6pt)[
        #image("screenshots/ironbridge_app_home.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[
        #text(size: 7pt, fill: primary, weight: "bold")[HOME]
        #v(2pt)
        #text(size: 6pt, fill: text-muted)[Dashboard & stats]
      ]
    ],
    [
      #rect(fill: bg-card, stroke: 1pt + success.transparentize(60%), radius: 12pt, inset: 6pt)[
        #image("screenshots/ironbridge_app_workspaces.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[
        #text(size: 7pt, fill: success, weight: "bold")[WORKSPACES]
        #v(2pt)
        #text(size: 6pt, fill: text-muted)[Project browser]
      ]
    ],
    [
      #rect(fill: bg-card, stroke: 1pt + warning.transparentize(60%), radius: 12pt, inset: 6pt)[
        #image("screenshots/ironbridge_app_sessions.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[
        #text(size: 7pt, fill: warning, weight: "bold")[SESSIONS]
        #v(2pt)
        #text(size: 6pt, fill: text-muted)[Session list]
      ]
    ],
    [
      #rect(fill: bg-card, stroke: 1pt + secondary.transparentize(60%), radius: 12pt, inset: 6pt)[
        #image("screenshots/ironbridge_app_chat.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[
        #text(size: 7pt, fill: secondary, weight: "bold")[CHAT]
        #v(2pt)
        #text(size: 6pt, fill: text-muted)[Conversation view]
      ]
    ],
  )

  #v(12pt)

  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 12pt,
    tech-card(
      title: "Security",
      accent-color: success,
    )[Face ID / Touch ID \ Fingerprint auth \ Offline caching \ Encrypted storage],
    tech-card(
      title: "Sync",
      accent-color: primary,
    )[Real-time updates \ Background sync \ Push notifications \ Conflict resolution],
    tech-card(title: "Platform", accent-color: warning)[iOS 15+ \ Android 10+ \ Tablet optimized \ Dark mode],
  )
]

// --- VS CODE EXTENSION SECTION ---

#section-divider-slide(title-text: "VS Code Extension", number: "06")

#content-slide(title: "IDE Integration", subtitle: "TypeScript • VS Code API • MCP Protocol")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #tech-card(title: "Extension Features", accent-color: primary)[
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Sidebar panel for sessions],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Quick session search (Ctrl+Shift+H)],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[One-click harvest from workspace],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Orphaned session recovery],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Git checkpoint integration],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Context menu actions],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[Status bar indicators],
        )
        #v(3pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: primary)[▸], text(fill: text-primary)[MCP server auto-start],
        )
      ]

      #v(8pt)

      #code-block(
        title: "Commands",
        lang: "text",
        "IronBridge: Show Sessions        Ctrl+Shift+S
IronBridge: Search History       Ctrl+Shift+H
IronBridge: Recover Session      Ctrl+Shift+R
IronBridge: Start MCP Server     Ctrl+Shift+M
IronBridge: Sync Workspace       Ctrl+Shift+Y",
      )
    ],
    [
      #rect(fill: bg-panel, stroke: 1pt + primary.transparentize(60%), radius: 4pt, inset: 4pt)[
        #image("screenshots/vscode-sidebar.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[#text(size: 6pt, fill: text-muted)[VS Code sidebar with session tree view]]
    ],
  )
]

// --- CODE EXAMPLES SECTION ---

#section-divider-slide(title-text: "Code Examples", number: "07")

#content-slide(title: "Rust API — Session Harvesting", subtitle: "Core extraction and processing logic")[
  #code-block(
    title: "src/harvest/copilot.rs",
    lang: "rust",
    "/// Harvest sessions from GitHub Copilot Chat storage
pub struct CopilotHarvester {
    db: Arc<Database>,
    config: HarvestConfig,
}

impl SessionHarvester for CopilotHarvester {
    async fn harvest(&self, workspace: &Path) -> Result<HarvestResult> {
        let storage_path = self.locate_workspace_storage(workspace)?;
        let state_db = SqliteConnection::open(&storage_path.join(\"state.vscdb\"))?;

        // Extract sessions from VS Code workspace storage
        let raw_sessions: Vec<RawSession> = state_db
            .query(\"SELECT key, value FROM ItemTable WHERE key LIKE 'workbench.panel.chat%'\")
            .fetch_all()
            .await?;

        let mut result = HarvestResult::default();

        for raw in raw_sessions {
            let session = self.parse_copilot_session(&raw.value)?;

            // Deduplicate based on content hash
            if !self.db.session_exists(&session.content_hash).await? {
                self.db.insert_session(&session).await?;
                result.new_sessions += 1;
            } else {
                self.db.update_session(&session).await?;
                result.updated_sessions += 1;
            }
            result.messages += session.messages.len();
        }

        Ok(result)
    }
}",
  )
]

#content-slide(title: "Rust API — Search & Query", subtitle: "Full-text search with FTS5")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #code-block(
        title: "src/search/engine.rs",
        lang: "rust",
        "/// Full-text search across all sessions
pub async fn search_sessions(
    db: &Database,
    query: &SearchQuery,
) -> Result<Vec<SearchResult>> {
    let sql = r#\"
        SELECT
            s.id, s.title, s.workspace,
            highlight(messages_fts, 0, '<mark>', '</mark>') as snippet,
            bm25(messages_fts) as score
        FROM messages_fts
        JOIN sessions s ON s.id = messages_fts.session_id
        WHERE messages_fts MATCH ?1
        ORDER BY score
        LIMIT ?2 OFFSET ?3
    \"#;

    let results = sqlx::query_as::<_, SearchResult>(sql)
        .bind(&query.text)
        .bind(query.limit)
        .bind(query.offset)
        .fetch_all(&db.pool)
        .await?;

    Ok(results)
}",
      )
    ],
    [
      #code-block(
        title: "src/api/routes.rs",
        lang: "rust",
        "/// REST API endpoint for search
#[axum::debug_handler]
pub async fn search_handler(
    State(state): State<AppState>,
    Query(params): Query<SearchParams>,
) -> Result<Json<SearchResponse>> {
    let query = SearchQuery {
        text: params.q,
        workspace: params.workspace,
        provider: params.provider,
        date_range: params.date_range(),
        limit: params.limit.unwrap_or(20),
        offset: params.offset.unwrap_or(0),
    };

    let results = search_sessions(&state.db, &query).await?;
    let total = count_search_results(&state.db, &query).await?;

    Ok(Json(SearchResponse {
        results,
        total,
        query: params.q,
        took_ms: start.elapsed().as_millis(),
    }))
}",
      )
    ],
  )
]

#content-slide(title: "TypeScript — React Components", subtitle: "Web application UI components")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #code-block(
        title: "src/components/SessionList.tsx",
        lang: "typescript",
        "export const SessionList: React.FC<Props> = ({
  sessions,
  onSelect,
  onBatchAction,
}) => {
  const [selection, dispatch] = useReducer(
    selectionReducer,
    initialSelectionState
  );

  const handleBatchDelete = async () => {
    const ids = Array.from(selection.selectedIds);
    await api.batchDelete(ids);
    dispatch({ type: 'deselectAll' });
  };

  return (
    <div className=\"session-list\">
      <BatchToolbar
        selectedCount={selection.selectedIds.size}
        onDelete={handleBatchDelete}
        onArchive={() => onBatchAction('archive', selection)}
        onExport={() => onBatchAction('export', selection)}
      />
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          isSelected={selection.selectedIds.has(session.id)}
          onToggle={() => dispatch({ type: 'toggle', id: session.id })}
          onClick={() => onSelect(session)}
        />
      ))}
    </div>
  );
};",
      )
    ],
    [
      #code-block(
        title: "src/components/AnnotationsPanel.tsx",
        lang: "typescript",
        "export const AnnotationsPanel: React.FC<Props> = ({
  sessionId,
  annotations,
  onUpdate,
}) => {
  const [tags, setTags] = useState<SessionTag[]>([]);
  const [notes, setNotes] = useState<SessionNote[]>([]);

  const handleAddTag = async (tag: Omit<SessionTag, 'id'>) => {
    const newTag = await api.createTag(sessionId, tag);
    setTags([...tags, newTag]);
    onUpdate?.();
  };

  const handleHighlight = async (
    messageId: string,
    range: { start: number; end: number },
    color: string
  ) => {
    await api.createHighlight(sessionId, {
      messageId,
      startOffset: range.start,
      endOffset: range.end,
      color,
    });
  };

  return (
    <div className=\"annotations-panel\">
      <TagPicker tags={tags} onAdd={handleAddTag} />
      <NoteEditor notes={notes} onSave={handleSaveNote} />
      <HighlightList highlights={highlights} />
    </div>
  );
};",
      )
    ],
  )
]

#content-slide(title: "TypeScript — Type Definitions", subtitle: "Shared types across all platforms")[
  #code-block(
    title: "ironbridge-shared/src/types/session.ts",
    lang: "typescript",
    "/** Core session type — unified across all providers */
export interface ChatSession {
  id: string;                              // UUID v7 (time-ordered)
  title: string;                           // Auto-generated or user-defined
  provider: SessionProvider;               // copilot | cursor | claude | ollama | ...
  workspace?: string;                      // Associated workspace path
  messages: ChatMessage[];                 // Conversation history
  metadata: SessionMetadata;               // Provider-specific data
  createdAt: number;                       // Unix timestamp (ms)
  updatedAt: number;                       // Last modification
  contentHash: string;                     // SHA-256 for deduplication
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;                         // Raw message content
  timestamp: number;
  model?: string;                          // e.g., \"gpt-4\", \"claude-3-opus\"
  tokens?: { prompt: number; completion: number };
  annotations?: MessageAnnotation[];       // Highlights, notes
}

export interface SessionTag {
  id: string;
  name: string;
  color: string;                           // Hex color code
  createdAt: number;
}

export type BatchOperationType = 'delete' | 'archive' | 'export' | 'tag' | 'merge';

export interface BatchOperationRequest {
  operation: BatchOperationType;
  sessionIds: string[];
  options?: Record<string, unknown>;
}",
  )
]

// --- SECURITY SECTION ---

#section-divider-slide(title-text: "Security & Compliance", number: "08")

#content-slide(title: "Security Architecture", subtitle: "Defense-in-Depth Implementation")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #tech-card(title: "Data Protection", accent-color: success)[
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "semibold")[Encryption at Rest] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[AES-256-GCM via SQLCipher]],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "semibold")[Encryption in Transit] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[TLS 1.3 with mTLS option]],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "semibold")[Key Management] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[PBKDF2 / Argon2 key derivation]],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "semibold")[Secure Delete] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[NIST 800-88 compliant wipe]],
        )
        #v(4pt)
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          text(fill: success)[◆],
          [#text(fill: text-primary, weight: "semibold")[Audit Logging] #v(1pt) #text(
              size: 7pt,
              fill: text-muted,
            )[Immutable append-only log]],
        )
      ]

      #v(8pt)

      #tech-card(title: "Access Control", accent-color: primary)[
        #v(4pt)
        Role-based access (RBAC) \ Session-level permissions \ API key authentication \ OAuth 2.0 / SAML SSO \ LDAP/AD integration
      ]
    ],
    [
      #tech-card(title: "Compliance Framework", accent-color: warning)[
        #v(4pt)
        #grid(
          columns: (1fr, 1fr),
          gutter: 8pt,
          [
            #status-badge("COMPLIANT", success)
            #v(4pt)
            #text(size: 8pt, fill: text-primary)[DFARS 252.227-7015]
            #v(2pt)
            #text(size: 7pt, fill: text-muted)[Commercial software rights]
          ],
          [
            #status-badge("COMPLIANT", success)
            #v(4pt)
            #text(size: 8pt, fill: text-primary)[CMMC Level 2]
            #v(2pt)
            #text(size: 7pt, fill: text-muted)[CUI protection]
          ],

          [
            #status-badge("READY", warning)
            #v(4pt)
            #text(size: 8pt, fill: text-primary)[FedRAMP]
            #v(2pt)
            #text(size: 7pt, fill: text-muted)[Moderate baseline]
          ],
          [
            #status-badge("COMPLIANT", success)
            #v(4pt)
            #text(size: 8pt, fill: text-primary)[NIST 800-171]
            #v(2pt)
            #text(size: 7pt, fill: text-muted)[110 controls]
          ],
        )
      ]

      #v(8pt)

      #code-block(
        title: "Air-Gapped Deployment",
        lang: "bash",
        "# Single binary, zero network required
$ ironbridge api serve \\
    --offline \\
    --tls-cert /secure/cert.pem \\
    --tls-key /secure/key.pem \\
    --db /secure/ironbridge.db \\
    --audit-log /secure/audit.log",
      )
    ],
  )
]

// --- DEPLOYMENT SECTION ---

#content-slide(title: "Deployment Options", subtitle: "From Workstation to Enterprise")[
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 1cm,
    [
      #tech-card(title: "Standalone", accent-color: primary)[
        #v(4pt)
        #text(size: 7pt, fill: text-muted)[Single engineer workstation]
        #v(8pt)
        #terminal-block("$ ironbridge api serve
Listening on https://localhost:8787")
        #v(8pt)
        Zero dependencies \ ~5MB binary \ Instant startup \ SQLite storage
      ]
    ],
    [
      #tech-card(title: "Container", accent-color: success)[
        #v(4pt)
        #text(size: 7pt, fill: text-muted)[Team / department scale]
        #v(8pt)
        #code-block(
          lang: "yaml",
          "services:
  ironbridge:
    image: ghcr.io/nervosys/IronBridge
    ports:
      - \"8787:8787\"
    volumes:
      - ironbridge-data:/data",
        )
        #v(8pt)
        Docker / Podman \ Volume persistence \ Health checks
      ]
    ],
    [
      #tech-card(title: "Enterprise", accent-color: warning)[
        #v(4pt)
        #text(size: 7pt, fill: text-muted)[Organization-wide]
        #v(8pt)
        #code-block(
          lang: "bash",
          "$ helm install ironbridge \\
    nervosys/IronBridge \\
    --set replicas=3 \\
    --set sso.enabled=true",
        )
        #v(8pt)
        Kubernetes HA \ SSO / LDAP \ Central audit \ Multi-tenant
      ]
    ],
  )
]

// --- SUMMARY ---

#content-slide(title: "Platform Summary", subtitle: "Why IronBridge for Defense")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #grid(
        columns: (auto, 1fr),
        gutter: 8pt,
        text(size: 12pt, fill: success)[◆],
        [#text(size: 9pt, weight: "bold", fill: text-primary)[Local-First] #h(6pt) #text(
            size: 8pt,
            fill: text-muted,
          )[Data never leaves your infrastructure]],
      )
      #v(8pt)
      #grid(
        columns: (auto, 1fr),
        gutter: 8pt,
        text(size: 12pt, fill: primary)[◆],
        [#text(size: 9pt, weight: "bold", fill: text-primary)[Rust Performance] #h(6pt) #text(
            size: 8pt,
            fill: text-muted,
          )[Sub-millisecond queries on millions of messages]],
      )
      #v(8pt)
      #grid(
        columns: (auto, 1fr),
        gutter: 8pt,
        text(size: 12pt, fill: warning)[◆],
        [#text(size: 9pt, weight: "bold", fill: text-primary)[Universal] #h(6pt) #text(
            size: 8pt,
            fill: text-muted,
          )[Every AI provider, every platform, one tool]],
      )
      #v(8pt)
      #grid(
        columns: (auto, 1fr),
        gutter: 8pt,
        text(size: 12pt, fill: secondary)[◆],
        [#text(size: 9pt, weight: "bold", fill: text-primary)[Power User Tools] #h(6pt) #text(
            size: 8pt,
            fill: text-muted,
          )[Annotations, templates, 40+ shortcuts]],
      )
      #v(8pt)
      #grid(
        columns: (auto, 1fr),
        gutter: 8pt,
        text(size: 12pt, fill: primary)[◆],
        [#text(size: 9pt, weight: "bold", fill: text-primary)[Zero Dependencies] #h(6pt) #text(
            size: 8pt,
            fill: text-muted,
          )[Single binary, instant air-gapped deployment]],
      )
      #v(8pt)
      #grid(
        columns: (auto, 1fr),
        gutter: 8pt,
        text(size: 12pt, fill: success)[◆],
        [#text(size: 9pt, weight: "bold", fill: text-primary)[Compliance Ready] #h(6pt) #text(
            size: 8pt,
            fill: text-muted,
          )[DFARS, CMMC, FedRAMP, NIST 800-171]],
      )
    ],
    [
      #tech-card(title: "Platform Matrix", accent-color: primary)[
        #v(4pt)
        #table(
          columns: (auto, 1fr),
          stroke: none,
          inset: 4pt,
          row-gutter: 4pt,
          text(size: 8pt, weight: "bold", fill: primary)[ironbridge-rust],
          text(size: 7pt, fill: text-muted)[Core API, CLI, harvesting engine],

          text(size: 8pt, weight: "bold", fill: success)[ironbridge-web],
          text(size: 7pt, fill: text-muted)[Browser dashboard, React 19],

          text(size: 8pt, weight: "bold", fill: warning)[ironbridge-desktop],
          text(size: 7pt, fill: text-muted)[Native app, Tauri 2],

          text(size: 8pt, weight: "bold", fill: secondary)[ironbridge-app],
          text(size: 7pt, fill: text-muted)[Mobile, React Native],

          text(size: 8pt, weight: "bold", fill: text-primary)[vscode-ext],
          text(size: 7pt, fill: text-muted)[IDE integration],
        )
      ]

      #v(12pt)

      #rect(fill: primary, radius: 4pt, inset: 14pt, width: 100%)[
        #align(center)[
          #text(size: 10pt, fill: bg-dark, weight: "bold")[sales\@nervosys.ai]
          #v(4pt)
          #text(size: 8pt, fill: bg-dark)[nervosys.ai/ironbridge]
        ]
      ]
    ],
  )
]

// --- CLOSING ---

#slide-counter.step()
#page(
  paper: "presentation-16-9",
  margin: 0pt,
  fill: bg-dark,
  header: rect(width: 100%, height: 20pt, fill: primary.transparentize(90%))[
    #align(center + horizon)[
      #text(size: 6pt, fill: primary, tracking: 1pt)[
        CUI // CONTROLLED UNCLASSIFIED INFORMATION
      ]
    ]
  ],
  footer: [
    #v(4pt)
    #align(center)[#classification-banner]
    #v(8pt)
  ],
)[
  #place(center + horizon)[
    #box(inset: 2cm)[
      #align(center)[
        #rect(width: 80pt, height: 80pt, fill: none, stroke: 2pt + primary, radius: 6pt)[
          #align(center + horizon)[
            #text(size: 32pt, fill: primary, weight: "bold")[N]
          ]
        ]
        #v(1.5cm)
        #title-hero[IRONBRIDGE]
        #v(0.6cm)
        #rect(width: 8cm, height: 2pt, fill: gradient.linear(primary, secondary))
        #v(0.6cm)
        #text(size: 16pt, fill: text-secondary, weight: "light")[
          Never Lose an AI Conversation Again
        ]
        #v(2cm)
        #text(size: 10pt, fill: text-muted, tracking: 1pt)[NERVOSYS LLC]
        #v(0.4cm)
        #text(size: 9pt, fill: text-secondary)[Defense-Grade AI Infrastructure]
        #v(1.2cm)
        #text(size: 12pt, style: "italic", fill: text-muted)[
          The future is what we make.™
        ]
      ]
    ]
  ]
]
