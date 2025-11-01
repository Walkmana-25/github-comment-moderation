# Functional Requirements

This document outlines the functional requirements for the GitHub Content Moderator Action.

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

- The action must make a POST request to the Chat Completions API endpoint (e.g., `/chat/completions`) of the service specified by the `openai-api-base-url` input.
- The request must use the `openai-api-key` for authentication.
- The `model` and `temperature` inputs must be passed to the API.
- The prompt sent to the model will be constructed using the `text-to-moderate` input and the prompt template provided in the `prompt` input.

### 2.1. Default Prompt

If the user does not provide a custom `prompt`, the following default prompt must be used. This prompt is designed to instruct the model to act as a content moderator and return a structured JSON response.

```
You are a content moderator for a GitHub repository. Your task is to analyze the following text and determine if it violates our content policies. You must respond ONLY with a single, valid JSON object. Do not add any text before or after the JSON object.

The JSON object must have the following structure:
{
  "is_inappropriate": boolean,
  "reason": "A brief explanation of your decision.",
  "category": "one_of [hate_speech, personal_attack, spam, other]"
}

If the text is appropriate, set "is_inappropriate" to false and provide a neutral reason. If it is inappropriate, set "is_inappropriate" to true and provide the reason and category.

Here is the text to analyze:
---
{{TEXT_TO_MODERATE}}
---
```

The coding agent is responsible for replacing `{{TEXT_TO_MODERATE}}` with the actual text content.

## 3. Inappropriate Content Detection Logic

- The action must parse the response from the language model.
- **JSON Reliability**: The action must be robust against cases where the LLM does not return a valid JSON object. It should implement the following:
  - Trim any leading/trailing whitespace or markdown code fences (```json ... ```) from the response.
  - Attempt to parse the cleaned string as JSON.
  - If parsing fails, the action should retry the API call at least once.
  - If retries fail, the action should gracefully fail with a clear error message and set the `is-inappropriate` output to `false` to avoid incorrect moderation.
- If a valid JSON object is parsed, the action will consider the content "inappropriate" if the `is_inappropriate` field in the JSON is `true`.
- The outputs (`is-inappropriate`, `reason`, `category`, `llm-response-json`) must be set based on the content of the parsed JSON object.

## 4. Action on Inappropriate Content

- If the `is-inappropriate` output is `'true'`, the action must use the GitHub API to hide the content.
- The `github-token` input must be used for authentication.
- The agent is responsible for implementing the correct API calls to hide different types of content (Issues, PRs, Comments, Discussions), as previously specified.

## 5. Error Handling

- The action must gracefully handle potential errors, such as:
  - Invalid API keys or endpoints.
  - Network issues when communicating with the LLM API.
  - Invalid GitHub token or insufficient permissions.
- In case of an error, the action should fail with a clear and descriptive error message.
