import unittest
from unittest.mock import patch, MagicMock
import os
import sys
import io

# Add src to the Python path to allow importing main
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from main import moderate_content

class TestContentModerator(unittest.TestCase):

    def tearDown(self):
        """Clean up the temporary files."""
        if os.path.exists("test_output.json"):
            os.remove("test_output.json")

    @patch('requests.post')
    @patch('os.getenv')
    def test_clean_content(self, mock_getenv, mock_post):
        """Tests that clean content does not get flagged."""
        # Mock environment variables (inputs)
        mock_getenv.side_effect = lambda key, default=None: {
            "INPUT_OPENAI-API-KEY": "fake-key",
            "INPUT_TEXT-TO-MODERATE": "This is a clean message.",
            "GITHUB_OUTPUT": "test_output.json",
        }.get(key, default)

        # Mock the API response for clean content
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [{
                "flagged": False,
                "categories": {},
                "category_scores": {
                    "hate": 0.1, "hate/threatening": 0.1, "sexual": 0.1,
                    "violence": 0.1, "self-harm": 0.1
                }
            }]
        }
        mock_response.text = '{"results": [{"flagged": false}]}'
        mock_post.return_value = mock_response

        # Capture stdout to check the outputs
        captured_output = io.StringIO()
        sys.stdout = captured_output

        moderate_content()

        # Restore stdout
        sys.stdout = sys.__stdout__

        # Verify action outputs written to the file
        with open("test_output.json", "r") as f:
            output_file_content = f.read()

        self.assertIn("is-inappropriate=false", output_file_content)
        self.assertIn("flagged-categories=", output_file_content)


    @patch('requests.post')
    @patch('os.getenv')
    def test_inappropriate_content(self, mock_getenv, mock_post):
        """Tests that inappropriate content is correctly flagged."""
        mock_getenv.side_effect = lambda key, default=None: {
            "INPUT_OPENAI-API-KEY": "fake-key",
            "INPUT_TEXT-TO-MODERATE": "This is a hateful message.",
            "INPUT_THRESHOLD-HATE": "0.3",
            "GITHUB_EVENT_PATH": None, # Ensure we don't try to read event file
            "GITHUB_OUTPUT": "test_output.json",
        }.get(key, "0.5") # Default threshold for others

        # Mock the API response for inappropriate content
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [{
                "flagged": True,
                "categories": {"hate": True, "violence": True},
                "category_scores": {
                    "hate": 0.9, "hate/threatening": 0.1, "sexual": 0.1,
                    "violence": 0.95, "self-harm": 0.1
                }
            }]
        }
        mock_response.text = '{"results": [{"flagged": true}]}'
        mock_post.return_value = mock_response

        captured_output = io.StringIO()
        sys.stdout = captured_output

        moderate_content()

        sys.stdout = sys.__stdout__

        # Verify action outputs written to the file
        with open("test_output.json", "r") as f:
            output_file_content = f.read()

        self.assertIn("is-inappropriate=true", output_file_content)
        self.assertIn("flagged-categories=hate,violence", output_file_content)

if __name__ == '__main__':
    unittest.main()
