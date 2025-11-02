# Action Interface (action.yml)

This document defines the interface for the GitHub Action, which will be specified in the `action.yml` file.

## Inputs

### `github-token`

- **Description**: The GitHub token used to authenticate with the GitHub API. This is required to hide comments, issues, or pull requests.
- **Required**: `true`
- **Default**: `${{ github.token }}`

### `openai-api-key`

- **Description**: The API key for the OpenAI service. This is required to access the Completions API endpoint.
- **Required**: `true`

### `retry-count`

- **Description**: The number of times to retry the OpenAI API call on failure.
- **Required**: `false`
- **Default**: `3`

### `text-to-moderate`

- **Description**: The text content to be moderated. This will typically be the body of an issue, pull request, discussion, or a comment.
- **Required**: `true`
- **Example**: `${{ github.event.issue.body || github.event.pull_request.body || github.event.comment.body || github.event.discussion.body }}`

### `threshold-hate`

- **Description**: The threshold (a float between 0.0 and 1.0) for the 'hate' category. If the score exceeds this value, the content will be flagged.
- **Required**: `false`
- **Default**: `0.5`

### `threshold-hate-threatening`

- **Description**: The threshold for the 'hate/threatening' category.
- **Required**: `false`
- **Default**: `0.5`

### `threshold-sexual`

- **Description**: The threshold for the 'sexual' category.
- **Required**: `false`
- **Default**: `0.5`

### `threshold-violence`

- **Description**: The threshold for the 'violence' category.
- **Required**: `false`
- **Default**: `0.5`

### `threshold-self-harm`

- **Description**: The threshold for the 'self-harm' category.
- **Required**: `false`
- **Default**: `0.5`

*Note: The coding agent should allow for thresholds to be set for all major OpenAI moderation categories.*

## Outputs

### `is-inappropriate`

- **Description**: A boolean value (`'true'` or `'false'`) indicating whether the content was flagged as inappropriate based on the provided thresholds.

### `flagged-categories`

- **Description**: A comma-separated string of the moderation categories that were flagged.

### `moderation-results-json`

- **Description**: The full JSON response from the OpenAI Completions API for logging and debugging purposes.
