# Agent Skills for IronBridge

A collection of AI agent skills for working with [IronBridge](https://github.com/nervosys/ironbridge-cli)
session histories. These skills give AI coding agents (Claude Code, Codex CLI,
Cursor, Copilot, Gemini CLI, etc.) specialized knowledge for analyzing,
organizing, and extracting insights from AI-assisted coding sessions.

Unlike simple markdown-file skills, IronBridge skills leverage a **structured SQLite
database** with normalized tables (sessions, messages, tool_invocations,
file_changes), **FTS5 full-text search**, and a **REST/GraphQL API** — making
them far more powerful than flat file analysis.

## Available Skills

| Skill | Description |
|-------|-------------|
| [session-summary](session-summary.md) | Generate standup-ready summaries of recent coding sessions |
| [yak-detector](yak-detector.md) | Detect scope creep and yak-shaving in coding sessions |
| [code-insight](code-insight.md) | Analyze tool invocations and file changes for code quality insights |
| [session-organizer](session-organizer.md) | Organize and tag sessions by project, topic, and outcome |
| [secret-guard](secret-guard.md) | Scan session history for accidentally leaked secrets |
| [link-trail](link-trail.md) | Track and catalog all URLs referenced during sessions |

## Installation

### Option 1: Copy to your project

```bash
# Copy all skills to your project's agent skills directory
cp -r skills/ .claude/skills/     # Claude Code
cp -r skills/ .cursor/skills/     # Cursor
cp -r skills/ .agents/skills/     # Generic
```

### Option 2: Reference from ironbridge

Skills are bundled with ironbridge and can be listed via:

```bash
ironbridge agency templates
```

## Prerequisites

These skills work with the ironbridge harvest database. Run the following to set up:

```bash
# Initialize the harvest database
ironbridge harvest init

# Scan for providers and sessions
ironbridge harvest scan

# Harvest all sessions into the database
ironbridge harvest run
```

Once harvested, skills can query the database directly via SQL or through the
ironbridge API server.

## Usage

Ask your AI coding agent to help with ironbridge-related tasks:

```
"Summarize my coding sessions from this week"
→ Uses session-summary skill

"Am I yak-shaving? Check my last 5 sessions"
→ Uses yak-detector skill

"What files did I change most across my sessions?"
→ Uses code-insight skill

"Organize my sessions by project"
→ Uses session-organizer skill

"Scan my session history for secrets"
→ Uses secret-guard skill

"What URLs did I visit in my last session?"
→ Uses link-trail skill
```

## License

[AGPL-3.0](../LICENSE) with [commercial dual-license](../COMMERCIAL_LICENSE.md) — same as the ironbridge ecosystem.
