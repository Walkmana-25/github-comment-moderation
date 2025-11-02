# GitHub Content Moderator Action

## Overview

This GitHub Action moderates the content of issues, pull requests, and comments using the OpenAI Content Moderation API. If content is flagged as inappropriate based on a user-defined threshold, it will be hidden.

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
          text-to-moderate: ${{ steps.prepare_text.outputs.text }}

      - name: Post-moderation summary
        if: steps.moderator.outputs.is-inappropriate == 'true'
        run: |
          echo "Content was flagged for the following reasons: ${{ steps.moderator.outputs.flagged-categories }}"
          echo "The content has been hidden, and the workflow continues to run successfully."
```
