import * as core from '@actions/core';
import * as github from '@actions/github';
import OpenAI from 'openai';

// Defines the expected JSON schema from the OpenAI Completions API
interface ModerationResponse {
  is_inappropriate: boolean;
  flagged_categories: string[];
  reasoning?: string;
  confidence_score?: number;
}

async function getCommentNodeId(): Promise<string> {
  const eventName = github.context.eventName;
  const payload = github.context.payload;

  let nodeId = '';

  switch (eventName) {
    case 'issue_comment':
    case 'pull_request_review_comment':
      nodeId = payload.comment?.node_id;
      break;
    case 'discussion_comment':
      nodeId = payload.comment?.node_id;
      break;
    case 'issues':
      nodeId = payload.issue?.node_id;
      break;
    case 'pull_request':
    case 'pull_request_target':
      nodeId = payload.pull_request?.node_id;
      break;
    case 'discussion':
        nodeId = payload.discussion?.node_id;
        break;
    default:
      core.info(`Unsupported event type: ${eventName}`);
  }

  if (!nodeId) {
    throw new Error('Could not determine the node_id from the event payload.');
  }

  return nodeId;
}

async function hideContent(githubToken: string, nodeId: string) {
    const octokit = github.getOctokit(githubToken);
    // Note: The 'minimizeComment' mutation works for issues, PRs, and their comments.
    // Hiding discussions and discussion comments might require different mutations
    // which are not covered by this simplified example.
    await octokit.graphql(`
      mutation($input: MinimizeCommentInput!) {
        minimizeComment(input: $input) {
          clientMutationId
        }
      }
    `, {
      input: {
        subjectId: nodeId,
        classifier: 'OFF_TOPIC',
      }
    });
  }

function constructPrompt(textToModerate: string): string {
    return `
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
${textToModerate}
---
`;
}

export async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken: string = core.getInput('github-token', { required: true });
    const openaiApiKey: string = core.getInput('openai-api-key', { required: true });
    const textToModerate: string = core.getInput('text-to-moderate', { required: true });
    const retryCount: number = parseInt(core.getInput('retry-count', { required: false }) || '3', 10);

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const prompt = constructPrompt(textToModerate);

    let moderationResult: ModerationResponse | null = null;

    for (let i = 0; i < retryCount; i++) {
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
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
        const nodeId = await getCommentNodeId();
        await hideContent(githubToken, nodeId);
        core.info(`Successfully hid content with node_id: ${nodeId}`);
      } catch (hideError) {
          core.warning(`Failed to hide content. This might be due to missing permissions or an unsupported event type. Error: ${hideError}`);
      }

      core.setFailed(`Content was flagged as inappropriate. Categories: ${flaggedCategoriesStr}. Reasoning: ${moderationResult.reasoning || 'N/A'}`);
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
