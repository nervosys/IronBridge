# Open Source Strategy: IRONBRIDGE-Rust

## Executive Summary

This document outlines the strategy for releasing **ironbridge-rust** (the Chat Session Manager CLI and API backend) as open-source software while maintaining **ironbridge-web** and **ironbridge-app** as proprietary products.

This follows the successful "open core" model used by companies like:

- **GitLab** (open-source core, proprietary enterprise features)
- **Supabase** (open-source backend, hosted service)
- **Bitwarden** (open-source core, proprietary apps/hosting)
- **Grafana** (open-source core, proprietary cloud)

---

## 1. Repository Structure

### Current State

```bash
ChatSessionManager/           # Single private repo
├── ironbridge-rust/                 # CLI + API backend
├── ironbridge-web/                  # React web app
├── ironbridge-app/                  # React Native mobile app
└── vscode-extension/         # VS Code extension
```

### Target State

```bash
# PUBLIC REPOSITORIES
nervosys/ironbridge                # Open-source CLI + API (renamed)
nervosys/ironbridge-vscode         # Open-source VS Code extension (optional)

# PRIVATE REPOSITORIES  
nervosys/ironbridge-web              # Proprietary web app
nervosys/ironbridge-app              # Proprietary mobile app
nervosys/ironbridge-cloud            # Future: hosted service infrastructure
```

### Migration Steps

1. **Create new public repo**: `nervosys/ironbridge`
2. **Extract ironbridge-rust** with clean git history (no proprietary references)
3. **Update imports/references** in private repos to use published crate
4. **Set up CI/CD** for public releases

---

## 2. Licensing Strategy

### Open Source Component (ironbridge-rust → ironbridge)

**License: AGPL-3.0-only with Commercial Dual-License**

| License        | Pros                                        | Cons                 |
| -------------- | ------------------------------------------- | -------------------- |
| **MIT**        | Simple, permissive, widely understood       | No patent protection |
| **Apache 2.0** | Patent protection, permissive               | More complex         |
| **MPL 2.0**    | File-level copyleft, allows proprietary use | Less common          |
| **AGPL-3.0** ✅ | Strong copyleft, SaaS protection            | May deter adoption   |

**Decision: AGPL-3.0-only + Commercial Dual-License + CLA**

- Strong copyleft ensures open-source contributions flow back
- SaaS protection via AGPL network-use clause
- Commercial license available for proprietary / SaaS redistribution
- CLA enables dual-license model for contributors

### Proprietary Components

```text
ironbridge-web/LICENSE
ironbridge-app/LICENSE

Copyright (c) 2024-2026 Nervosys LLC. All Rights Reserved.

This software is proprietary and confidential. Unauthorized copying,
modification, distribution, or use of this software, via any medium,
is strictly prohibited without express written permission.
```

---

## 3. Public API Design Principles

The API exposed by ironbridge-rust must be designed to:

### ✅ DO

- Provide generic, reusable endpoints
- Document all public APIs thoroughly
- Version the API (v1, v2, etc.)
- Support multiple authentication methods
- Be provider-agnostic (work with any chat provider)

### ❌ DON'T

- Include business logic specific to proprietary apps
- Expose internal implementation details
- Include analytics/telemetry tied to proprietary services
- Hard-code references to ironbridge-web/ironbridge-app

### API Boundary Definition

