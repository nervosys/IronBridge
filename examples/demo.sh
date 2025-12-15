#!/bin/bash
# Demo script for Chat System Manager (csm)
# Demonstrates the Rust CLI with the demo_project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Find csm binary
CSM=""
for candidate in \
    "$PROJECT_ROOT/csm-rust/target/release/csm" \
    "$PROJECT_ROOT/csm-rust/target/debug/csm" \
    "$(which csm 2>/dev/null || true)" \
    "$HOME/.cargo/bin/csm"
do
    if [ -x "$candidate" ]; then
        CSM="$candidate"
        break
    fi
done

if [ -z "$CSM" ]; then
    echo "[ERROR] csm binary not found. Build it first:"
    echo "  cd csm-rust && cargo build --release"
    exit 1
fi

echo "Using csm binary: $CSM"
echo ""

# Demo 1: Show version
echo "=== Demo 1: Version ==="
$CSM --version
echo ""

# Demo 2: List all workspaces
echo "=== Demo 2: List All Workspaces ==="
echo "Running: csm list workspaces"
$CSM list workspaces
echo ""

# Demo 3: Find demo_project workspace
echo "=== Demo 3: Find Demo Project ==="
echo "Running: csm find workspace demo_project"
$CSM find workspace demo_project || echo "(no matches - demo_project may not be registered)"
echo ""

# Demo 4: List sessions
echo "=== Demo 4: List Sessions ==="
DEMO_PATH="$PROJECT_ROOT/demo_project"
echo "Running: csm list sessions --project-path $DEMO_PATH"
$CSM list sessions --project-path "$DEMO_PATH" || echo "(no sessions found)"
echo ""

# Demo 5: Show history
echo "=== Demo 5: Show History ==="
echo "Running: csm show path $DEMO_PATH"
$CSM show path "$DEMO_PATH" || echo "(no history)"
echo ""

# Demo 6: Export sessions
echo "=== Demo 6: Export Sessions ==="
EXPORT_PATH="/tmp/csm_demo_export_$(date +%Y%m%d_%H%M%S)"
echo "Running: csm export path $EXPORT_PATH $DEMO_PATH"
$CSM export path "$EXPORT_PATH" "$DEMO_PATH" || echo "(export skipped)"
if [ -d "$EXPORT_PATH" ]; then
    echo "Exported files:"
    ls -la "$EXPORT_PATH"
fi
echo ""

# Demo 7: Show help
echo "=== Demo 7: Available Commands ==="
echo "Running: csm --help"
$CSM --help
echo ""

# Interactive TUI
echo "=== Interactive TUI ==="
echo "To launch the interactive TUI, run:"
echo "  csm run tui"
echo ""
echo "TUI Features:"
echo "  - Browse workspaces with color-coded tables"
echo "  - View sessions and message previews"
echo "  - Filter workspaces with '/'"
echo "  - Navigate with j/k or arrow keys"
echo "  - Press '?' for help"
echo ""

read -p "Launch TUI now? (y/N) " response
if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    $CSM run tui
fi

echo "Demo complete!"
