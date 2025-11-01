# Workflow Requirements

This document defines the requirements for the CI/CD workflows for this project. The coding agent is expected to create the corresponding YAML files in the `.github/workflows/` directory.

## 1. CI Workflow (`ci.yml`)

- **Name**: `CI` or `Test`
- **Trigger**: This workflow must be triggered on `pull_request` to the `main` branch.
- **Jobs**:
  - **`test`**:
    - **Runner**: `ubuntu-latest`
    - **Steps**:
      1.  **Checkout Code**: Use `actions/checkout@v3` or a later version.
      2.  **Setup Node.js**: Use `actions/setup-node@v3` or a later version to install a recent LTS version of Node.js (e.g., 18.x).
      3.  **Install Dependencies**: Run `npm install` to install all project dependencies. A `package-lock.json` file should be used to ensure reproducible builds.
      4.  **Run Tests**: Run `npm test` to execute the Jest test suite.

## 2. Release Workflow (`release.yml`)

- **Name**: `Release`
- **Trigger**: This workflow must be triggered manually via `workflow_dispatch`.
- **Inputs**:
  - **`version-increment`**:
    - **Description**: 'The type of version increment to apply.'
    - **Type**: `choice`
    - **Options**: `patch`, `minor`, `major`
    - **Required**: `true`
- **Permissions**: The workflow will need `contents: write` permissions to push the updated `package.json` and new tag, and `issues: write` or `pull-requests: write` if the release notes are intended to reference them. The agent should define the necessary permissions.
- **Jobs**:
  - **`release`**:
    - **Runner**: `ubuntu-latest`
    - **Steps**:
      1.  **Checkout Code**: Use `actions/checkout@v3` or a later version. The `fetch-depth: 0` parameter should be used to fetch all history for versioning. A `GITHUB_TOKEN` must be provided for subsequent push operations.
      2.  **Configure Git**: Configure the git user name and email for the commit.
      3.  **Update README**: The agent is expected to create and run a script (e.g., `npm run update-readme`) that automatically updates the `README.md` file (e.g., version numbers in usage examples). The script should stage the `README.md` file after modification (`git add README.md`).
      4.  **Update Version**: Run `npm version ${{ github.event.inputs.version-increment }}`. This command will:
          - Increment the version in `package.json`.
          - Create a new commit including the staged `README.md` and the updated `package.json`.
          - Create a new Git tag with the format `vX.Y.Z`.
          - *Note*: For the first release from `0.0.0`, `npm version patch` will result in `0.0.1`. This is the expected behavior.
      5.  **Push Changes**: Push the commit and the new tag to the `main` branch.
      6.  **Create GitHub Release**: Use a community action (e.g., `actions/create-release@v1`) or a custom script to create a new GitHub Release.
          - The release should be tied to the newly created tag.
          - The release name should be the same as the tag name (e.g., `v1.2.3`).
          - The release body can be empty or contain a summary of changes (the agent can decide on a simple implementation).

## 3. Dogfooding Workflow (`moderate.yml`)

- **Name**: `Moderate Content`
- **Trigger**: This workflow must be triggered on the same events as the action itself: `issues`, `pull_request`, `issue_comment`, `pull_request_review_comment`, `discussion`, and `discussion_comment`.
- **Jobs**:
  - **`moderate`**:
    - **Runner**: `ubuntu-latest`
    - **Steps**:
      1.  **Checkout Code**: Use `actions/checkout@v3` or a later version.
      2.  **Run Moderator Action**: Use the action from the local repository (`uses: ./`).
          - Pass the required inputs: `github-token` and `openai-api-key` (as secrets).
          - Pass the text content from the event payload.
          - The agent can define appropriate default thresholds for this repository.