```
┌─────────────────────────────────────────────────────────────┐
│                    OPEN SOURCE (ironbridge)                      │
├─────────────────────────────────────────────────────────────┤
│  CLI Commands        │  REST API            │  MCP Tools    │
│  - list workspaces   │  GET /api/workspaces │  - list_*     │
│  - show session      │  GET /api/sessions   │  - search_*   │
│  - merge sessions    │  GET /api/stats      │  - export_*   │
│  - export markdown   │  POST /api/agents    │               │
│  - harvest           │  GET /sync/*         │               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PROPRIETARY CLIENTS                       │
├─────────────────────────────────────────────────────────────┤
│  ironbridge-web             │  ironbridge-app             │  ironbridge-cloud    │
│  - Dashboard UI      │  - Mobile UI         │  - Hosting    │
│  - Analytics views   │  - Push notifs       │  - Team sync  │
│  - Team features     │  - Offline mode      │  - Enterprise │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Code Audit Checklist

Before open-sourcing, audit ironbridge-rust for:

### Security

- [x] Remove any hardcoded credentials/API keys
- [x] Remove internal URLs/endpoints
- [x] Remove employee names from comments
- [x] Audit dependencies for vulnerabilities (cargo-deny configured)
- [x] Remove any proprietary algorithm implementations

### Legal

- [x] Ensure all dependencies are license-compatible (cargo-deny configured)
- [x] Remove any third-party proprietary code
- [x] Add license headers to all source files
- [x] Create NOTICE file for attribution
- [x] Review git history for sensitive commits

### Branding

- [x] Finalize public name (ironbridge vs ironbridge) → ironbridge-cli
- [x] Update all references in code
- [ ] Create public-facing logo/branding
- [x] Register crates.io name (ironbridge-cli)

### Documentation

- [x] Write comprehensive README
- [x] Create CONTRIBUTING.md
- [x] Add CODE_OF_CONDUCT.md
- [x] Document all CLI commands (in README)
- [x] Document API endpoints (docs/API.md)
- [x] Add architecture diagrams (docs/ARCHITECTURE.md)

---

## 5. Release Artifacts

### Crates.io Publication

```toml
# Cargo.toml
[package]
name = "ironbridge"
version = "1.0.0"
edition = "2021"
license = "AGPL-3.0-only OR LicenseRef-IronBridge-Commercial"
description = "Universal chat session manager - harvest, merge, and analyze AI chat history"
repository = "https://github.com/nervosys/ironbridge"
documentation = "https://docs.rs/ironbridge"
keywords = ["chat", "ai", "copilot", "session", "history"]
categories = ["command-line-utilities", "database"]
```

### Binary Releases

- Windows: `ironbridge-windows-x64.exe`
- macOS: `ironbridge-darwin-x64`, `ironbridge-darwin-arm64`
- Linux: `ironbridge-linux-x64`, `ironbridge-linux-arm64`

### Container Images

```dockerfile
# Published to ghcr.io/nervosys/ironbridge
FROM rust:alpine AS builder
COPY . .
RUN cargo build --release

