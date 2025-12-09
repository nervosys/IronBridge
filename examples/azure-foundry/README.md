# Azure AI Foundry Demo

Demo chat sessions for Azure AI Foundry (local and cloud).

## Endpoints

- Local development: `http://localhost:5272`
- Cloud: `https://<your-endpoint>.openai.azure.com/`

## Setup

### Local Development

```bash
# Install Azure AI Foundry CLI
pip install azure-ai-foundry

# Start local server
ai-foundry serve --model phi-3-mini --port 5272
```

### Cloud Deployment

1. Create an Azure AI resource in the Azure Portal
2. Deploy a model through Azure AI Studio
3. Get your endpoint and API key

## API Format

```bash
# Local
curl http://localhost:5272/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "phi-3-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Cloud
curl https://<endpoint>.openai.azure.com/openai/deployments/<model>/chat/completions?api-version=2024-02-01 \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Usage with CSM

```bash
# Configure Azure AI Foundry provider (local)
csm provider config foundry --endpoint http://localhost:5272

# Configure with API key (cloud)
csm provider config foundry \
  --endpoint https://your-endpoint.openai.azure.com \
  --api-key YOUR_API_KEY

# Test connection
csm provider test foundry

# Import demo sessions
csm provider import foundry --source examples/azure-foundry/sessions
```
