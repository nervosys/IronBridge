# Quick examples for Chat System Manager (ironbridge)
# Run individual examples by copying commands to your terminal

$projectRoot = Split-Path $PSScriptRoot -Parent
$ironbridge = Join-Path $projectRoot "ironbridge-rust\target\release\ironbridge.exe"
if (-not (Test-Path $ironbridge)) {
    $ironbridge = "ironbridge"  # Try PATH
}

Write-Host "Chat System Manager (ironbridge) Examples" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# List all examples
Write-Host "Available Commands:" -ForegroundColor Green
Write-Host ""

Write-Host "  Browsing:" -ForegroundColor Yellow
Write-Host "    ironbridge list workspaces        # List all workspaces"
Write-Host "    ironbridge list sessions          # List all chat sessions"
Write-Host "    ironbridge find workspace <pat>   # Search workspaces by path"
Write-Host "    ironbridge find session <pat>     # Search sessions by content"
Write-Host "    ironbridge run tui                # Launch interactive browser"
Write-Host ""

Write-Host "  History:" -ForegroundColor Yellow
Write-Host "    ironbridge show path              # Show sessions for current directory"
Write-Host "    ironbridge fetch path             # Fetch sessions from other workspaces"
Write-Host "    ironbridge merge path             # Merge all sessions into one"
Write-Host ""

Write-Host "  Export/Import:" -ForegroundColor Yellow
Write-Host "    ironbridge export path <dest> [project]   # Export sessions by path"
Write-Host "    ironbridge export workspace <dest> <hash> # Export sessions by hash"
Write-Host "    ironbridge import path <src> [project]    # Import sessions by path"
Write-Host "    ironbridge import workspace <src> <hash>  # Import sessions by hash"
Write-Host "    ironbridge move <hash> <project>          # Move sessions between workspaces"
Write-Host ""

Write-Host "  Git Integration:" -ForegroundColor Yellow
Write-Host "    ironbridge git config --name <n> --email <e>    # Configure git user"
Write-Host "    ironbridge git init <path>        # Initialize git for chat sessions"
Write-Host "    ironbridge git add <path>         # Stage chat sessions"
Write-Host "    ironbridge git status <path>      # Show git status"
Write-Host "    ironbridge git snapshot <path>    # Create tagged snapshot"
Write-Host ""

Write-Host "  Migration:" -ForegroundColor Yellow
Write-Host "    ironbridge create-migration <output>      # Create migration package"
Write-Host "    ironbridge restore-migration <package>    # Restore on new machine"
Write-Host ""

# Run quick demo
Write-Host "Quick Demo:" -ForegroundColor Green
Write-Host "Running: ironbridge list workspaces | Select-Object -First 20" -ForegroundColor DarkGray
