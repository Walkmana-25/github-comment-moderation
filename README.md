# GitHub Content Moderator Action

## Overview

This GitHub Action moderates the content of issues, pull requests, and comments using the OpenAI Content Moderation API. It also supports OpenAI-compatible custom endpoints by setting the `openai-api-base-url` input to your custom API base URL. If content is flagged as inappropriate based on a user-defined threshold, it will be hidden.

This repository contains the requirement definitions for a coding agent to implement this GitHub Action.

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
      - name: Prepare moderation text
        id: prepare_text
        run: |
          TEXT_TO_MODERATE=""
          if [[ "${{ github.event_name }}" == "issue_comment" || "${{ github.event_name }}" == "pull_request_review_comment" || "${{ github.event_name }}" == "discussion_comment" ]]; then
            TEXT_TO_MODERATE="${{ github.event.comment.body }}"
          elif [[ "${{ github.event_name }}" == "issues" ]]; then
            TEXT_TO_MODERATE="${{ github.event.issue.title }}\n${{ github.event.issue.body }}"
          elif [[ "${{ github.event_name }}" == "pull_request" || "${{ github.event_name }}" == "pull_request_target" ]]; then
            TEXT_TO_MODERATE="${{ github.event.pull_request.title }}\n${{ github.event.pull_request.body }}"
          elif [[ "${{ github.event_name }}" == "discussion" ]]; then
            TEXT_TO_MODERATE="${{ github.event.discussion.title }}\n${{ github.event.discussion.body }}"
          fi
          echo "text<<EOF" >> $GITHUB_OUTPUT
          echo "$TEXT_TO_MODERATE" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Moderate content
        id: moderator
        uses: Walkmana-25/github-comment-moderation@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          openai-endpoint: ${{ secrets.OPENAI_ENDPOINT }}
          openai-model: ${{ secrets.OPENAI_MODEL }}

          text-to-moderate: ${{ steps.prepare_text.outputs.text }}


      - name: Post-moderation summary
        if: steps.moderator.outputs.is-inappropriate == 'true'
        run: |
          echo "Content was flagged for the following reasons: ${{ steps.moderator.outputs.flagged-categories }}"
          echo "The content has been hidden, and the workflow continues to run successfully."
```

## Configuration Options

This action supports the following inputs:

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | Yes | `${{ github.token }}` | The GitHub token for API authentication |
| `openai-api-key` | No | `${{ github.token }}` | The API key for the OpenAI-compatible endpoint. If not provided, the `github-token` will be used (for GitHub Copilot API) |
| `openai-endpoint` | No | `https://models.github.ai/inference` | The base URL of the OpenAI-compatible API endpoint |
| `openai-model` | No | `openai/gpt-4.1-mini` | The model to use for content moderation |
| `text-to-moderate` | Yes | - | The text content to moderate |
| `retry-count` | No | `3` | Number of retry attempts for API calls |

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
| `flagged-categories` | Comma-separated list of flagged categories |
| `moderation-results-json` | Full JSON response from the API |


