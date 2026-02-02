# GitHub Content Moderator Action

## Overview

This GitHub Action moderates the content of issues, pull requests, and comments using the OpenAI Content Moderation API. It also supports OpenAI-compatible custom endpoints.

### Features

- **Automatic Text Extraction**: Automatically includes titles for Issues, PRs, and Discussions
- **Text Normalization**: Normalizes text for consistent detection (Unicode NFKC, whitespace handling)
- **Smart Content Hiding**:
  - Comments: Minimized (collapsed with reason)
  - Issues: Closed + Locked
  - Pull Requests: Closed + Locked
  - Discussions: Locked
- **Custom Endpoint Support**: Works with GitHub Copilot API, OpenAI, Azure OpenAI, Ollama, and any OpenAI-compatible endpoint

## Usage

Here is an example of how to use this action in your workflow:

```yaml
name: Moderate Content

on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, edited]
  issue_comment:
    types: [created, edited]
  pull_request_review_comment:
    types: [created, edited]
  discussion:
    types: [created, edited]
  discussion_comment:
    types: [created, edited]

jobs:
  moderate:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
      discussions: write
    steps:
      - name: Moderate content
        id: moderator
        uses: Walkmana-25/github-comment-moderation@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          openai-endpoint: ${{ secrets.OPENAI_ENDPOINT }}
          openai-model: ${{ secrets.OPENAI_MODEL }}
          # text-to-moderate is optional - auto-populated from event

      - name: Post-moderation summary
        if: steps.moderator.outputs.is-inappropriate == 'true'
        run: |
          echo "Content was flagged for the following reasons: ${{ steps.moderator.outputs.flagged-categories }}"
```

## Configuration Options

This action supports the following inputs:

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | Yes | `${{ github.token }}` | The GitHub token for API authentication |
| `openai-api-key` | No | `${{ github.token }}` | The API key for the OpenAI-compatible endpoint. If not provided, the `github-token` will be used (for GitHub Copilot API) |
| `openai-endpoint` | No | `https://models.github.ai/inference` | The base URL of the OpenAI-compatible API endpoint |
| `openai-model` | No | `openai/gpt-4.1-mini` | The model to use for content moderation |
| `text-to-moderate` | No | *(auto-populated)* | The text content to moderate. If not provided, will be auto-populated from the event: |
| | | | - **Issues/PRs/Discussions**: `title + "\\n\\n" + body` |
| | | | - **Comments**: `body` only |
| `retry-count` | No | `3` | Number of retry attempts for API calls |

### Content Moderated by Event Type

| Event Type | Content Moderated | Action When Flagged |
|------------|------------------|---------------------|
| `issues` | Title + Body | Closed + Locked |
| `pull_request`, `pull_request_target` | Title + Body | Closed + Locked |
| `issue_comment` | Comment body | Minimized |
| `pull_request_review_comment` | Comment body | Minimized |
| `discussion` | Title + Body | Locked |
| `discussion_comment` | Comment body | Minimized |

### Custom Endpoint Usage

This action supports **OpenAI-compatible endpoints**, allowing you to use various AI providers:

#### GitHub Copilot API (Default)
```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  # openai-api-key defaults to github-token
  # openai-endpoint defaults to https://models.github.ai/inference
  openai-model: 'openai/gpt-4.1-mini'
```

#### OpenAI API
```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  openai-api-key: ${{ secrets.OPENAI_API_KEY }}
  openai-endpoint: 'https://api.openai.com/v1'
  openai-model: 'gpt-4o-mini'
```

#### Azure OpenAI Service
```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  openai-api-key: ${{ secrets.AZURE_OPENAI_API_KEY }}
  openai-endpoint: 'https://your-resource.openai.azure.com/'
  openai-model: 'gpt-4'  # Use the deployment name, not the model name
```

#### Ollama (Local LLM)
```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  openai-api-key: 'ollama'  # Ollama may not require an API key
  openai-endpoint: 'https://your-ollama-instance.com/v1'
  openai-model: 'llama3.2'
```

#### Any OpenAI-Compatible API
```yaml
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  openai-api-key: ${{ secrets.CUSTOM_API_KEY }}
  openai-endpoint: 'https://your-custom-endpoint.com/v1'
  openai-model: 'custom-model-name'
```

### Outputs

| Output | Description |
|--------|-------------|
| `is-inappropriate` | Whether the content was flagged as inappropriate (`true` or `false`) |
| `flagged-categories` | Comma-separated list of flagged categories (e.g., `hate,violence`) |
| `moderation-results-json` | Full JSON response from the API |

## Text Normalization

The action automatically normalizes text before moderation to ensure consistent detection:

- **Unicode NFKC normalization**: Handles compatibility characters (important for Japanese text)
- **Whitespace normalization**: Collapses multiple spaces/tabs into single spaces
- **Trailing newline removal**: Ensures "text\n" is detected the same as "text"

This means variations like `"ばーかばーか\n"` will be detected consistently as inappropriate.

## Permissions

The action requires the following permissions:

```yaml
permissions:
  issues: write      # For closing/locking issues
  pull-requests: write  # For closing/locking PRs
  discussions: write   # For locking discussions
```

## Content Policy

The action uses the following content policy for moderation:

- Hate speech or discriminatory language
- Sexual content or explicit material
- Violence, threats, or promoting harm
- Self-harm or suicide-related content
- Harassment or bullying
