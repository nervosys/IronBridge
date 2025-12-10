# Quick examples for Chat Session Manager (csm)
# Run individual examples by copying commands to your terminal

$projectRoot = Split-Path $PSScriptRoot -Parent
$csm = Join-Path $projectRoot "csm-rust\target\release\csm.exe"
if (-not (Test-Path $csm)) {
    $csm = "csm"  # Try PATH
}

Write-Host "Chat Session Manager (csm) Examples" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# List all examples
Write-Host "Available Commands:" -ForegroundColor Green
Write-Host ""

Write-Host "  Browsing:" -ForegroundColor Yellow
Write-Host "    csm list workspaces        # List all workspaces"
Write-Host "    csm list sessions          # List all chat sessions"
Write-Host "    csm find workspace <pat>   # Search workspaces by path"
Write-Host "    csm find session <pat>     # Search sessions by content"
Write-Host "    csm run tui                # Launch interactive browser"
Write-Host ""

Write-Host "  History:" -ForegroundColor Yellow
Write-Host "    csm show path              # Show sessions for current directory"
Write-Host "    csm fetch path             # Fetch sessions from other workspaces"
Write-Host "    csm merge path             # Merge all sessions into one"
Write-Host ""

Write-Host "  Export/Import:" -ForegroundColor Yellow
Write-Host "    csm export path <dest> [project]   # Export sessions by path"
Write-Host "    csm export workspace <dest> <hash> # Export sessions by hash"
Write-Host "    csm import path <src> [project]    # Import sessions by path"
Write-Host "    csm import workspace <src> <hash>  # Import sessions by hash"
Write-Host "    csm move <hash> <project>          # Move sessions between workspaces"
Write-Host ""

Write-Host "  Git Integration:" -ForegroundColor Yellow
Write-Host "    csm git config --name <n> --email <e>    # Configure git user"
Write-Host "    csm git init <path>        # Initialize git for chat sessions"
Write-Host "    csm git add <path>         # Stage chat sessions"
Write-Host "    csm git status <path>      # Show git status"
Write-Host "    csm git snapshot <path>    # Create tagged snapshot"
Write-Host ""

Write-Host "  Migration:" -ForegroundColor Yellow
Write-Host "    csm create-migration <output>      # Create migration package"
Write-Host "    csm restore-migration <package>    # Restore on new machine"
Write-Host ""

# Run quick demo
Write-Host "Quick Demo:" -ForegroundColor Green
Write-Host "Running: csm list workspaces | Select-Object -First 20" -ForegroundColor DarkGray
