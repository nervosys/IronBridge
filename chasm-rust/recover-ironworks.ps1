#!/usr/bin/env pwsh
# recover-ironworks.ps1
# Recovers IronWorks chat sessions into VS Code's Copilot Chat history.
#
# WHY THIS SCRIPT EXISTS:
# VS Code caches the session index (chat.ChatSessionStore.index) in memory.
# Writing to state.vscdb while VS Code is running is futile — VS Code
# overwrites our changes when it saves/exits. This script:
#   1. Closes all VS Code windows gracefully
#   2. Waits for full process exit
#   3. Runs `chasm register all` to inject sessions into the index
#   4. Reopens VS Code

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,
    [string]$ChasmExe = "$PSScriptRoot\target\release\chasm.exe",
    [switch]$SkipReopen
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  CHASM Session Recovery — IronWorks" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Verify chasm binary exists
if (-not (Test-Path $ChasmExe)) {
    Write-Host "[ERROR] chasm.exe not found at: $ChasmExe" -ForegroundColor Red
    Write-Host "  Build it first: cd chasm-rust && cargo build --release" -ForegroundColor Yellow
    exit 1
}

# Step 1: Close VS Code gracefully
Write-Host "[1/4] Closing VS Code..." -ForegroundColor Yellow
$codeProcesses = Get-Process -Name "Code" -ErrorAction SilentlyContinue
if ($codeProcesses) {
    # Send close signal (graceful shutdown)
    $codeProcesses | ForEach-Object { $_.CloseMainWindow() | Out-Null }
    Write-Host "  Waiting for VS Code to save state and exit..."

    # Wait up to 30 seconds for graceful exit
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt 30) {
        $remaining = Get-Process -Name "Code" -ErrorAction SilentlyContinue
        if (-not $remaining) { break }
        Start-Sleep -Milliseconds 500
    }

    # Force kill if still running
    $remaining = Get-Process -Name "Code" -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "  Force-killing remaining VS Code processes..." -ForegroundColor Red
        $remaining | Stop-Process -Force
        Start-Sleep -Seconds 2
    }

    Write-Host "  [OK] VS Code closed." -ForegroundColor Green
}
else {
    Write-Host "  VS Code not running." -ForegroundColor Gray
}

# Step 2: Wait a moment for file locks to release
Write-Host "[2/4] Waiting for file locks to release..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Write-Host "  [OK] Ready." -ForegroundColor Green

# Step 3: Register sessions
Write-Host "[3/4] Registering IronWorks sessions..." -ForegroundColor Yellow
Write-Host ""

& $ChasmExe register all --path $ProjectPath --force 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Registration failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  [OK] Sessions registered." -ForegroundColor Green

# Step 4: Reopen VS Code
if (-not $SkipReopen) {
    Write-Host "[4/4] Reopening VS Code..." -ForegroundColor Yellow
    Start-Process "code" -ArgumentList $ProjectPath
    Write-Host "  [OK] VS Code launched." -ForegroundColor Green
}
else {
    Write-Host "[4/4] Skipping VS Code reopen (--SkipReopen)." -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DONE! Check Copilot Chat history in VS Code." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  If sessions still don't appear, try:" -ForegroundColor Yellow
Write-Host "    1. Open Copilot Chat panel (Ctrl+Alt+I)" -ForegroundColor Yellow
Write-Host '    2. Click the history icon (clock) or "Show Chats..."' -ForegroundColor Yellow
Write-Host ""