FROM alpine:latest
COPY --from=builder /app/target/release/ironbridge /usr/local/bin/
EXPOSE 8787
CMD ["ironbridge", "api", "serve"]
```

---

## 6. Proprietary Feature Boundaries

### Features to Keep Proprietary

> **⚠️ SSO no longer matches this table.** The row below says SSO belongs in
> `ironbridge-cloud`. In the tree today, both SAML *and* OIDC ship in this AGPL
> repository, behind `--features enterprise`: `ironbridge-rust/src/api/{sso,oidc}.rs`
> serve 14 of the 25 enterprise operations, on the pure-Rust `ironbridge-sso` crate.
>
> This is recorded, not resolved. The table states the intended boundary and
> the tree states what was built; they disagree, and which one changes is a
> business decision. Two things worth knowing while deciding:
>
> - `ironbridge-sso` is a standalone crate. A future `ironbridge-cloud` can depend on it
>   without any of the REST surface in `ironbridge-rust`, so moving the *endpoints*
>   later does not mean rewriting the protocol work.
> - Under AGPL-3.0-only, what has already shipped stays shipped. Removing the
>   endpoints changes future releases; it does not retract released ones.
>
> One half of the contradiction *has* been resolved:
> [`COMMERCIAL_LICENSE.md`](COMMERCIAL_LICENSE.md) no longer advertises SSO as
> something a commercial license grants access to, because it isn't — it
> describes what the license actually changes, which is the copyleft
> obligation. The table below still states an unmet intent.

| Feature                          | Reason                  | Location      |
| -------------------------------- | ----------------------- | ------------- |
| Team/Organization sync           | Enterprise value        | ironbridge-cloud     |
| Custom analytics dashboards      | Product differentiation | ironbridge-web       |
| Push notifications               | Mobile value            | ironbridge-app       |
| Offline-first mobile             | Mobile value            | ironbridge-app       |
| White-label branding             | Enterprise value        | ironbridge-cloud     |
| SSO/SAML integration             | Enterprise value        | ironbridge-cloud — **but see the note above: it ships in `ironbridge` today** |
| Advanced search/filtering UI     | Product differentiation | ironbridge-web       |
| Session commenting/collaboration | Team feature            | ironbridge-web/cloud |

### Features to Open Source

| Feature              | Reason                  | Location     |
| -------------------- | ----------------------- | ------------ |
| Core database schema | Foundation              | ironbridge        |
| CLI commands         | Developer utility       | ironbridge        |
| REST API             | Integration point       | ironbridge        |
| Provider harvesting  | Community contributions | ironbridge        |
| MCP tools            | AI integration          | ironbridge        |
| Basic sync protocol  | Enables self-hosting    | ironbridge        |
| VS Code extension    | Developer adoption      | ironbridge-vscode |

---

## 7. Community & Governance

### Contribution Model

```markdown
# CONTRIBUTING.md

## Contributor License Agreement (CLA)

By contributing to this project, you agree that:
1. Your contributions are your original work
2. You grant Nervosys LLC a perpetual, irrevocable license to use your contributions
3. Nervosys may use contributions in proprietary products

## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Submit a pull request
5. Sign the CLA (automated via CLA Assistant)
```

### Governance Structure

- **Maintainers**: Nervosys team (final decision authority)
- **Contributors**: Community members with merged PRs
- **Users**: Anyone using the software

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: Q&A, ideas
- **Discord**: Real-time community chat (optional)

---

## 8. Monetization Strategy

### Revenue Streams

| Stream                   | Description                               | Target                   |
| ------------------------ | ----------------------------------------- | ------------------------ |
| **ironbridge-web Pro**          | Advanced web features, team collaboration | Individuals, small teams |
| **ironbridge-app Premium**      | Mobile app subscription                   | Mobile users             |
| **ironbridge-cloud Enterprise** | Hosted service, SSO, audit logs           | Enterprises              |
| **Support contracts**    | Priority support, consulting              | Enterprises              |
| **Sponsorships**         | GitHub Sponsors, Open Collective          | Community                |

### Pricing Tiers (Example)

```tree
FREE (Open Source CLI)
├── Unlimited local sessions
├── All CLI commands
├── Self-hosted API
└── Community support

PRO ($9/mo)
├── ironbridge-web full features
├── ironbridge-app full features
├── Cloud sync (personal)
└── Email support

TEAM ($29/user/mo)
├── Everything in Pro
├── Team workspaces
├── Shared sessions
├── Admin dashboard
└── Priority support

