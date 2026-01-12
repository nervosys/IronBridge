# Open Source Strategy: CSM-Rust

## Executive Summary

This document outlines the strategy for releasing **csm-rust** (the Chat Session Manager CLI and API backend) as open-source software while maintaining **csm-web** and **csm-app** as proprietary products.

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
├── csm-rust/                 # CLI + API backend
├── csm-web/                  # React web app
├── csm-app/                  # React Native mobile app
└── vscode-extension/         # VS Code extension
```

### Target State

```bash
# PUBLIC REPOSITORIES
nervosys/chasm                # Open-source CLI + API (renamed)
nervosys/chasm-vscode         # Open-source VS Code extension (optional)

# PRIVATE REPOSITORIES  
nervosys/csm-web              # Proprietary web app
nervosys/csm-app              # Proprietary mobile app
nervosys/csm-cloud            # Future: hosted service infrastructure
```

### Migration Steps

1. **Create new public repo**: `nervosys/chasm`
2. **Extract csm-rust** with clean git history (no proprietary references)
3. **Update imports/references** in private repos to use published crate
4. **Set up CI/CD** for public releases

---

## 2. Licensing Strategy

### Open Source Component (csm-rust → chasm)

**Recommended License: MIT or Apache 2.0**

| License        | Pros                                        | Cons                 |
| -------------- | ------------------------------------------- | -------------------- |
| **MIT**        | Simple, permissive, widely understood       | No patent protection |
| **Apache 2.0** | Patent protection, permissive               | More complex         |
| **MPL 2.0**    | File-level copyleft, allows proprietary use | Less common          |
| **AGPL**       | Strong copyleft                             | May deter adoption   |

**Recommendation: Dual MIT/Apache 2.0** (like Rust itself)

- Maximum compatibility
- Patent protection via Apache
- Encourages adoption

### Proprietary Components

```text
csm-web/LICENSE
csm-app/LICENSE

Copyright (c) 2024-2026 Nervosys LLC. All Rights Reserved.

This software is proprietary and confidential. Unauthorized copying,
modification, distribution, or use of this software, via any medium,
is strictly prohibited without express written permission.
```

---

## 3. Public API Design Principles

The API exposed by csm-rust must be designed to:

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
- Hard-code references to csm-web/csm-app

### API Boundary Definition

```
┌─────────────────────────────────────────────────────────────┐
│                    OPEN SOURCE (chasm)                      │
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
│  csm-web             │  csm-app             │  csm-cloud    │
│  - Dashboard UI      │  - Mobile UI         │  - Hosting    │
│  - Analytics views   │  - Push notifs       │  - Team sync  │
│  - Team features     │  - Offline mode      │  - Enterprise │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Code Audit Checklist

Before open-sourcing, audit csm-rust for:

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

- [x] Finalize public name (chasm vs csm) → chasm-cli
- [x] Update all references in code
- [ ] Create public-facing logo/branding
- [x] Register crates.io name (chasm-cli)

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
name = "chasm"
version = "1.0.0"
edition = "2021"
license = "MIT OR Apache-2.0"
description = "Universal chat session manager - harvest, merge, and analyze AI chat history"
repository = "https://github.com/nervosys/chasm"
documentation = "https://docs.rs/chasm"
keywords = ["chat", "ai", "copilot", "session", "history"]
categories = ["command-line-utilities", "database"]
```

### Binary Releases

- Windows: `chasm-windows-x64.exe`
- macOS: `chasm-darwin-x64`, `chasm-darwin-arm64`
- Linux: `chasm-linux-x64`, `chasm-linux-arm64`

### Container Images

```dockerfile
# Published to ghcr.io/nervosys/chasm
FROM rust:alpine AS builder
COPY . .
RUN cargo build --release

FROM alpine:latest
COPY --from=builder /app/target/release/chasm /usr/local/bin/
EXPOSE 8787
CMD ["chasm", "api", "serve"]
```

---

## 6. Proprietary Feature Boundaries

### Features to Keep Proprietary

| Feature                          | Reason                  | Location      |
| -------------------------------- | ----------------------- | ------------- |
| Team/Organization sync           | Enterprise value        | csm-cloud     |
| Custom analytics dashboards      | Product differentiation | csm-web       |
| Push notifications               | Mobile value            | csm-app       |
| Offline-first mobile             | Mobile value            | csm-app       |
| White-label branding             | Enterprise value        | csm-cloud     |
| SSO/SAML integration             | Enterprise value        | csm-cloud     |
| Advanced search/filtering UI     | Product differentiation | csm-web       |
| Session commenting/collaboration | Team feature            | csm-web/cloud |

### Features to Open Source

| Feature              | Reason                  | Location     |
| -------------------- | ----------------------- | ------------ |
| Core database schema | Foundation              | chasm        |
| CLI commands         | Developer utility       | chasm        |
| REST API             | Integration point       | chasm        |
| Provider harvesting  | Community contributions | chasm        |
| MCP tools            | AI integration          | chasm        |
| Basic sync protocol  | Enables self-hosting    | chasm        |
| VS Code extension    | Developer adoption      | chasm-vscode |

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
| **csm-web Pro**          | Advanced web features, team collaboration | Individuals, small teams |
| **csm-app Premium**      | Mobile app subscription                   | Mobile users             |
| **csm-cloud Enterprise** | Hosted service, SSO, audit logs           | Enterprises              |
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
├── csm-web full features
├── csm-app full features
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
- [x] Finalize licensing (Apache-2.0)
- [x] Create public documentation
- [x] Set up new public repository (nervosys/chasm-cli)

### Phase 2: Soft Launch (2 weeks) ✅

- [x] Push to public repo (no announcement)
- [x] Publish to crates.io (chasm-cli v1.0.0)
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
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// This file is part of Chasm - Universal Chat Session Manager
// https://github.com/nervosys/chasm
```

## Appendix B: README Template

```markdown
# Chasm 🗄️

**Universal Chat Session Manager** - Harvest, merge, and analyze your AI chat history.

[![Crates.io](https://img.shields.io/crates/v/chasm)](https://crates.io/crates/chasm)
[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue)](LICENSE)
[![CI](https://github.com/nervosys/chasm/workflows/CI/badge.svg)](https://github.com/nervosys/chasm/actions)

## Features

- 🔍 **Harvest** chat sessions from VS Code, Cursor, and other editors
- 🔀 **Merge** sessions across workspaces and time
- 📊 **Analyze** your AI coding assistant usage
- 🔌 **API Server** for building custom integrations
- 🤖 **MCP Tools** for AI agent integration

## Installation

```bash
cargo install chasm
```

## Quick Start

```bash
# List all workspaces
chasm list workspaces

# Show sessions for a project
chasm show path /path/to/project

# Start the API server
chasm api serve
```

## Documentation

- [CLI Reference](docs/CLI.md)
- [API Documentation](docs/API.md)
- [Provider Support](docs/PROVIDERS.md)

## License

Licensed under either of Apache License, Version 2.0 or MIT license at your option.

## Appendix C: File Structure for Public Repo

```bash
chasm/
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
├── LICENSE-MIT
├── LICENSE-APACHE
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

1. **Name**: Keep "chasm" or use different name?
2. **License**: MIT/Apache-2.0 dual license or single license?
3. **VS Code Extension**: Open source with CLI or keep proprietary?
4. **Timeline**: When to begin Phase 1?
5. **CLA**: Require CLA or use DCO (Developer Certificate of Origin)?

---

*Document Version: 1.0*
*Last Updated: January 8, 2026*
*Author: Nervosys Engineering*
