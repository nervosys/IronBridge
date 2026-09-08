// IronBridge Sales Presentation
// Nervosys LLC — Dual-Use AI Chat Management Platform
// Theme: Matches capabilities_statement/main.typ
// Compile: typst compile ironbridge-sales.typ ironbridge-sales.pdf

// ============================================================================
// THEME — Nervosys Corporate Identity
// ============================================================================

#let accent = rgb("#8f00ff")
#let dark-bg = rgb("#1a1a1a")
#let light-bg = rgb("#f5f5f5")
#let grey = rgb("#999999")
#let lightgrey = rgb("#b0b0b0")
#let text-dark = rgb("#1a1a1a")
#let text-light = rgb("#e0e0e0")

#let slide-counter = counter("slide")

#let dfars-footer = [
  #set text(size: 5pt, fill: grey, tracking: 0.5pt)
  #upper[Nervosys Proprietary — Commercial Computer Software (DFARS 252.227-7015) — Government Rights Restricted — Not For Public Release]
]

// Typography definitions (matching capabilities statement)
#let title-text = text.with(
  size: 28pt,
  weight: "thin",
  tracking: 2pt,
  fill: white,
)

#let subtitle-text = text.with(
  size: 14pt,
  weight: "light",
  fill: text-light,
)

#let section-title = text.with(
  size: 16pt,
  weight: "bold",
  fill: text-dark,
  tracking: 0.5pt,
)

#let subsection-title = text.with(
  size: 11pt,
  weight: "semibold",
  fill: rgb("#2a2a2a"),
)

// Custom divider
#let section-divider = {
  v(0.1in)
  align(center)[
    #line(length: 6em, stroke: 2pt + accent)
  ]
  v(0.15in)
}

// Standard slide (light background)
#let slide(title: none, subtitle: none, body) = {
  slide-counter.step()
  page(
    paper: "presentation-16-9",
    margin: (x: 1.2cm, top: 1cm, bottom: 0.8cm),
    fill: white,
    footer: [
      #line(length: 100%, stroke: 0.5pt + rgb("#e0e0e0"))
      #v(4pt)
      #grid(
        columns: (1fr, auto, 1fr),
        align: (left, center, right),
        text(size: 6pt, fill: grey, font: "Inter")[IRONBRIDGE],
        dfars-footer,
        text(size: 6pt, fill: grey, font: "Inter")[#context slide-counter.display("01")],
      )
    ],
  )[
    #if title != none [
      #align(center)[
        #section-title[#upper[#title]]
        #if subtitle != none [
          #v(2pt)
          #text(size: 9pt, fill: grey)[#subtitle]
        ]
        #section-divider
      ]
    ]
    #set text(fill: text-dark, size: 9pt, font: "Inter")
    #body
  ]
}

// Dark slide (for emphasis)
#let dark-slide(title: none, subtitle: none, body) = {
  slide-counter.step()
  page(
    paper: "presentation-16-9",
    margin: (x: 1.2cm, top: 1cm, bottom: 0.8cm),
    fill: dark-bg,
    footer: [
      #line(length: 100%, stroke: 0.5pt + rgb("#333333"))
      #v(4pt)
      #grid(
        columns: (1fr, auto, 1fr),
        align: (left, center, right),
        text(size: 6pt, fill: lightgrey, font: "Inter")[IRONBRIDGE],
        [#set text(size: 5pt, fill: lightgrey, tracking: 0.5pt)
          #upper[Nervosys Proprietary — Commercial Computer Software (DFARS 252.227-7015) — Government Rights Restricted — Not For Public Release]],
        text(size: 6pt, fill: lightgrey, font: "Inter")[#context slide-counter.display("01")],
      )
    ],
  )[
    #if title != none [
      #align(center)[
        #text(size: 16pt, weight: "bold", fill: white, tracking: 0.5pt)[#upper[#title]]
        #if subtitle != none [
          #v(2pt)
          #text(size: 9pt, fill: lightgrey)[#subtitle]
        ]
        #v(0.1in)
        #line(length: 6em, stroke: 2pt + accent)
        #v(0.15in)
      ]
    ]
    #set text(fill: white, size: 9pt, font: "Inter")
    #body
  ]
}

