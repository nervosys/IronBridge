# API Reference

IronBridge exposes three interface layers — a **CLI** for direct use, a **REST API** for integration, and an **MCP server** for AI agent tooling.

<div class="grid cards" markdown>

-   :material-console: **CLI Reference**

    ---

    Complete command reference for every `ironbridge` subcommand — recovery, harvest, merge, export, agency, and more.

    [:octicons-arrow-right-24: CLI Reference](cli.md)

-   :material-api: **REST API**

    ---

    HTTP endpoints for workspaces, sessions, recording, and the Agency agent CRUD API.

    [:octicons-arrow-right-24: REST API](rest.md)

-   :material-robot: **MCP Server**

    ---

    Model Context Protocol tools for integrating IronBridge into AI agent workflows.

    [:octicons-arrow-right-24: MCP Tools](mcp.md)

-   :material-swap-horizontal: **Providers**

    ---

    Supported AI providers — editors, local LLMs, and cloud APIs.

    [:octicons-arrow-right-24: Providers](providers.md)

</div>

## Interface Matrix

| Capability | CLI | REST | MCP |
|---|:---:|:---:|:---:|
| List workspaces | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| List sessions | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| View session content | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Search sessions | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Database statistics | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Harvest / sync | :white_check_mark: | — | — |
| Session recovery | :white_check_mark: | — | — |
| Merge sessions | :white_check_mark: | — | — |
| Export / import | :white_check_mark: | — | — |
| Real-time recording | — | :white_check_mark: | — |
| Agent CRUD | :white_check_mark: | :white_check_mark: | — |
| Swarm orchestration | :white_check_mark: | :white_check_mark: | — |
| TUI browser | :white_check_mark: | — | — |
| Git versioning | :white_check_mark: | — | — |
