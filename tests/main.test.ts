import * as core from '@actions/core';
import * as github from '@actions/github';
import OpenAI from 'openai';
import { run } from '../src/main';

// Mock the entire modules
jest.mock('@actions/core');
const mockedCore = core as jest.Mocked<typeof core>;

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return { moderations: { create: mockCreate } };
  });
});

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

// Define a type for the mocked moderation response
type MockModerationResult = {
  results: [ { categories: { [key: string]: boolean; }; category_scores: { [key: string]: number; }; } ];
};

describe('Content Moderator Action', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    mockedCore.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'github-token':
          return 'test-github-token';
        case 'openai-api-key':
          return 'test-api-key';
        case 'text-to-moderate':
          return 'This is a test text.';
        default:
          return '0.5';
      }
    });
  });

  it('should hide comment and fail if content is inappropriate', async () => {
    const mockResponse: MockModerationResult = {
      results: [{
        categories: { hate: true, violence: true },
        category_scores: { hate: 0.9, violence: 0.8 },
      }],
    };
    mockCreate.mockResolvedValue(mockResponse);
    mockGraphql.mockResolvedValue({ minimizeComment: { clientMutationId: '1' } });

    await run();

    expect(mockGraphql).toHaveBeenCalledWith(expect.any(String), {
        input: {
          subjectId: 'test-node-id',
          classifier: 'OFF_TOPIC',
        },
      });
    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      'Content was flagged as inappropriate for the following categories: hate, violence'
    );
  });

  it('should succeed and not hide comment if content is appropriate', async () => {
    const mockResponse: MockModerationResult = {
        results: [{
          categories: { hate: false, violence: false },
          category_scores: { hate: 0.1, violence: 0.1 },
        }],
      };
      mockCreate.mockResolvedValue(mockResponse);

      await run();

      expect(mockGraphql).not.toHaveBeenCalled();
      expect(mockedCore.setFailed).not.toHaveBeenCalled();
      expect(mockedCore.setOutput).toHaveBeenCalledWith('is-inappropriate', 'false');
  });

  it('should fail if OpenAI API call fails', async () => {
    const errorMessage = 'API Error';
    mockCreate.mockRejectedValue(new Error(errorMessage));

    await run();

    expect(mockGraphql).not.toHaveBeenCalled();
    expect(mockedCore.setFailed).toHaveBeenCalledWith(errorMessage);
  });

  it('should fail if hiding comment fails', async () => {
    const mockResponse: MockModerationResult = {
        results: [{
          categories: { hate: true },
          category_scores: { hate: 0.9 },
        }],
      };
    mockCreate.mockResolvedValue(mockResponse);
    const graphqlError = new Error('GraphQL Error');
    mockGraphql.mockRejectedValue(graphqlError);

    await run();

    expect(mockGraphql).toHaveBeenCalled();
    expect(mockedCore.setFailed).toHaveBeenCalledWith('GraphQL Error');
  });
});