// Title slide
#let title-slide(title: none, subtitle: none) = {
  slide-counter.step()
  page(
    paper: "presentation-16-9",
    margin: 0pt,
    fill: dark-bg,
    footer: [
      #v(4pt)
      #align(center)[
        #set text(size: 5pt, fill: lightgrey, tracking: 0.5pt)
        #upper[Nervosys Proprietary — Commercial Computer Software (DFARS 252.227-7015) — Government Rights Restricted — Not For Public Release]
      ]
      #v(8pt)
    ],
  )[
    #align(center + horizon)[
      #box(inset: (x: 3cm, y: 2cm))[
        #text(size: 9pt, fill: grey, tracking: 2pt, weight: "light")[
          CAPABILITIES STATEMENT
        ]
        #v(1.5cm)
        #title-text[#upper[#title]]
        #v(0.8cm)
        #line(length: 8cm, stroke: 2pt + accent)
        #v(0.8cm)
        #subtitle-text[#subtitle]
      ]
    ]
  ]
}

// Section divider slide
#let section-slide(title: none) = {
  slide-counter.step()
  page(
    paper: "presentation-16-9",
    margin: 0pt,
    fill: dark-bg,
    footer: [
      #v(4pt)
      #align(center)[
        #set text(size: 5pt, fill: lightgrey, tracking: 0.5pt)
        #upper[Nervosys Proprietary — Commercial Computer Software (DFARS 252.227-7015) — Government Rights Restricted — Not For Public Release]
      ]
      #v(8pt)
    ],
  )[
    #place(center + horizon)[
      #box[
        #line(length: 3cm, stroke: 0.5pt + grey)
        #v(1cm)
        #text(size: 32pt, weight: "thin", fill: white, tracking: 2pt)[#upper[#title]]
        #v(1cm)
        #line(length: 3cm, stroke: 0.5pt + grey)
      ]
    ]
  ]
}

// Components
#let code-block(code, lang: "bash") = {
  block(fill: dark-bg, radius: 3pt, inset: 10pt, width: 100%)[
    #set text(font: "Consolas", size: 7.5pt, fill: white)
    #raw(code, lang: lang)
  ]
}

#let stat-box(value, label) = {
  box(width: 100%, inset: 10pt)[
    #align(center)[
      #text(size: 22pt, weight: "bold", fill: text-dark)[#value]
      #v(2pt)
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[#label]]
    ]
  ]
}

#let card(title: none, body) = {
  rect(
    width: 100%,
    fill: light-bg,
    stroke: none,
    radius: 3pt,
    inset: 12pt,
  )[
    #if title != none [
      #subsection-title[#title]
      #v(6pt)
    ]
    #body
  ]
}

#let accent-card(title: none, body) = {
  rect(
    width: 100%,
    fill: white,
    stroke: 1.5pt + accent,
    radius: 3pt,
    inset: 12pt,
  )[
    #if title != none [
      #subsection-title[#title]
      #v(6pt)
    ]
    #body
  ]
}

#let dark-card(body) = {
  rect(
    width: 100%,
    fill: dark-bg,
    radius: 3pt,
    inset: 12pt,
  )[
    #set text(fill: white)
    #body
  ]
}

// ============================================================================
// DOCUMENT
// ============================================================================

#set document(title: "IronBridge - Universal AI Chat Session Manager", author: "Nervosys LLC")

// ============================================================================
// SLIDES
// ============================================================================

#title-slide(
  title: "IronBridge",
  subtitle: "Universal AI Chat Session Manager",
)

// --- PROBLEM ---

#slide(title: "The Problem", subtitle: "AI Conversation Data Loss")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1.5cm,
    [
      #accent-card(title: "Enterprise Pain Points")[
        #set text(size: 8pt, fill: text-dark)
        #v(4pt)
        #for problem in (
          "Chat history fragmented across editors, machines, providers",
          "Sessions lost on workspace change or system reinstall",
          "Zero audit trail for AI-assisted development",
          "Sensitive conversations untracked, unmanaged",
          "Copilot, Cursor, Claude, GPT — all siloed",
        ) [
          #grid(
            columns: (12pt, 1fr),
            gutter: 4pt,
            text(fill: accent)[◆], [#problem],
          )
          #v(3pt)
        ]
      ]

      #v(8pt)

      #card(title: "Compliance Gap")[
        #set text(size: 8pt, fill: text-dark)
        #grid(
          columns: (1fr, 1fr),
          gutter: 8pt,
          [• No DFARS compliance], [• No CMMC coverage],
          [• No FedRAMP path], [• No NIST 800-171],
        )
      ]
    ],
    [
      #dark-card[
        #align(center)[
          #text(size: 8pt, fill: lightgrey, tracking: 0.5pt)[#upper[Impact Metrics]]
          #v(8pt)
          #grid(
            columns: (1fr, 1fr),
            gutter: 12pt,
            [
              #text(size: 22pt, weight: "bold", fill: white)[47%]
              #v(-4pt)
              #text(size: 7pt, fill: lightgrey)[SESSIONS LOST]
            ],
            [
              #text(size: 22pt, weight: "bold", fill: white)[\$2.3M]
              #v(-4pt)
              #text(size: 7pt, fill: lightgrey)[KNOWLEDGE LOSS/YR]
            ],

            [
              #text(size: 22pt, weight: "bold", fill: white)[0%]
              #v(-4pt)
              #text(size: 7pt, fill: lightgrey)[AUDIT COVERAGE]
            ],
            [
              #text(size: 22pt, weight: "bold", fill: white)[5+]
              #v(-4pt)
              #text(size: 7pt, fill: lightgrey)[PROVIDERS/ORG]
            ],
          )
        ]
      ]

      #v(8pt)

      #card[
        #align(center)[
          #text(size: 8pt, fill: grey, style: "italic")[
            "We have no idea what AI helped us build last quarter."
            #v(4pt)
            — Enterprise Security Lead, Fortune 500
          ]
        ]
      ]
    ],
  )
]

