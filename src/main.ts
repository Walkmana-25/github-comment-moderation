import * as core from '@actions/core';
import * as github from '@actions/github';
import OpenAI from 'openai';
import { TextNormalizer } from './utils/textNormalizer';

// Defines the expected JSON schema from the OpenAI Completions API
interface ModerationResponse {
  is_inappropriate: boolean;
  flagged_categories: string[];
  reasoning?: string;
  confidence_score?: number;
}

function buildTextToModerate(inputText: string, eventName: string): string {
  // If user explicitly provided text-to-moderate, use it as-is
  if (inputText) {
    return inputText;
  }

  // Otherwise, build text from event payload
  const payload = github.context.payload;

  switch (eventName) {
    case 'issues': {
      const title = payload.issue?.title || '';
      const body = payload.issue?.body || '';
      return title ? `${title}\n\n${body}` : body;
    }

    case 'pull_request':
    case 'pull_request_target': {
      const title = payload.pull_request?.title || '';
      const body = payload.pull_request?.body || '';
      return title ? `${title}\n\n${body}` : body;
    }

    case 'discussion': {
      const title = payload.discussion?.title || '';
      const body = payload.discussion?.body || '';
      return title ? `${title}\n\n${body}` : body;
    }

    case 'issue_comment':
    case 'pull_request_review_comment':
    case 'discussion_comment':
    default:
      // For comments, return body only
      return payload.comment?.body || '';
  }
}

