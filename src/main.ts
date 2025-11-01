import * as core from '@actions/core';
import * as github from '@actions/github';
import OpenAI from 'openai';

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

async function hideComment(githubToken: string, nodeId: string) {
    const octokit = github.getOctokit(githubToken);
    await octokit.graphql(`
      mutation($input: MinimizeCommentInput!) {
        minimizeComment(input: $input) {
          clientMutationId
        }
      }
    `, {
      input: {
        subjectId: nodeId,
        classifier: 'OFF_TOPIC', // or RESOLVED, SPAM, etc.
      }
    });
  }

export async function run(): Promise<void> {
  try {
    // Get inputs
    const githubToken: string = core.getInput('github-token', { required: true });
    const openaiApiKey: string = core.getInput('openai-api-key', { required: true });
    const textToModerate: string = core.getInput('text-to-moderate', { required: true });
    const thresholdHate: number = parseFloat(core.getInput('threshold-hate'));
    const thresholdHateThreatening: number = parseFloat(core.getInput('threshold-hate-threatening'));
    const thresholdSexual: number = parseFloat(core.getInput('threshold-sexual'));
    const thresholdViolence: number = parseFloat(core.getInput('threshold-violence'));
    const thresholdSelfHarm: number = parseFloat(core.getInput('threshold-self-harm'));

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Call the moderation API
    const moderation = await openai.moderations.create({
      input: textToModerate,
      model: 'omni-moderation-latest',
    });

    const results = moderation.results[0];
    const categories = results.categories;
    const categoryScores = results.category_scores;

    core.setOutput('moderation-results-json', JSON.stringify(results));

    const flaggedCategories: string[] = [];
    if (categories.hate && categoryScores.hate > thresholdHate) {
      flaggedCategories.push('hate');
    }
    if (categories['hate/threatening'] && categoryScores['hate/threatening'] > thresholdHateThreatening) {
      flaggedCategories.push('hate/threatening');
    }
    if (categories.sexual && categoryScores.sexual > thresholdSexual) {
      flaggedCategories.push('sexual');
    }
    if (categories.violence && categoryScores.violence > thresholdViolence) {
      flaggedCategories.push('violence');
    }
    if (categories['self-harm'] && categoryScores['self-harm'] > thresholdSelfHarm) {
      flaggedCategories.push('self-harm');
    }

    if (flaggedCategories.length > 0) {
      core.setOutput('is-inappropriate', 'true');
      core.setOutput('flagged-categories', flaggedCategories.join(','));

      // Hide the comment
      const nodeId = await getCommentNodeId();
      await hideComment(githubToken, nodeId);
      core.info(`Successfully hid comment with node_id: ${nodeId}`);

      core.setFailed(`Content was flagged as inappropriate for the following categories: ${flaggedCategories.join(', ')}`);
    } else {
      core.setOutput('is-inappropriate', 'false');
      core.setOutput('flagged-categories', '');
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}