// --- SOLUTION ---

#slide(title: "The Solution", subtitle: "Unified Session Management")[
  #rect(
    fill: dark-bg,
    radius: 3pt,
    inset: 16pt,
    width: 100%,
  )[
    #align(center)[
      #text(size: 11pt, fill: white)[
        *IRONBRIDGE* harvests, merges, and manages AI chat sessions across all providers, platforms, and workspaces.
      ]
    ]
  ]

  #v(12pt)

  #grid(
    columns: (1fr, 1fr, 1fr, 1fr),
    gutter: 12pt,
    rect(width: 100%, fill: light-bg, radius: 3pt, inset: 12pt)[
      #align(center)[
        #text(size: 18pt, fill: accent)[⬡]
        #v(4pt)
        #text(size: 9pt, weight: "bold", fill: text-dark)[HARVEST]
        #v(2pt)
        #text(size: 7pt, fill: grey)[Extract from all sources]
      ]
    ],
    rect(width: 100%, fill: light-bg, radius: 3pt, inset: 12pt)[
      #align(center)[
        #text(size: 18pt, fill: accent)[⬢]
        #v(4pt)
        #text(size: 9pt, weight: "bold", fill: text-dark)[MERGE]
        #v(2pt)
        #text(size: 7pt, fill: grey)[Unify across workspaces]
      ]
    ],
    rect(width: 100%, fill: light-bg, radius: 3pt, inset: 12pt)[
      #align(center)[
        #text(size: 18pt, fill: accent)[◈]
        #v(4pt)
        #text(size: 9pt, weight: "bold", fill: text-dark)[SEARCH]
        #v(2pt)
        #text(size: 7pt, fill: grey)[Full-text all history]
      ]
    ],
    rect(width: 100%, fill: light-bg, radius: 3pt, inset: 12pt)[
      #align(center)[
        #text(size: 18pt, fill: accent)[⎔]
        #v(4pt)
        #text(size: 9pt, weight: "bold", fill: text-dark)[AGENCY]
        #v(2pt)
        #text(size: 7pt, fill: grey)[Multi-agent orchestration]
      ]
    ],
  )

  #v(12pt)

  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 12pt,
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Deployment]]
      #v(4pt)
      #text(size: 8pt, fill: text-dark)[Single binary • Air-gapped • Container • Kubernetes]
    ],
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Storage]]
      #v(4pt)
      #text(size: 8pt, fill: text-dark)[Local SQLite • Encrypted at rest • Full audit log]
    ],
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Integration]]
      #v(4pt)
      #text(size: 8pt, fill: text-dark)[REST API • WebSocket • MCP Protocol • VS Code]
    ],
  )
]

// --- ARCHITECTURE ---

