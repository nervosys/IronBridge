#!/usr/bin/env pwsh
# CSM Basic Usage Examples - PowerShell
# Demonstrates core CSM CLI functionality

param(
    [string]$CsmPath = "csm"  # Path to CSM binary (defaults to PATH)
)

Write-Host "=== CSM Basic Usage Examples ===" -ForegroundColor Cyan
Write-Host ""

# Example 1: Check version
Write-Host "1. Checking CSM version..." -ForegroundColor Yellow
& $CsmPath --version
Write-Host ""

# Example 2: List all workspaces
Write-Host "2. Listing all VS Code workspaces..." -ForegroundColor Yellow
$workspaceOutput = & $CsmPath list workspaces
$workspaceLines = $workspaceOutput | Where-Object { $_ -match '^\|' -and $_ -notmatch 'Hash' }
Write-Host "   Found approximately $($workspaceLines.Count) workspaces"
Write-Host ""

# Example 3: List workspaces (formatted table - first 10)
Write-Host "3. Displaying workspaces (first 10)..." -ForegroundColor Yellow
& $CsmPath list workspaces | Select-Object -First 12
Write-Host "   ... (truncated)"
Write-Host ""

# Example 4: Find workspaces matching a pattern
Write-Host "4. Finding workspaces matching 'copilot'..." -ForegroundColor Yellow
& $CsmPath find workspace copilot
Write-Host ""

# Example 5: List all sessions (filtered by project)
Write-Host "5. Listing all chat sessions..." -ForegroundColor Yellow
# List all sessions, optionally filter by project path
& $CsmPath list sessions | Select-Object -First 15
Write-Host "   ... (truncated)"
Write-Host ""

# Example 6: Show history for a project
Write-Host "6. Showing history for current project..." -ForegroundColor Yellow
$currentPath = Get-Location
& $CsmPath show path $currentPath.Path
Write-Host ""

# Example 7: Check git status for a workspace
Write-Host "7. Checking git status for a project..." -ForegroundColor Yellow
& $CsmPath git status $currentPath.Path
Write-Host ""

# Example 8: Export sessions to a directory
Write-Host "8. Exporting sessions example..." -ForegroundColor Yellow
$exportDir = Join-Path $env:TEMP "csm_export_demo"
if (-not (Test-Path $exportDir)) {
    New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
}
# Get a workspace with sessions
$wsLine = & $CsmPath find workspace copilot | Where-Object { $_ -match '^\| [0-9a-f]' } | Select-Object -First 1
if ($wsLine -match '^\| ([0-9a-f]+)\.\.\.') {
    $hash = $Matches[1]
    Write-Host "   Exporting workspace $hash to $exportDir"
    & $CsmPath export workspace $exportDir $hash
}
Write-Host ""

Write-Host "=== Examples Complete ===" -ForegroundColor Green
