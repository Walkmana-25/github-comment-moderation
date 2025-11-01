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

## 2. Integration with OpenAI Content Moderation API

- The action must make a POST request to the OpenAI Content Moderation API endpoint (`https://api.openai.com/v1/moderations`).
- The request must include the `text-to-moderate` input as the content to be analyzed.
- The `openai-api-key` input must be used for authentication with the OpenAI API.

## 3. Inappropriate Content Detection Logic

- The action must parse the JSON response from the OpenAI API.
- It will compare the scores for each moderation category (e.g., `hate`, `sexual`, etc.) against the corresponding `threshold-*` inputs provided by the user.
- If any category score exceeds its respective threshold, the content is considered "inappropriate".
- The action should set the `is-inappropriate` output to `'true'` if the content is deemed inappropriate, and `'false'` otherwise.
- The `flagged-categories` output should be populated with a comma-separated list of categories that exceeded their thresholds.

## 4. Action on Inappropriate Content

- If the content is flagged as inappropriate, the action must use the GitHub API to hide the content.
- The `github-token` input must be used for authentication with the GitHub API.
- The specific API endpoint and method to use will depend on the content type (Issue, PR, Comment, or Discussion). The agent is expected to implement the correct logic to identify the content type and hide it.
  - For example, to hide a comment, the agent might use the GraphQL API's `minimizeComment` mutation. The agent is responsible for researching and implementing the appropriate method for each content type.
  - **Note**: The GitHub API for hiding or moderating Discussions and their comments may differ from those for issues and pull requests. The agent must research and implement the correct GraphQL mutations or REST API endpoints for these content types as well.
- The reason for hiding the content should be specified as "SPAM" or "ABUSE" (or another appropriate reason that indicates a policy violation), to align with GitHub's minimize comment reasons for moderation purposes.

## 5. Error Handling

- The action must gracefully handle potential errors, such as:
  - Invalid OpenAI API key.
  - Network issues when communicating with the OpenAI API.
  - Invalid GitHub token or insufficient permissions.
  - Errors from the GitHub API when attempting to hide content.
- In case of an error, the action should fail with a clear and descriptive error message logged to the console.