#slide(title: "Architecture", subtitle: "Platform Overview")[
  #grid(
    columns: (35%, 15%, 50%),
    gutter: 0pt,
    // Clients
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Client Platforms]]
      #v(8pt)
      #for (name, tech) in (
        ("CLI / TUI", "Rust native"),
        ("Web App", "React 19 + Vite 7"),
        ("Desktop", "Tauri 2"),
        ("Mobile", "React Native"),
        ("VS Code", "Extension API"),
      ) [
        #rect(fill: light-bg, radius: 3pt, inset: 8pt, width: 100%)[
          #grid(
            columns: (1fr, auto),
            text(size: 8pt, fill: text-dark)[#name], text(size: 6pt, fill: grey)[#tech],
          )
        ]
        #v(4pt)
      ]
    ],
    // Connection
    align(center + horizon)[
      #text(size: 16pt, fill: accent)[⟷]
      #v(4pt)
      #text(size: 6pt, fill: grey)[REST]
      #text(size: 6pt, fill: grey)[WS]
    ],
    // Backend
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[IronBridge Core — Rust]]
      #v(8pt)
      #grid(
        columns: (1fr, 1fr),
        gutter: 6pt,
        rect(fill: light-bg, radius: 3pt, inset: 8pt)[
          #text(size: 6pt, fill: grey)[DATABASE]
          #v(2pt)
          #text(size: 8pt, fill: text-dark)[SQLite + FTS5]
        ],
        rect(fill: light-bg, radius: 3pt, inset: 8pt)[
          #text(size: 6pt, fill: grey)[HARVEST]
          #v(2pt)
          #text(size: 8pt, fill: text-dark)[Multi-Provider]
        ],

        rect(fill: light-bg, radius: 3pt, inset: 8pt)[
          #text(size: 6pt, fill: grey)[AGENCY]
          #v(2pt)
          #text(size: 8pt, fill: text-dark)[Agent ADK]
        ],
        rect(fill: light-bg, radius: 3pt, inset: 8pt)[
          #text(size: 6pt, fill: grey)[PROTOCOL]
          #v(2pt)
          #text(size: 8pt, fill: text-dark)[MCP Server]
        ],
      )
      #v(8pt)
      #rect(fill: dark-bg, radius: 3pt, inset: 10pt, width: 100%)[
        #grid(
          columns: (1fr, 1fr, 1fr),
          gutter: 8pt,
          align(center)[#text(size: 6pt, fill: lightgrey)[BINARY] #v(1pt) #text(size: 8pt, fill: white)[~5MB]],
          align(center)[#text(size: 6pt, fill: lightgrey)[MEMORY] #v(1pt) #text(size: 8pt, fill: white)[#sym.lt 50MB]],
          align(center)[#text(size: 6pt, fill: lightgrey)[STARTUP] #v(1pt) #text(
              size: 8pt,
              fill: white,
            )[#sym.lt 100ms]],
        )
      ]
    ],
  )
]

// --- CLI ---

#section-slide(title: "Command Line")

#slide(title: "CLI", subtitle: "Power User Interface")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1.2cm,
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Discovery & Recovery]]
      #v(6pt)
      #code-block(
        "$ ironbridge list workspaces
$ ironbridge detect orphaned /project
$ ironbridge register all --force
$ ironbridge show path /secure-comms",
      )

      #v(10pt)

      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Harvest & Search]]
      #v(6pt)
      #code-block(
        "$ ironbridge harvest run --provider copilot
$ ironbridge harvest search \"auth bug\"
$ ironbridge export json /backup/sessions.json",
      )
    ],
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Multi-Provider Merge]]
      #v(6pt)
      #code-block(
        "$ ironbridge merge providers copilot cursor
$ ironbridge merge path /secure/project
$ ironbridge merge workspace --all",
      )

      #v(10pt)

      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Agency ADK]]
      #v(6pt)
      #code-block(
        "$ ironbridge agency list
$ ironbridge agency run --agent researcher \\
    \"Analyze security logs\"
$ ironbridge agency run --orchestration swarm \\
    \"Build microservices\"",
      )

      #v(10pt)

      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[API Server]]
      #v(6pt)
      #code-block("$ ironbridge api serve --port 8787 --tls")
    ],
  )
]

#dark-slide(title: "CLI Output", subtitle: "Workspace Discovery & Agent Development Kit")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 12pt,
    [
      #box(clip: true, radius: 6pt)[
        #image("screenshots/ironbridge_cli_list.png", width: 100%)
      ]
    ],
    [
      #box(clip: true, radius: 6pt)[
        #image("screenshots/ironbridge_cli_agency.png", width: 100%)
      ]
    ],
  )
]

// --- PLATFORMS ---

#section-slide(title: "Platforms")

#slide(title: "Web Application", subtitle: "React 19 • Vite 7 • TailwindCSS 4")[
  #grid(
    columns: (1fr, 2fr),
    gutter: 1cm,
    [
      #accent-card(title: "Features")[
        #v(4pt)
        #for feat in (
          "Interactive chat with syntax highlighting",
          "Multi-agent workflow builder",
          "Session timeline visualization",
          "Full-text search with filters",
          "Session annotations, tags & bookmarks",
          "40+ keyboard shortcuts",
        ) [
          #text(size: 7pt, fill: text-dark)[• #feat] #v(3pt)
        ]
      ]
    ],
    [
      #rect(fill: light-bg, radius: 3pt, inset: 4pt, width: 100%)[
        #image("screenshots/ironbridge_web_home.png", width: 100%)
      ]
    ],
  )
]

