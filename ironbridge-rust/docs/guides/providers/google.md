# Google Gemini API Setup

Connect to Google's Gemini API for Gemini 2.0 Flash, Pro, and other models.

## Prerequisites

- [Google AI API key](https://aistudio.google.com/apikey)

## Configuration

```bash
export GOOGLE_API_KEY=AIza...
```

## Usage with IronBridge

```bash
# Interactive chat with Gemini Flash
ironbridge run gemini --model gemini-2.0-flash

# Gemini Pro for complex tasks
ironbridge run gemini --model gemini-1.5-pro
```

## Available Models

| Model | Context | Best For |
|---|---|---|
| `gemini-2.0-flash` | 1M | Fast, multimodal |
| `gemini-1.5-pro` | 2M | Longest context, complex reasoning |
| `gemini-1.5-flash` | 1M | Balanced speed and quality |

## Browser Extension

IronBridge's browser extension captures sessions from [gemini.google.com](https://gemini.google.com):

1. Install the IronBridge browser extension
2. Navigate to gemini.google.com
3. Click the IronBridge icon to export conversations

## Tips

- Gemini supports the longest context windows in the industry (up to 2M tokens)
- For the Gemini CLI terminal tool, see the [Gemini CLI guide](gemini-cli.md)
- Google AI Studio sessions can be exported via the browser extension
