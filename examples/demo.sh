#!/bin/bash
# Demo script for Chat System Manager (ironbridge)
# Demonstrates the Rust CLI with the demo_project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Find ironbridge binary
IRONBRIDGE=""
for candidate in \
    "$PROJECT_ROOT/ironbridge-rust/target/release/ironbridge" \
    "$PROJECT_ROOT/ironbridge-rust/target/debug/ironbridge" \
    "$(which ironbridge 2>/dev/null || true)" \
    "$HOME/.cargo/bin/ironbridge"
do
    if [ -x "$candidate" ]; then
        IRONBRIDGE="$candidate"
        break
    fi
done

if [ -z "$IRONBRIDGE" ]; then
    echo "[ERROR] ironbridge binary not found. Build it first:"
    echo "  cd ironbridge-rust && cargo build --release"
    exit 1
fi

echo "Using ironbridge binary: $IRONBRIDGE"
echo ""

# Demo 1: Show version
echo "=== Demo 1: Version ==="
$IRONBRIDGE --version
echo ""

# Demo 2: List all workspaces
echo "=== Demo 2: List All Workspaces ==="
echo "Running: ironbridge list workspaces"
$IRONBRIDGE list workspaces
echo ""

# Demo 3: Find demo_project workspace
echo "=== Demo 3: Find Demo Project ==="
echo "Running: ironbridge find workspace demo_project"
$IRONBRIDGE find workspace demo_project || echo "(no matches - demo_project may not be registered)"
echo ""

# Demo 4: List sessions
echo "=== Demo 4: List Sessions ==="
DEMO_PATH="$PROJECT_ROOT/demo_project"
echo "Running: ironbridge list sessions --project-path $DEMO_PATH"
$IRONBRIDGE list sessions --project-path "$DEMO_PATH" || echo "(no sessions found)"
echo ""

# Demo 5: Show history
echo "=== Demo 5: Show History ==="
echo "Running: ironbridge show path $DEMO_PATH"
$IRONBRIDGE show path "$DEMO_PATH" || echo "(no history)"
echo ""

# Demo 6: Export sessions
echo "=== Demo 6: Export Sessions ==="
EXPORT_PATH="/tmp/ironbridge_demo_export_$(date +%Y%m%d_%H%M%S)"
echo "Running: ironbridge export path $EXPORT_PATH $DEMO_PATH"
$IRONBRIDGE export path "$EXPORT_PATH" "$DEMO_PATH" || echo "(export skipped)"
if [ -d "$EXPORT_PATH" ]; then
    echo "Exported files:"
    ls -la "$EXPORT_PATH"
fi
echo ""

# Demo 7: Show help
echo "=== Demo 7: Available Commands ==="
echo "Running: ironbridge --help"
$IRONBRIDGE --help
echo ""

# Interactive TUI
echo "=== Interactive TUI ==="
echo "To launch the interactive TUI, run:"
echo "  ironbridge run tui"
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
    $IRONBRIDGE run tui
fi

echo "Demo complete!"
