# PowerShell deployment script for Windows
# Usage: .\deploy.ps1 [-Environment prod]

param(
    [string]$Environment = "prod"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deploying Chasm Telemetry Server" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check prerequisites
if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Write-Host "Error: terraform is required but not installed." -ForegroundColor Red
    Write-Host "Install from: https://www.terraform.io/downloads" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "Error: aws-cli is required but not installed." -ForegroundColor Red
    Write-Host "Install from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Check AWS credentials
try {
    aws sts get-caller-identity | Out-Null
}
catch {
    Write-Host "Error: AWS credentials not configured. Run 'aws configure'." -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "[1/4] Initializing Terraform..." -ForegroundColor Yellow
Set-Location "$ScriptDir\terraform"
terraform init

Write-Host ""
Write-Host "[2/4] Planning deployment..." -ForegroundColor Yellow
terraform plan -var="environment=$Environment" -out=tfplan

Write-Host ""
$response = Read-Host "Apply this plan? (y/N)"
if ($response -ne "y" -and $response -ne "Y") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "[3/4] Applying Terraform configuration..." -ForegroundColor Yellow
terraform apply tfplan

Write-Host ""
Write-Host "[4/4] Retrieving outputs..." -ForegroundColor Yellow
$ApiEndpoint = terraform output -raw api_endpoint
$ApiKey = terraform output -raw api_key

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "API Endpoint: $ApiEndpoint" -ForegroundColor Cyan
Write-Host "API Key: (hidden - run 'terraform output -raw api_key' to see)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Configure your chasm CLI:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  chasm telemetry config --endpoint $ApiEndpoint --api-key `$(terraform output -raw api_key) --enable-remote" -ForegroundColor White
Write-Host ""
Write-Host "Test the connection:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  chasm telemetry test" -ForegroundColor White
Write-Host ""
Write-Host "Sync your telemetry data:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  chasm telemetry sync" -ForegroundColor White
Write-Host ""