ENTERPRISE (Custom)
├── Everything in Team
├── SSO/SAML
├── Audit logs
├── On-premise deployment
├── Dedicated support
└── Custom integrations
```

---

## 9. Migration Timeline

### Phase 1: Preparation (2 weeks) ✅

- [x] Complete code audit
- [x] Remove proprietary references
- [x] Finalize licensing (AGPL-3.0-only + commercial dual-license)
- [x] Create public documentation
- [x] Set up new public repository (nervosys/ironbridge-cli)

### Phase 2: Soft Launch (2 weeks) ✅

- [x] Push to public repo (no announcement)
- [x] Publish to crates.io (ironbridge-cli v1.0.0)
- [x] Set up CI/CD for releases (GitHub Actions)
- [x] Gather early feedback from select users
- [x] Fix any issues discovered (reqwest CVE, cargo-deny)

### Phase 3: Public Launch (1 week)

- [ ] Write launch blog post
- [ ] Submit to Hacker News, Reddit
- [ ] Tweet/social media announcement
- [ ] Update private repos to use published crate

### Phase 4: Ongoing

- [ ] Regular releases (semantic versioning)
- [ ] Community engagement
- [ ] Feature development based on feedback
- [ ] Security updates

---

## 10. Risk Mitigation

| Risk                             | Mitigation                                         |
| -------------------------------- | -------------------------------------------------- |
| Competitor forks and competes    | Focus on proprietary value-add, community building |
| Security vulnerabilities exposed | Responsible disclosure policy, security audits     |
| Community toxicity               | Code of Conduct, active moderation                 |
| Legal issues                     | CLA, license compliance checks                     |
| Support burden                   | Clear documentation, community self-help           |

---

## 11. Success Metrics

### Adoption Metrics

- GitHub stars
- Crates.io downloads
- Docker pulls
- Active contributors

### Business Metrics

- Conversion rate (free → paid)
- Customer acquisition cost
- Lifetime value
- Churn rate

### Community Metrics

- Issues opened/closed
- PR merge rate
- Response time
- Community sentiment

---

## Appendix A: License Header Template

```rust
// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//
// This file is part of IronBridge - Universal Chat Session Manager
// https://github.com/nervosys/ironbridge
```

## Appendix B: README Template

```markdown
# IronBridge 🗄️

**Universal Chat Session Manager** - Harvest, merge, and analyze your AI chat history.

[![Crates.io](https://img.shields.io/crates/v/ironbridge)](https://crates.io/crates/ironbridge)
[![License](https://img.shields.io/badge/license-AGPL_3.0-blue.svg)](LICENSE)
[![CI](https://github.com/nervosys/ironbridge/workflows/CI/badge.svg)](https://github.com/nervosys/ironbridge/actions)

## Features

- 🔍 **Harvest** chat sessions from VS Code, Cursor, and other editors
- 🔀 **Merge** sessions across workspaces and time
- 📊 **Analyze** your AI coding assistant usage
- 🔌 **API Server** for building custom integrations
- 🤖 **MCP Tools** for AI agent integration

## Installation

```bash
cargo install ironbridge
```

## Quick Start

```bash
# List all workspaces
ironbridge list workspaces

# Show sessions for a project
ironbridge show path /path/to/project

# Start the API server
ironbridge api serve
```

## Documentation

- [CLI Reference](docs/CLI.md)
- [API Documentation](docs/API.md)
- [Provider Support](docs/PROVIDERS.md)

## License

Licensed under [AGPL-3.0](LICENSE) with [commercial dual-license](COMMERCIAL_LICENSE.md) available. See [CLA.md](CLA.md) for contributor terms.

## Appendix C: File Structure for Public Repo

```bash
ironbridge/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── release.yml
│   │   └── security.yml
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── FUNDING.yml
├── docs/
│   ├── CLI.md
│   ├── API.md
│   ├── PROVIDERS.md
│   └── ARCHITECTURE.md
├── examples/
│   ├── basic_usage.rs
│   └── custom_provider.rs
├── src/
│   └── ... (cleaned source)
├── tests/
├── Cargo.toml
├── LICENSE
├── COMMERCIAL_LICENSE.md
├── CLA.md
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── NOTICE
```

---

## Decision Required

Before proceeding, decisions needed on:

1. **Name**: Keep "ironbridge" or use different name?
2. **License**: AGPL-3.0-only + commercial dual-license ✅
3. **VS Code Extension**: Open source with CLI or keep proprietary?
4. **Timeline**: When to begin Phase 1?
5. **CLA**: CLA required (enables dual-license model) ✅

---

*Document Version: 1.0*
*Last Updated: January 8, 2026*
*Author: Nervosys Engineering*
