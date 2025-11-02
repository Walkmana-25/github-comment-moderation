# GitHub Content Moderator Action

## Overview

This GitHub Action moderates the content of issues, pull requests, discussions, and comments using a general-purpose language model via the OpenAI Completions API. It uses a configurable prompt to instruct the model to judge the content and return a structured JSON response. If the model flags the content as inappropriate, the action will hide it.

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
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Moderate content
        uses: {your-username}/{this-repo-name}@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          text-to-moderate: ${{ github.event.issue.body || github.event.pull_request.body || github.event.comment.body || github.event.discussion.body }}

          # Optional: Customize the model and prompt
          # model: 'gpt-4'
          # prompt: |
          #   You are a community moderator. Analyze the following text for policy violations.
          #   Respond ONLY with a JSON object with "is_inappropriate": boolean and "reason": "your_reason".
          #   Text: ---
          #   {{TEXT_TO_MODERATE}}
          #   ---
```