#slide(title: "Web Application", subtitle: "Chat Interface")[
  #align(center)[
    #rect(fill: light-bg, radius: 3pt, inset: 4pt)[
      #image("screenshots/ironbridge_web_chat.png", height: 85%)
    ]
  ]
]

#slide(title: "Web Application", subtitle: "Sessions & Workspaces")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1cm,
    [
      #rect(fill: light-bg, radius: 3pt, inset: 4pt, width: 100%)[
        #image("screenshots/ironbridge_web_sessions.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[#text(size: 7pt, fill: grey)[Sessions View]]
    ],
    [
      #rect(fill: light-bg, radius: 3pt, inset: 4pt, width: 100%)[
        #image("screenshots/ironbridge_web_workspaces.png", width: 100%)
      ]
      #v(4pt)
      #align(center)[#text(size: 7pt, fill: grey)[Workspaces View]]
    ],
  )
]

#slide(title: "Desktop Application", subtitle: "Tauri 2 • Rust • WebView2/WebKit")[
  #grid(
    columns: (1fr, 2fr),
    gutter: 1cm,
    [
      #accent-card(title: "Features")[
        #v(4pt)
        #for feat in (
          "~10MB binary (vs 150MB Electron)",
          "System tray with quick actions",
          "Native file dialogs & notifications",
          "Secure WebView sandbox",
          "Auto-updates with code signing",
          "Cross-platform: Win / Mac / Linux",
        ) [
          #text(size: 7pt, fill: text-dark)[• #feat] #v(3pt)
        ]
      ]
    ],
    [
      #rect(fill: light-bg, radius: 3pt, inset: 4pt, width: 100%)[
        #image("screenshots/ironbridge_desktop_home.png", width: 100%)
      ]
    ],
  )
]

#slide(title: "Desktop Application", subtitle: "Agent Management")[
  #align(center)[
    #rect(fill: light-bg, radius: 3pt, inset: 4pt)[
      #image("screenshots/ironbridge_desktop_agents.png", height: 85%)
    ]
  ]
]

#slide(title: "Mobile Application", subtitle: "React Native • Expo • iOS & Android")[
  #align(center)[
    #grid(
      columns: (auto, auto, auto, auto),
      gutter: 12pt,
      [
        #rect(fill: dark-bg, radius: 12pt, inset: 4pt)[
          #image("screenshots/ironbridge_app_home.png", height: 75%)
        ]
        #v(4pt)
        #align(center)[#text(size: 6pt, fill: grey)[Home]]
      ],
      [
        #rect(fill: dark-bg, radius: 12pt, inset: 4pt)[
          #image("screenshots/ironbridge_app_workspaces.png", height: 75%)
        ]
        #v(4pt)
        #align(center)[#text(size: 6pt, fill: grey)[Workspaces]]
      ],
      [
        #rect(fill: dark-bg, radius: 12pt, inset: 4pt)[
          #image("screenshots/ironbridge_app_sessions.png", height: 75%)
        ]
        #v(4pt)
        #align(center)[#text(size: 6pt, fill: grey)[Sessions]]
      ],
      [
        #rect(fill: dark-bg, radius: 12pt, inset: 4pt)[
          #image("screenshots/ironbridge_app_chat.png", height: 75%)
        ]
        #v(4pt)
        #align(center)[#text(size: 6pt, fill: grey)[Chat]]
      ],
    )
  ]
]

#slide(title: "VS Code Extension", subtitle: "TypeScript • VS Code API")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1.2cm,
    [
      #accent-card(title: "Features")[
        #v(4pt)
        #for feat in (
          "Sidebar panel for sessions",
          "Session recovery commands",
          "Git checkpoint integration",
          "Context menu actions",
          "Status bar indicators",
          "MCP server auto-start",
        ) [
          #text(size: 7pt, fill: text-dark)[• #feat] #v(3pt)
        ]
      ]

      #v(8pt)

      #card(title: "Commands")[
        #set text(font: "Consolas", size: 6.5pt, fill: text-dark)
        #v(2pt)
        IronBridge: Show Sessions \
        IronBridge: Recover Session \
        IronBridge: Search History \
        IronBridge: Start MCP Server \
        IronBridge: Sync Workspace
      ]
    ],
    [
      #rect(fill: rgb("#1e1e1e"), radius: 3pt, inset: 4pt, width: 100%)[
        #image("screenshots/vscode-sidebar.png", width: 100%)
      ]
    ],
  )
]

// --- AGENCY ---

