#!/usr/bin/env pwsh
# Demo script for Chat Session Manager (csm)
# Demonstrates the Rust CLI with the demo_project

$ErrorActionPreference = "Continue"

# Find csm binary
$csm = $null
$projectRoot = Split-Path $PSScriptRoot -Parent
$candidates = @(
    (Join-Path $projectRoot "csm-rust\target\release\csm.exe"),
    (Join-Path $projectRoot "csm-rust\target\debug\csm.exe"),
    (Get-Command "csm" -ErrorAction SilentlyContinue)?.Source,
    (Get-Command "csm.exe" -ErrorAction SilentlyContinue)?.Source
)

foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
        $csm = $candidate
        break
    }
}

if (-not $csm) {
    Write-Host "[ERROR] csm binary not found. Build it first:" -ForegroundColor Red
    Write-Host "  cd csm-rust && cargo build --release" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using csm binary: $csm" -ForegroundColor Cyan
Write-Host ""

# Demo 1: Show version
Write-Host "=== Demo 1: Version ===" -ForegroundColor Green
& $csm --version
Write-Host ""

# Demo 2: List all workspaces
Write-Host "=== Demo 2: List All Workspaces ===" -ForegroundColor Green
Write-Host "Running: csm list workspaces" -ForegroundColor Yellow
& $csm list workspaces
Write-Host ""

# Demo 3: Find demo_project workspace
Write-Host "=== Demo 3: Find Demo Project ===" -ForegroundColor Green
Write-Host "Running: csm find workspace demo_project" -ForegroundColor Yellow
& $csm find workspace demo_project
Write-Host ""

# Demo 4: List sessions in demo_project
Write-Host "=== Demo 4: List Sessions ===" -ForegroundColor Green
$demoPath = Join-Path $projectRoot "demo_project"
Write-Host "Running: csm list sessions --project-path $demoPath" -ForegroundColor Yellow
& $csm list sessions --project-path $demoPath
Write-Host ""

# Demo 5: Show history for demo_project
Write-Host "=== Demo 5: Show History ===" -ForegroundColor Green
Write-Host "Running: csm show path $demoPath" -ForegroundColor Yellow
& $csm show path $demoPath
Write-Host ""

# Demo 6: Export sessions to temp directory
Write-Host "=== Demo 6: Export Sessions ===" -ForegroundColor Green
$exportPath = Join-Path $env:TEMP "csm_demo_export_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "Running: csm export path $exportPath $demoPath" -ForegroundColor Yellow
& $csm export path $exportPath $demoPath
if (Test-Path $exportPath) {
    Write-Host "Exported files:" -ForegroundColor Cyan
    Get-ChildItem $exportPath | ForEach-Object { Write-Host "  - $($_.Name)" }
}
Write-Host ""

# Demo 7: Show help
Write-Host "=== Demo 7: Available Commands ===" -ForegroundColor Green
Write-Host "Running: csm --help" -ForegroundColor Yellow
& $csm --help
Write-Host ""

# Interactive TUI demo (optional)
Write-Host "=== Interactive TUI ===" -ForegroundColor Green
Write-Host "To launch the interactive TUI, run:" -ForegroundColor Cyan
Write-Host "  csm run tui" -ForegroundColor Yellow
Write-Host ""
Write-Host "TUI Features:" -ForegroundColor Cyan
Write-Host "  - Browse workspaces with color-coded tables"
Write-Host "  - View sessions and message previews"
Write-Host "  - Filter workspaces with '/'"
Write-Host "  - Navigate with j/k or arrow keys"
Write-Host "  - Press '?' for help"
Write-Host ""

$response = Read-Host "Launch TUI now? (y/N)"
if ($response -eq 'y' -or $response -eq 'Y') {
    & $csm run tui
}

Write-Host "Demo complete!" -ForegroundColor Green
