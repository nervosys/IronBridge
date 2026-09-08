# Quick Start

Get from zero to searching your AI chat history in 5 minutes.

## Step 1: Install

```bash
cargo install ironbridge
```

## Step 2: Recover Sessions

If you've lost VS Code chat history after an update or crash:

```bash
ironbridge fetch path /path/to/your/project
```

Then reload VS Code (`Ctrl+R`) — your sessions should reappear in the Chat history dropdown.

## Step 3: Harvest Everything

Collect sessions from all detected AI providers into a unified database:

```bash
ironbridge harvest run
```

## Step 4: Search

Full-text search across every conversation:

```bash
ironbridge harvest search "authentication"
ironbridge harvest search "react component"
ironbridge harvest search "that bug I fixed last week"
```

## Common Workflows

### Browse sessions interactively

```bash
ironbridge tui
```

### Export a session to Markdown

```bash
ironbridge export session <session-id> --format markdown --output chat.md
```

### Merge sessions from different workspaces

```bash
ironbridge merge workspace my-project
```

### Chat with a local AI model

=== "Ollama"

    ```bash
    ollama serve           # Start Ollama (if not running)
    ironbridge run ollama --model mistral
    ```

=== "Claude"

    ```bash
    export ANTHROPIC_API_KEY=sk-ant-...
    ironbridge run claude
    ```

=== "ChatGPT"

    ```bash
    export OPENAI_API_KEY=sk-...
    ironbridge run chatgpt
    ```

### Run an AI agent

```bash
ironbridge agency run --agent coder "Write a rate limiter in Rust"
```

### Start the API server

```bash
ironbridge api serve --port 8787
curl http://localhost:8787/api/stats
```

### Git-version your sessions

```bash
ironbridge git init /path/to/project
ironbridge git commit /path/to/project -m "Initial session capture"
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
