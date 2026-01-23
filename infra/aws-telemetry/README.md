# Chasm Telemetry Server (AWS)

Serverless telemetry logging infrastructure for Chasm usage analytics.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌────────────┐     ┌─────────────┐
│  Chasm CLI  │────▶│  API Gateway    │────▶│   Lambda   │────▶│  S3 Bucket  │
│  (client)   │     │  (HTTPS REST)   │     │  (ingest)  │     │  (storage)  │
└─────────────┘     └─────────────────┘     └────────────┘     └─────────────┘
                                                  │
                                                  ▼
                                           ┌─────────────┐
                                           │  DynamoDB   │
                                           │  (optional) │
                                           └─────────────┘
```

## Features

- **Serverless** - Pay only for what you use
- **Scalable** - Handles burst traffic automatically
- **Secure** - API key authentication, HTTPS only
- **Cost-effective** - S3 for long-term storage (~$0.023/GB/month)
- **AI-ready** - JSONL format for easy analysis with LLMs

## Prerequisites

- AWS CLI configured (`aws configure`)
- Terraform >= 1.0
- Python 3.11+ (for Lambda)

## Quick Deploy

### Windows (PowerShell)

```powershell
cd infra\aws-telemetry
.\deploy.ps1
```

### Linux/macOS

```bash
cd infra/aws-telemetry
./deploy.sh
```

### Manual Terraform

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

## Configuration

After deployment, retrieve your credentials:

```bash
cd terraform
terraform output api_endpoint   # Your API URL
terraform output api_key        # Your secret key (sensitive)
```

Configure the Chasm CLI:

```bash
# Set endpoint, API key, and enable remote sync
chasm telemetry config --endpoint https://xxx.execute-api.us-east-1.amazonaws.com --api-key YOUR_KEY --enable-remote

# Test the connection
chasm telemetry test

# Sync local records to AWS
chasm telemetry sync
```

## CLI Commands

| Command                                       | Description                                      |
| --------------------------------------------- | ------------------------------------------------ |
| `chasm telemetry info`                        | Show telemetry status and what data is collected |
| `chasm telemetry opt-in`                      | Enable data collection (default)                 |
| `chasm telemetry opt-out`                     | Disable data collection                          |
| `chasm telemetry record -e EVENT -c CATEGORY` | Record a telemetry event                         |
| `chasm telemetry show`                        | View local telemetry records                     |
| `chasm telemetry export FILE`                 | Export records to file                           |
| `chasm telemetry config`                      | Configure remote endpoint                        |
| `chasm telemetry sync`                        | Upload records to AWS                            |
| `chasm telemetry test`                        | Test connection to server                        |

## API Endpoints

### POST /ingest
Receive telemetry records.

```json
{
  "installation_id": "uuid",
  "records": [
    {
      "id": "uuid",
      "category": "usage",
      "event": "command_invoked",
      "data": {},
      "tags": ["cli"],
      "timestamp": 1234567890
    }
  ]
}
```

### GET /health
Health check endpoint.

## Cost Estimate (Monthly)

| Usage Level      | API Requests | Storage | Lambda | Total  |
| ---------------- | ------------ | ------- | ------ | ------ |
| Low (1K/day)     | ~$0.03       | ~$0.01  | ~$0.01 | ~$0.05 |
| Medium (10K/day) | ~$0.30       | ~$0.10  | ~$0.10 | ~$0.50 |
| High (100K/day)  | ~$3.00       | ~$1.00  | ~$1.00 | ~$5.00 |

## Security

- API keys stored in AWS Secrets Manager
- All data encrypted at rest (S3 SSE)
- HTTPS only (TLS 1.2+)
- CloudWatch logging with retention policy

## Data Retention

Default: 90 days. Configure via Terraform variable:

```hcl
retention_days = 90
```

## Querying Data

### Export for AI Analysis

```bash
# Download all telemetry data from S3
aws s3 sync s3://chasm-telemetry-prod/data/ ./telemetry-export/

# Or use the CLI to export local records
chasm telemetry export ./analysis.jsonl --format jsonl
```

## Cleanup

To destroy all AWS resources:

```bash
cd terraform
terraform destroy
```
