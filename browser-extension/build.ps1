#!/usr/bin/env pwsh
# build.ps1 — Build and package Chasm browser extension for store submission
# Copyright 2025-2026 Nervosys LLC — AGPL-3.0-only

param(
    [ValidateSet("chrome", "firefox", "all")]
    [string]$Target = "all",
    [switch]$GenerateIcons,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$ExtDir = $PSScriptRoot
$DistDir = Join-Path $ExtDir "dist"

Write-Host "Chasm Browser Extension — Build Script" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# --- Clean ---
if ($Clean) {
    Write-Host "`n[Clean] Removing dist/ ..." -ForegroundColor Yellow
    if (Test-Path $DistDir) { Remove-Item -Recurse -Force $DistDir }
    Write-Host "[Clean] Done." -ForegroundColor Green
    if (-not $GenerateIcons -and $Target -eq "all" -and -not $PSBoundParameters.ContainsKey('Target')) {
        return
    }
}

# --- Generate PNG icons from SVG ---
if ($GenerateIcons) {
    Write-Host "`n[Icons] Generating PNG icons from SVG ..." -ForegroundColor Yellow
    $svgPath = Join-Path $ExtDir "icons" "icon.svg"
    if (-not (Test-Path $svgPath)) {
        Write-Error "SVG icon not found at $svgPath"
    }

    $magick = Get-Command "magick" -ErrorAction SilentlyContinue
    if (-not $magick) {
        Write-Host "[Icons] ImageMagick not found. Trying Inkscape ..." -ForegroundColor Yellow
        $inkscape = Get-Command "inkscape" -ErrorAction SilentlyContinue
        if (-not $inkscape) {
            Write-Error "Neither ImageMagick nor Inkscape found. Install one to generate PNG icons.`n  choco install imagemagick  OR  choco install inkscape"
        }
        foreach ($size in @(16, 32, 48, 128)) {
            $out = Join-Path $ExtDir "icons" "icon${size}.png"
            & inkscape $svgPath --export-type=png --export-filename=$out --export-width=$size --export-height=$size 2>$null
            Write-Host "  Created icon${size}.png" -ForegroundColor Green
        }
    } else {
        foreach ($size in @(16, 32, 48, 128)) {
            $out = Join-Path $ExtDir "icons" "icon${size}.png"
            & magick convert -background none $svgPath -resize "${size}x${size}" $out
            Write-Host "  Created icon${size}.png" -ForegroundColor Green
        }
    }
    Write-Host "[Icons] Done." -ForegroundColor Green
}

# --- Verify icons exist ---
$missingIcons = @()
foreach ($size in @(16, 32, 48, 128)) {
    $iconPath = Join-Path $ExtDir "icons" "icon${size}.png"
    if (-not (Test-Path $iconPath)) { $missingIcons += "icon${size}.png" }
}
if ($missingIcons.Count -gt 0) {
    Write-Warning "Missing PNG icons: $($missingIcons -join ', '). Run with -GenerateIcons to create them."
}

# --- Shared files to include ---
$includeFiles = @(
    "background/service-worker.js",
    "content/chatgpt.js",
    "content/claude.js",
    "content/copilot.js",
    "content/gemini.js",
    "content/perplexity.js",
    "content/poe.js",
    "content/styles.css",
    "icons/icon.svg",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "options/options.html",
    "options/options.css",
    "options/options.js",
    "popup/popup.html",
    "popup/popup.css",
    "popup/popup.js"
)

# --- Build Chrome ---
function Build-Chrome {
    Write-Host "`n[Chrome] Packaging for Chrome Web Store ..." -ForegroundColor Yellow
    $chromeDir = Join-Path $DistDir "chrome"
    if (Test-Path $chromeDir) { Remove-Item -Recurse -Force $chromeDir }
    New-Item -ItemType Directory -Path $chromeDir -Force | Out-Null

    # Copy manifest
    Copy-Item (Join-Path $ExtDir "manifest.json") (Join-Path $chromeDir "manifest.json")

    # Copy extension files
    foreach ($file in $includeFiles) {
        $src = Join-Path $ExtDir $file
        $dst = Join-Path $chromeDir $file
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
        if (Test-Path $src) {
            Copy-Item $src $dst
        } else {
            Write-Warning "Missing file: $file"
        }
    }

    # Create ZIP
    $zipPath = Join-Path $DistDir "chasm-chrome.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath }
    Compress-Archive -Path "$chromeDir\*" -DestinationPath $zipPath -Force
    $zipSize = (Get-Item $zipPath).Length
    Write-Host "[Chrome] Created: dist/chasm-chrome.zip ($([math]::Round($zipSize / 1KB, 1)) KB)" -ForegroundColor Green
}

# --- Build Firefox ---
function Build-Firefox {
    Write-Host "`n[Firefox] Packaging for Firefox Add-on Store ..." -ForegroundColor Yellow
    $firefoxDir = Join-Path $DistDir "firefox"
    if (Test-Path $firefoxDir) { Remove-Item -Recurse -Force $firefoxDir }
    New-Item -ItemType Directory -Path $firefoxDir -Force | Out-Null

    # Copy Firefox manifest (rename to manifest.json)
    Copy-Item (Join-Path $ExtDir "manifest.firefox.json") (Join-Path $firefoxDir "manifest.json")

    # Copy extension files
    foreach ($file in $includeFiles) {
        $src = Join-Path $ExtDir $file
        $dst = Join-Path $firefoxDir $file
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
        if (Test-Path $src) {
            Copy-Item $src $dst
        } else {
            Write-Warning "Missing file: $file"
        }
    }

    # Create ZIP (Firefox uses .zip or .xpi)
    $zipPath = Join-Path $DistDir "chasm-firefox.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath }
    Compress-Archive -Path "$firefoxDir\*" -DestinationPath $zipPath -Force
    $zipSize = (Get-Item $zipPath).Length
    Write-Host "[Firefox] Created: dist/chasm-firefox.zip ($([math]::Round($zipSize / 1KB, 1)) KB)" -ForegroundColor Green
}

# --- Execute ---
New-Item -ItemType Directory -Path $DistDir -Force | Out-Null

switch ($Target) {
    "chrome"  { Build-Chrome }
    "firefox" { Build-Firefox }
    "all"     { Build-Chrome; Build-Firefox }
}

Write-Host "`n[Done] Build complete!" -ForegroundColor Cyan
Write-Host "  Upload dist/chasm-chrome.zip to Chrome Web Store Developer Dashboard"
Write-Host "  Upload dist/chasm-firefox.zip to Firefox Add-on Developer Hub"
