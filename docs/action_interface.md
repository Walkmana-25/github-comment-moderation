# Action Interface (action.yml)

This document defines the interface for the GitHub Action, which will be specified in the `action.yml` file.

## Inputs

### `github-token`

- **Description**: The GitHub token used to authenticate with the GitHub API. This is required to hide content.
- **Required**: `true`
- **Default**: `${{ github.token }}`

### `openai-api-key`

- **Description**: The API key for the OpenAI or compatible service.
- **Required**: `true`

### `text-to-moderate`

- **Description**: The text content to be moderated.
- **Required**: `true`
- **Example**: `${{ github.event.issue.body || github.event.pull_request.body || github.event.comment.body || github.event.discussion.body }}`

### `openai-api-base-url`

- **Description**: The base URL for the OpenAI compatible API. Can be used to connect to any service that exposes an OpenAI-like API.
- **Required**: `false`
- **Default**: `https://api.openai.com/v1`

### `model`

- **Description**: The name of the language model to use for moderation.
- **Required**: `false`
- **Default**: `gpt-3.5-turbo`

### `temperature`

- **Description**: The temperature setting for the language model, controlling the randomness of the output.
- **Required**: `false`
- **Default**: `0.7`

### `prompt`

- **Description**: A custom prompt to instruct the language model on how to perform the moderation. It must instruct the model to return a JSON object.
- **Required**: `false`
- **Default**: See `functional_requirements.md` for the default prompt text.

## Outputs

### `is-inappropriate`

- **Description**: A boolean value (`'true'` or `'false'`) indicating whether the language model judged the content as inappropriate.

### `reason`

- **Description**: The reason provided by the language model for its judgment.

### `category`

- **Description**: The category of the violation as determined by the language model.

### `llm-response-json`

- **Description**: The full JSON object returned by the language model for logging and debugging purposes.