#slide(title: "Agency ADK", subtitle: "Multi-Agent Orchestration Framework")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1.2cm,
    [
      #card(title: "Orchestration Patterns")[
        #v(4pt)
        #grid(
          columns: (1fr, 1fr),
          gutter: 8pt,
          [
            #text(size: 7pt, fill: grey)[SINGLE]
            #v(2pt)
            #text(size: 7pt, fill: text-dark)[Custom role + tools]
          ],
          [
            #text(size: 7pt, fill: grey)[PIPELINE]
            #v(2pt)
            #text(size: 7pt, fill: text-dark)[Sequential/parallel]
          ],

          [
            #text(size: 7pt, fill: grey)[SWARM]
            #v(2pt)
            #text(size: 7pt, fill: text-dark)[Coordinator + workers]
          ],
          [
            #text(size: 7pt, fill: grey)[PROACTIVE]
            #v(2pt)
            #text(size: 7pt, fill: text-dark)[Autonomous monitoring]
          ],
        )
      ]

      #v(8pt)

      #card(title: "Built-in Roles")[
        #grid(
          columns: (1fr, 1fr, 1fr, 1fr),
          gutter: 4pt,
          text(size: 7pt, fill: text-dark)[Coordinator],
          text(size: 7pt, fill: text-dark)[Researcher],
          text(size: 7pt, fill: text-dark)[Coder],
          text(size: 7pt, fill: text-dark)[Reviewer],

          text(size: 7pt, fill: text-dark)[Executor],
          text(size: 7pt, fill: text-dark)[Tester],
          text(size: 7pt, fill: text-dark)[Writer],
          text(size: 7pt, fill: text-dark)[Custom],
        )
      ]

      #v(8pt)

      #card(title: "Provider Support")[
        #text(size: 7pt, fill: text-dark)[OpenAI • Anthropic • Azure • Ollama • Any OpenAI-compatible]
      ]
    ],
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Rust API]]
      #v(6pt)
      #code-block(
        lang: "rust",
        "let swarm = Swarm::new(
    coordinator,
    vec![frontend, backend, tester]
);

let result = runtime
    .run_swarm(&swarm, \"Build auth system\")
    .await?;",
      )

      #v(10pt)

      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[CLI Interface]]
      #v(6pt)
      #code-block(
        "$ ironbridge agency run \\
    --orchestration swarm \\
    --agents frontend,backend,tester \\
    \"Build authentication system\"",
      )
    ],
  )
]

// --- PROVIDERS ---

#slide(title: "Supported Providers", subtitle: "Universal Compatibility")[
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 1cm,
    accent-card(title: "IDE Assistants")[
      #v(4pt)
      #for p in ("GitHub Copilot", "Cursor", "Windsurf", "Continue.dev", "Codeium") [
        #text(size: 7pt, fill: text-dark)[• #p] #v(2pt)
      ]
    ],
    accent-card(title: "Local LLMs")[
      #v(4pt)
      #for p in ("Ollama", "vLLM", "LM Studio", "LocalAI", "Jan", "GPT4All", "Llamafile") [
        #text(size: 7pt, fill: text-dark)[• #p] #v(2pt)
      ]
    ],
    accent-card(title: "Cloud APIs")[
      #v(4pt)
      #for p in ("OpenAI / ChatGPT", "Anthropic / Claude", "Google / Gemini", "Azure OpenAI", "DeepSeek", "Mistral") [
        #text(size: 7pt, fill: text-dark)[• #p] #v(2pt)
      ]
    ],
  )

  #v(12pt)

  #rect(fill: dark-bg, radius: 3pt, inset: 12pt, width: 100%)[
    #align(center)[
      #text(size: 8pt, fill: white)[
        *SHARE LINK IMPORT* — Paste ChatGPT, Claude, or Gemini share URLs to import conversations directly
      ]
    ]
  ]
]

// --- SECURITY ---

