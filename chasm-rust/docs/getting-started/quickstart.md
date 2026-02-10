# Quick Start

Get from zero to searching your AI chat history in 5 minutes.

## Step 1: Install

```bash
cargo install chasm
```

## Step 2: Recover Sessions

If you've lost VS Code chat history after an update or crash:

```bash
chasm fetch path /path/to/your/project
```

Then reload VS Code (`Ctrl+R`) — your sessions should reappear in the Chat history dropdown.

## Step 3: Harvest Everything

Collect sessions from all detected AI providers into a unified database:

```bash
chasm harvest run
```

## Step 4: Search

Full-text search across every conversation:

```bash
chasm harvest search "authentication"
chasm harvest search "react component"
chasm harvest search "that bug I fixed last week"
```

## Common Workflows

### Browse sessions interactively

```bash
chasm tui
```

### Export a session to Markdown

```bash
chasm export session <session-id> --format markdown --output chat.md
```

### Merge sessions from different workspaces

```bash
chasm merge workspace my-project
```

### Chat with a local AI model

=== "Ollama"

    ```bash
    ollama serve           # Start Ollama (if not running)
    chasm run ollama --model mistral
    ```

=== "Claude"

    ```bash
    export ANTHROPIC_API_KEY=sk-ant-...
    chasm run claude
    ```

=== "ChatGPT"

    ```bash
    export OPENAI_API_KEY=sk-...
    chasm run chatgpt
    ```

### Run an AI agent

```bash
chasm agency run --agent coder "Write a rate limiter in Rust"
```

### Start the API server

```bash
chasm api serve --port 8787
curl http://localhost:8787/api/stats
```

### Git-version your sessions

```bash
chasm git init /path/to/project
chasm git commit /path/to/project -m "Initial session capture"
```

## What's Next?

<div class="grid cards" markdown>

-   :material-cog: **Configuration**

    ---

    Set up API keys, configure providers, and customize behavior.

    [:octicons-arrow-right-24: Configuration](configuration.md)

-   :material-backup-restore: **First Recovery**

    ---

    Detailed walkthrough of recovering lost sessions.

    [:octicons-arrow-right-24: First Recovery](first-recovery.md)

-   :material-console: **CLI Reference**

    ---

    Complete command reference.

    [:octicons-arrow-right-24: CLI Reference](../api/cli.md)

</div>