async function hideContent(githubToken: string, eventName: string) {
    const octokit = github.getOctokit(githubToken);
    const payload = github.context.payload;

    try {
      switch (eventName) {
        case 'issue_comment':
        case 'pull_request_review_comment':
        case 'discussion_comment': {
          const nodeId = payload.comment?.node_id;
          if (!nodeId) {
            throw new Error('Could not determine comment node_id');
          }
          await octokit.graphql(`
            mutation($input: MinimizeCommentInput!) {
              minimizeComment(input: $input) {
                clientMutationId
              }
            }
          `, {
            input: {
              subjectId: nodeId,
              classifier: 'ABUSE',
            }
          });
          core.info(`Minimized comment with node_id: ${nodeId}`);
          break;
        }

        case 'issues': {
          const issueNumber = payload.issue?.number;
          const repoName = payload.repository?.name;
          const repoOwner = payload.repository?.owner?.login;
          if (!issueNumber || !repoName || !repoOwner) {
            throw new Error('Could not determine issue details');
          }
          // Close the issue
          await octokit.rest.issues.update({
            owner: repoOwner,
            repo: repoName,
            issue_number: issueNumber,
            state: 'closed',
            state_reason: 'not_planned',
          });
          // Lock the issue
          await octokit.rest.issues.lock({
            owner: repoOwner,
            repo: repoName,
            issue_number: issueNumber,
            lock_reason: 'spam',
          });
          core.info(`Closed and locked issue #${issueNumber}`);
          break;
        }

        case 'pull_request':
        case 'pull_request_target': {
          const prNumber = payload.pull_request?.number;
          const repoName = payload.repository?.name;
          const repoOwner = payload.repository?.owner?.login;
          if (!prNumber || !repoName || !repoOwner) {
            throw new Error('Could not determine PR details');
          }
          // Close the PR
          await octokit.rest.pulls.update({
            owner: repoOwner,
            repo: repoName,
            pull_number: prNumber,
            state: 'closed',
          });
          // Lock the PR (uses the same lock endpoint as issues)
          await octokit.rest.issues.lock({
            owner: repoOwner,
            repo: repoName,
            issue_number: prNumber,
            lock_reason: 'spam',
          });
          core.info(`Closed and locked PR #${prNumber}`);
          break;
        }

        case 'discussion': {
          const discussionId = payload.discussion?.node_id;
          if (!discussionId) {
            throw new Error('Could not determine discussion node_id');
          }
          await octokit.graphql(`
            mutation($input: LockDiscussionInput!) {
              lockDiscussion(input: $input) {
                discussion {
                  id
                }
              }
            }
          `, {
            input: {
              discussionId: discussionId,
              reason: 'SPAM',
            }
          });
          core.info(`Locked discussion with node_id: ${discussionId}`);
          break;
        }

        default:
          core.warning(`Unsupported event type for hiding: ${eventName}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        core.warning(`Failed to hide content: ${error.message}`);
      }
      throw error;
    }
  }

function constructPrompt(textToModerate: string): string {
  return `You are a content moderator for a GitHub repository. Analyze the following content and determine if it violates our content policy.

Content Policy Prohibits:
- Hate speech or discriminatory language
- Sexual content or explicit material
- Violence, threats, or promoting harm
- Self-harm or suicide-related content
- Harassment or bullying

Please respond with a JSON object following this exact schema:
{
  "is_inappropriate": "boolean",
  "flagged_categories": "array of strings (e.g., ['hate', 'violence'])",
  "reasoning": "string explaining the decision",
  "confidence_score": "float between 0 and 1"
}

Content to analyze:
---
${textToModerate}
---`;
}

export async function run(): Promise<void> {
  try {
    core.info(`Starting content moderation for event: ${github.context.eventName}`);

    // Get inputs
    const githubToken: string = core.getInput('github-token', { required: true });
    let openaiApiKey: string = core.getInput('openai-api-key', { required: false });
    const openaiEndpoint: string = core.getInput('openai-endpoint', { required: false });
    const openaiModel: string = core.getInput('openai-model', { required: false });
    const inputText: string = core.getInput('text-to-moderate', { required: false }) || '';
    const textToModerate: string = buildTextToModerate(inputText, github.context.eventName);
    const retryCount: number = parseInt(core.getInput('retry-count', { required: false }) || '3', 10);
    core.info(`Prepared moderation target (length: ${textToModerate.length})`);

    // Use github-token as the default API key if openai-api-key is not provided
    if (!openaiApiKey) {
        openaiApiKey = githubToken;
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: openaiEndpoint,
    });

    // Step 1: Normalize text for consistent moderation
    const normalizedText = TextNormalizer.normalize(textToModerate);

    // Step 2: Build enhanced prompt
    const prompt = constructPrompt(normalizedText);

    let moderationResult: ModerationResponse | null = null;

    for (let i = 0; i < retryCount; i++) {
        try {
            const completion = await openai.chat.completions.create({
                model: openaiModel,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
            });

            const jsonResponse = completion.choices[0]?.message?.content;
            if (!jsonResponse) {
                throw new Error('Received an empty response from the OpenAI API.');
            }

            // The API is instructed to return JSON, but we should still validate it
            const parsedResponse = JSON.parse(jsonResponse) as ModerationResponse;
            if (typeof parsedResponse.is_inappropriate !== 'boolean' || !Array.isArray(parsedResponse.flagged_categories)) {
                throw new Error('Invalid JSON schema received from OpenAI API.');
            }

            moderationResult = parsedResponse;
            core.setOutput('moderation-results-json', jsonResponse);
            break; // Success, exit the retry loop
        } catch (error) {
            core.warning(`OpenAI API call failed on attempt ${i + 1} of ${retryCount}.`);
            if (i === retryCount - 1) {
                throw error; // Re-throw the last error
            }
        }
    }

    if (!moderationResult) {
        throw new Error('Failed to get a valid response from the OpenAI API after multiple retries.');
    }


    if (moderationResult.is_inappropriate) {
      core.setOutput('is-inappropriate', 'true');
      const flaggedCategoriesStr = moderationResult.flagged_categories.join(',');
      core.setOutput('flagged-categories', flaggedCategoriesStr);

      try {
        await hideContent(githubToken, github.context.eventName);
      } catch (hideError) {
        // Error is already logged in hideContent
      }

      core.info(`Content was flagged as inappropriate. Categories: ${flaggedCategoriesStr}. Reasoning: ${moderationResult.reasoning || 'N/A'}`);
    } else {
      core.setOutput('is-inappropriate', 'false');
      core.setOutput('flagged-categories', '');
      core.info('Content was deemed appropriate.');
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}
