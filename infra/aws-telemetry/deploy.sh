#!/bin/bash
# Deploy Chasm Telemetry Server to AWS
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-prod}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Deploying Chasm Telemetry Server"
echo "Environment: $ENVIRONMENT"
echo "=========================================="

# Check prerequisites
command -v terraform >/dev/null 2>&1 || { echo "Error: terraform is required but not installed."; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "Error: aws-cli is required but not installed."; exit 1; }

# Check AWS credentials
aws sts get-caller-identity >/dev/null 2>&1 || { echo "Error: AWS credentials not configured. Run 'aws configure'."; exit 1; }

echo ""
echo "[1/4] Initializing Terraform..."
cd "$SCRIPT_DIR/terraform"
terraform init

echo ""
echo "[2/4] Planning deployment..."
terraform plan -var="environment=$ENVIRONMENT" -out=tfplan

echo ""
read -p "Apply this plan? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "[3/4] Applying Terraform configuration..."
terraform apply tfplan

echo ""
echo "[4/4] Retrieving outputs..."
API_ENDPOINT=$(terraform output -raw api_endpoint)
API_KEY=$(terraform output -raw api_key)

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "API Endpoint: $API_ENDPOINT"
echo "API Key: (hidden - run 'terraform output -raw api_key' to see)"
echo ""
echo "Configure your chasm CLI:"
echo ""
echo "  chasm telemetry config --endpoint $API_ENDPOINT --api-key \$(terraform output -raw api_key) --enable-remote"
echo ""
echo "Test the connection:"
echo ""
echo "  chasm telemetry test"
echo ""
echo "Sync your telemetry data:"
echo ""
echo "  chasm telemetry sync"
echo ""
