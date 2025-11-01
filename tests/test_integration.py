import unittest
from unittest.mock import patch, MagicMock
import os
import sys
import io
import json

# Add src to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from main import moderate_content

class TestActionIntegration(unittest.TestCase):

    def setUp(self):
        """Set up a temporary event payload file."""
        self.event_payload = {
            "comment": {
                "body": "This is a hateful test comment.",
                "node_id": "MDQ6VXNlcjU4MzIzMQ=="
            }
        }
        with open("test_event.json", "w") as f:
            json.dump(self.event_payload, f)

    def tearDown(self):
        """Clean up the temporary files."""
        if os.path.exists("test_event.json"):
            os.remove("test_event.json")
        if os.path.exists("test_output.json"):
            os.remove("test_output.json")

    @patch('requests.post')
    @patch('os.getenv')
    def test_end_to_end_flow(self, mock_getenv, mock_post):
        """Tests the full workflow from event payload to hiding a comment."""
        # Mock environment variables to simulate GitHub Actions environment
        mock_getenv.side_effect = lambda key, default=None: {
            "INPUT_OPENAI-API-KEY": "fake-openai-key",
            "INPUT_TEXT-TO-MODERATE": self.event_payload["comment"]["body"],
            "INPUT_GITHUB-TOKEN": "fake-github-token",
            "GITHUB_EVENT_PATH": "test_event.json",
            "INPUT_THRESHOLD-HATE": "0.8",
            "GITHUB_OUTPUT": "test_output.json"
        }.get(key, "0.5")

        # Mock responses for both OpenAI and GitHub APIs
        mock_openai_response = MagicMock()
        mock_openai_response.status_code = 200
        mock_openai_response.json.return_value = {
            "results": [{"category_scores": {"hate": 0.9, "violence": 0.2}}]
        }
        mock_openai_response.text = '{"results": [{"flagged": true}]}'

        mock_github_response = MagicMock()
        mock_github_response.status_code = 200
        mock_github_response.json.return_value = {"data": {"minimizeComment": {"clientMutationId": "1"}}}

        # requests.post should return the OpenAI response first, then the GitHub response
        mock_post.side_effect = [mock_openai_response, mock_github_response]

        # Capture stdout to verify outputs and logs
        captured_output = io.StringIO()
        sys.stdout = captured_output

        moderate_content()

        sys.stdout = sys.__stdout__

        output_log = captured_output.getvalue()

        # Verify action outputs written to the file
        with open("test_output.json", "r") as f:
            output_file_content = f.read()

        self.assertIn("is-inappropriate=true", output_file_content)
        self.assertIn("flagged-categories=hate", output_file_content)

        # Verify that the GitHub API was called to hide the comment from the log
        self.assertIn("Successfully hid comment with node_id: MDQ6VXNlcjU4MzIzMQ==", output_log)

        # Check that requests.post was called twice (for OpenAI and GitHub)
        self.assertEqual(mock_post.call_count, 2)
        # Check the GitHub GraphQL API call
        github_call_args = mock_post.call_args_list[1]
        self.assertEqual(github_call_args.args[0], "https://api.github.com/graphql")
        self.assertIn("minimizeComment", github_call_args.kwargs['json']['query'])


if __name__ == '__main__':
    unittest.main()
