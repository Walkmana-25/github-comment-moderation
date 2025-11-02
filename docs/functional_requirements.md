# Functional Requirements

This document outlines the functional requirements for the GitHub Content Moderator Action. The agent tasked with coding this action should adhere to these specifications.

## 1. Content Moderation Scope

The action must be able to moderate the text content from the following GitHub events:
- Issues (`issues` event: `opened`, `edited` types)
- Pull Requests (`pull_request` event: `opened`, `edited` types)
- Issue Comments (`issue_comment` event: `created`, `edited` types)
- Pull Request Comments (`pull_request_review_comment` event: `created`, `edited` types)
- Discussions (`discussion` event: `created`, `edited` types)
- Discussion Comments (`discussion_comment` event: `created`, `edited` types)

The text to be moderated will be passed via the `text-to-moderate` input.

## 2. Integration with OpenAI Completions API

- The action must send a prompt to the OpenAI Completions API. This prompt will instruct the language model to act as a content moderator.
- The action must leverage a feature of the Completions API, such as "JSON mode", to guarantee that the model's response is a valid, structured JSON object.
- The request must include the `text-to-moderate` input as the content to be analyzed.
- The `openai-api-key` input must be used for authentication with the OpenAI API.

## 3. Inappropriate Content Detection Logic

- The action must parse the structured JSON response from the OpenAI Completions API. The primary indicator for inappropriate content is the `is_inappropriate` boolean field in the JSON response.
- The action should set the `is-inappropriate` output to `'true'` if `is_inappropriate` is `true` in the response, and `'false'` otherwise.
- The `flagged-categories` output should be populated with a comma-separated list of the strings from the `flagged_categories` array in the JSON response.

### 3.1. Expected JSON Schema

The prompt sent to the Completions API must instruct the model to return a JSON object that adheres to the following schema:

```json
{
  "is_inappropriate": "boolean",
  "flagged_categories": "array of strings",
  "reasoning": "string",
  "confidence_score": "float"
}
```

- **`is_inappropriate`**: (Required) A boolean indicating if the content violates the moderation policy.
- **`flagged_categories`**: (Required) A list of categories (e.g., "hate", "sexual", "violence") that were flagged. Should be an empty array if `is_inappropriate` is false.
- **`reasoning`**: (Optional) A brief explanation for the moderation decision, useful for logging and debugging.
- **`confidence_score`**: (Optional) A float between 0.0 and 1.0 representing the model's confidence in its decision.

### 3.2. Example Prompt

The action should use a configurable prompt. A suitable default prompt would be:

```
You are a content moderator for a GitHub repository. Please analyze the following text and determine if it violates our content policy. The policy prohibits hate speech, sexual content, violence, and self-harm.

Please respond with a JSON object that follows this exact schema:
{
  "is_inappropriate": "boolean",
  "flagged_categories": "array of strings",
  "reasoning": "string",
  "confidence_score": "float"
}

Here is the text to analyze:
---
[TEXT TO MODERATE HERE]
---
```

## 4. Action on Inappropriate Content

- If the content is flagged as inappropriate, the action must use the GitHub API to hide the content.
- The `github-token` input must be used for authentication with the GitHub API.
- The specific API endpoint and method to use will depend on the content type (Issue, PR, Comment, or Discussion). The agent is expected to implement the correct logic to identify the content type and hide it.
  - For example, to hide a comment, the agent might use the GraphQL API's `minimizeComment` mutation. The agent is responsible for researching and implementing the appropriate method for each content type.
  - **Note**: The GitHub API for hiding or moderating Discussions and their comments may differ from those for issues and pull requests. The agent must research and implement the correct GraphQL mutations or REST API endpoints for these content types as well.
- The reason for hiding the content should be specified as "ABUSE".
- After successfully hiding the content, the action should log the moderation details and complete with a 'success' status. It should not fail the workflow.

## 5. Error Handling

- The action must gracefully handle potential errors, such as:
  - Invalid OpenAI API key.
  - Network issues when communicating with the OpenAI API.
  - Invalid GitHub token or insufficient permissions.
  - Errors from the GitHub API when attempting to hide content.
- The action must retry failed API calls. The number of retries is determined by the `retry-count` input.
- In case of an error, the action should fail with a clear and descriptive error message logged to the console.