#slide(title: "Security & Compliance", subtitle: "Enterprise-Grade Protection")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1.2cm,
    [
      #accent-card(title: "Data Security")[
        #v(4pt)
        #for (item, desc) in (
          ("Local-First", "All data stored on-premises in SQLite"),
          ("Air-Gapped", "Works fully disconnected from internet"),
          ("Encrypted", "SQLite encryption extension (AES-256)"),
          ("Audit Trail", "Full activity logging with timestamps"),
          ("RBAC", "Role-based access control"),
        ) [
          #grid(
            columns: (auto, 1fr),
            gutter: 8pt,
            text(size: 7pt, fill: accent)[▸],
            [
              #text(size: 7pt, weight: "bold", fill: text-dark)[#item]
              #h(4pt)
              #text(size: 7pt, fill: grey)[#desc]
            ],
          )
          #v(3pt)
        ]
      ]

      #v(8pt)

      #card(title: "Compliance")[
        #grid(
          columns: (1fr, 1fr),
          gutter: 8pt,
          [#text(size: 7pt, fill: text-dark)[• DFARS 252.227-7015]],
          [#text(size: 7pt, fill: text-dark)[• CMMC Level 2]],

          [#text(size: 7pt, fill: text-dark)[• FedRAMP Ready]], [#text(size: 7pt, fill: text-dark)[• NIST 800-171]],
        )
      ]
    ],
    [
      #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Deployment Options]]
      #v(8pt)

      #rect(fill: light-bg, radius: 3pt, inset: 10pt, width: 100%)[
        #text(size: 7pt, fill: grey)[STANDALONE]
        #v(4pt)
        #text(size: 8pt, fill: text-dark)[Single binary, zero dependencies]
        #v(2pt)
        #code-block("$ ironbridge api serve --tls --port 8787")
      ]

      #v(8pt)

      #rect(fill: light-bg, radius: 3pt, inset: 10pt, width: 100%)[
        #text(size: 7pt, fill: grey)[CONTAINER]
        #v(4pt)
        #text(size: 8pt, fill: text-dark)[Docker / Podman deployment]
        #v(2pt)
        #code-block("$ docker run ghcr.io/nervosys/IronBridge")
      ]

      #v(8pt)

      #rect(fill: light-bg, radius: 3pt, inset: 10pt, width: 100%)[
        #text(size: 7pt, fill: grey)[ENTERPRISE]
        #v(4pt)
        #text(size: 8pt, fill: text-dark)[Kubernetes with HA, SSO, LDAP]
        #v(2pt)
        #code-block("$ helm install ironbridge nervosys/IronBridge")
      ]
    ],
  )
]

// --- PRICING ---

#slide(title: "Licensing", subtitle: "Flexible Options")[
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 1cm,
    // Community
    card[
      #align(center)[
        #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Community]]
        #v(8pt)
        #text(size: 28pt, weight: "bold", fill: text-dark)[Free]
        #v(4pt)
        #text(size: 7pt, fill: grey)[Open Source]
      ]
      #v(12pt)
      #line(length: 100%, stroke: 0.5pt + rgb("#e0e0e0"))
      #v(12pt)
      #for f in ("CLI + TUI", "Single user", "Local providers", "Basic search", "Community support") [
        #text(size: 7pt, fill: text-dark)[• #f] #v(3pt)
      ]
    ],
    // Professional
    accent-card[
      #align(center)[
        #text(size: 7pt, fill: accent, tracking: 0.5pt)[#upper[Professional]]
        #v(8pt)
        #text(size: 28pt, weight: "bold", fill: text-dark)[\$499]
        #text(size: 9pt, fill: grey)[/yr]
        #v(4pt)
        #text(size: 7pt, fill: grey)[Per seat]
      ]
      #v(12pt)
      #line(length: 100%, stroke: 0.5pt + rgb("#e0e0e0"))
      #v(12pt)
      #for f in ("All platforms", "Team sharing", "Cloud providers", "Agency ADK", "Priority support") [
        #text(size: 7pt, fill: text-dark)[• #f] #v(3pt)
      ]
    ],
    // Enterprise
    card[
      #align(center)[
        #text(size: 7pt, fill: grey, tracking: 0.5pt)[#upper[Enterprise]]
        #v(8pt)
        #text(size: 28pt, weight: "bold", fill: text-dark)[Custom]
        #v(4pt)
        #text(size: 7pt, fill: grey)[Contact us]
      ]
      #v(12pt)
      #line(length: 100%, stroke: 0.5pt + rgb("#e0e0e0"))
      #v(12pt)
      #for f in ("Unlimited seats", "SSO / LDAP", "Air-gapped deploy", "Custom integrations", "24/7 SLA support") [
        #text(size: 7pt, fill: text-dark)[• #f] #v(3pt)
      ]
    ],
  )

  #v(10pt)

  #align(center)[
    #text(size: 7pt, fill: grey)[Government pricing available under GSA Schedule]
  ]
]

// --- Q1-Q2 2026 ENHANCEMENTS ---

#section-slide(title: "New Features")

