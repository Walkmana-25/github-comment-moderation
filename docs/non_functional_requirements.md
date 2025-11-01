# Non-Functional Requirements

This document specifies the non-functional requirements for the GitHub Content Moderator Action.

## 1. Security

- **Secrets Handling**: The `openai-api-key` and `github-token` inputs are sensitive values. They must be handled as secrets within the action. Under no circumstances should these keys be printed to the console logs. The coding agent should ensure that any debugging or error messages do not expose these secrets.

## 2. Technology Stack

- **Programming Language**: The action must be implemented using **Python**.
- **Dependencies**: The agent should choose well-maintained and reputable Python libraries for making HTTP requests (e.g., `requests`) and interacting with the GitHub environment. All dependencies must be documented in a `requirements.txt` file.

## 3. Performance

- **Execution Time**: The action should be optimized to complete its execution as quickly as possible to avoid unnecessarily delaying GitHub workflows. API calls to OpenAI and GitHub should be made efficiently.

## 4. Code Quality and Maintainability

- **Style Guide**: The Python code should adhere to the PEP 8 style guide.
- **Documentation**: The code should be well-commented, especially for complex logic related to API interactions and content hiding procedures.
- **Structure**: The project should be structured logically, separating concerns where appropriate (e.g., API clients, business logic).

## 5. Testing

### 5.1. Unit Tests

- The coding agent is expected to provide unit tests for the core logic of the action. This includes testing the logic for:
  - Parsing the OpenAI API response.
  - Comparing scores against thresholds.
  - Correctly identifying content as appropriate or inappropriate.
- Mocking should be used to simulate API calls to OpenAI and GitHub to avoid reliance on external services during testing.

### 5.2. Integration Tests

- The agent must write integration tests to verify the end-to-end workflow of the action.
- These tests should use sample GitHub event payloads (e.g., a sample `issue.opened` event) as input.
- The tests must verify that the action correctly:
  - Parses the input from the event payload.
  - Calls the (mocked) OpenAI Moderation API with the correct text.
  - Processes the (mocked) response from the OpenAI API.
  - Calls the (mocked) GitHub API to hide the content if the moderation threshold is exceeded.
  - Sets the correct action outputs (`is-inappropriate`, `flagged-categories`, etc.).
