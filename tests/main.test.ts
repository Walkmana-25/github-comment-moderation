import * as core from '@actions/core';
import * as github from '@actions/github';
import { run } from '../src/main';

// Mock the entire modules
jest.mock('@actions/core');
const mockedCore = core as jest.Mocked<typeof core>;

// Mock OpenAI chat completions
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return { chat: { completions: { create: mockCreate } } };
  });
});

// Mock GitHub API
const mockGraphql = jest.fn();
jest.mock('@actions/github', () => ({
  ...jest.requireActual('@actions/github'),
  getOctokit: jest.fn(() => ({
    graphql: mockGraphql,
  })),
  context: {
    eventName: 'issue_comment',
    payload: {
      comment: {
        node_id: 'test-node-id',
      },
    },
  },
}));

describe('Content Moderator Action', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock inputs
    mockedCore.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'github-token':
          return 'test-github-token';
        case 'openai-api-key':
          return 'test-api-key';
        case 'text-to-moderate':
          return 'This is some test text.';
        case 'retry-count':
          return '3';
        default:
          return '';
      }
    });
  });

  it('should hide content and fail if content is inappropriate', async () => {
    const mockApiResponse = {
      is_inappropriate: true,
      flagged_categories: ['hate', 'violence'],
      reasoning: 'The text contains hateful and violent content.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockApiResponse) } }],
    });
    mockGraphql.mockResolvedValue({ minimizeComment: { clientMutationId: '1' } });

    await run();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockGraphql).toHaveBeenCalledWith(expect.any(String), {
      input: {
        subjectId: 'test-node-id',
        classifier: 'ABUSE',
      },
    });
    expect(mockedCore.setOutput).toHaveBeenCalledWith('is-inappropriate', 'true');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('flagged-categories', 'hate,violence');
    expect(mockedCore.info).toHaveBeenCalledWith(
      expect.stringContaining('Content was flagged as inappropriate.')
    );
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('should not hide content if it is appropriate', async () => {
    const mockApiResponse = {
      is_inappropriate: false,
      flagged_categories: [],
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockApiResponse) } }],
    });

    await run();

    expect(mockGraphql).not.toHaveBeenCalled();
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    expect(mockedCore.setOutput).toHaveBeenCalledWith('is-inappropriate', 'false');
    expect(mockedCore.setOutput).toHaveBeenCalledWith('flagged-categories', '');
  });

  it('should retry OpenAI API call on failure', async () => {
    const mockApiResponse = {
      is_inappropriate: false,
      flagged_categories: [],
    };
    mockCreate
      .mockRejectedValueOnce(new Error('API Error 1'))
      .mockRejectedValueOnce(new Error('API Error 2'))
      .mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockApiResponse) } }],
      });

    await run();

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
  });

  it('should fail after all retries are exhausted', async () => {
    const errorMessage = 'Final API Error';
    mockCreate.mockRejectedValue(new Error(errorMessage));

    await run();

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockedCore.setFailed).toHaveBeenCalledWith(errorMessage);
  });

  it('should fail if the API response has an invalid JSON schema', async () => {
    const invalidResponse = {
        // Missing 'is_inappropriate' and 'flagged_categories'
        some_other_field: true,
    };
    mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(invalidResponse) } }],
    });

    await run();

    expect(mockedCore.setFailed).toHaveBeenCalledWith('Invalid JSON schema received from OpenAI API.');
  });
});