#slide(title: "Q1-Q2 2026 Enhancements", subtitle: "Session Management Power Tools")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1.2cm,
    [
      #accent-card(title: "Session Annotations")[
        #v(4pt)
        #for feat in (
          "Color-coded tags for categorization",
          "Rich text notes per session",
          "Message highlighting with colors",
          "Bookmarks for quick navigation",
          "18 predefined tag/highlight colors",
        ) [
          #text(size: 7pt, fill: text-dark)[• #feat] #v(3pt)
        ]
      ]

      #v(8pt)

      #accent-card(title: "Session Templates")[
        #v(4pt)
        #for feat in (
          "8 built-in templates (code-review, debug, etc.)",
          "Custom system prompts",
          "Pre-configured model parameters",
          "Initial message scaffolding",
          "Suggested query shortcuts",
        ) [
          #text(size: 7pt, fill: text-dark)[• #feat] #v(3pt)
        ]
      ]
    ],
    [
      #accent-card(title: "Keyboard Shortcuts")[
        #v(4pt)
        #for feat in (
          "40+ configurable shortcuts",
          "Categories: navigation, editing, search, UI",
          "Global and context-aware bindings",
          "Conflict detection & resolution",
          "Import/export shortcut profiles",
        ) [
          #text(size: 7pt, fill: text-dark)[• #feat] #v(3pt)
        ]
      ]

      #v(8pt)

      #accent-card(title: "Batch Operations")[
        #v(4pt)
        #for feat in (
          "Multi-select with shift/ctrl",
          "Bulk delete, archive, export",
          "Batch tagging across sessions",
          "Progress tracking & cancellation",
          "Undo support for bulk actions",
        ) [
          #text(size: 7pt, fill: text-dark)[• #feat] #v(3pt)
        ]
      ]
    ],
  )
]

// --- SUMMARY ---

#slide(title: "Why IronBridge", subtitle: "Key Differentiators")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1.2cm,
    [
      #for (icon, title, desc) in (
        ("◆", "Local-First", "Data never leaves your infrastructure"),
        ("◆", "Rust Performance", "Sub-ms queries on millions of messages"),
        ("◆", "Universal", "Every provider, every platform, one tool"),
        ("◆", "Power User Tools", "Annotations, templates, 40+ shortcuts"),
        ("◆", "Zero Dependencies", "Single binary, instant deployment"),
        ("◆", "Compliance Ready", "DFARS, CMMC, FedRAMP, NIST 800-171"),
      ) [
        #grid(
          columns: (12pt, 1fr),
          gutter: 8pt,
          text(size: 10pt, fill: accent)[#icon],
          [
            #text(size: 8pt, weight: "bold", fill: text-dark)[#title]
            #h(6pt)
            #text(size: 7pt, fill: grey)[#desc]
          ],
        )
        #v(6pt)
      ]
    ],
    [
      #accent-card(title: "Platform Matrix")[
        #v(4pt)
        #table(
          columns: (auto, 1fr),
          stroke: none,
          inset: 4pt,
          row-gutter: 2pt,
          text(size: 7pt, weight: "bold", fill: text-dark)[ironbridge-cli],
          text(size: 7pt, fill: grey)[Power users, automation, CI/CD],

          text(size: 7pt, weight: "bold", fill: text-dark)[ironbridge-web],
          text(size: 7pt, fill: grey)[Browser-based dashboard],

          text(size: 7pt, weight: "bold", fill: text-dark)[ironbridge-desktop],
          text(size: 7pt, fill: grey)[Native app, system integration],

          text(size: 7pt, weight: "bold", fill: text-dark)[ironbridge-app],
          text(size: 7pt, fill: grey)[Mobile access iOS/Android],

          text(size: 7pt, weight: "bold", fill: text-dark)[vscode-ext], text(size: 7pt, fill: grey)[IDE integration],
        )
      ]

      #v(12pt)

      #rect(fill: accent, radius: 3pt, inset: 12pt, width: 100%)[
        #align(center)[
          #text(size: 9pt, fill: white, weight: "bold")[sales\@nervosys.ai]
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
  fill: dark-bg,
  footer: [
    #v(4pt)
    #align(center)[
      #set text(size: 5pt, fill: lightgrey, tracking: 0.5pt)
      #upper[Nervosys Proprietary — Commercial Computer Software (DFARS 252.227-7015) — Government Rights Restricted — Not For Public Release]
    ]
    #v(8pt)
  ],
)[
  #align(center + horizon)[
    #box(inset: 2cm)[
      #title-text[#upper[IronBridge]]
      #v(0.6cm)
      #line(length: 6cm, stroke: 2pt + accent)
      #v(0.6cm)
      #subtitle-text[Never Lose an AI Conversation Again]
      #v(2cm)
      #text(size: 10pt, fill: grey, tracking: 0.5pt)[#upper[Nervosys LLC]]
      #v(0.5cm)
      #text(size: 9pt, fill: lightgrey)[sales\@nervosys.ai  ·  nervosys.ai/ironbridge]
      #v(1cm)
      #text(size: 11pt, style: "italic", fill: lightgrey)[
        The future is what we make.#sym.trademark
      ]
    ]
  ]
]
