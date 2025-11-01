import os
import requests
import sys
import json

def hide_github_comment(github_token, node_id):
    """
    Hides a comment on GitHub using the GraphQL API.
    """
    if not github_token:
        print("Warning: GitHub token is missing. Cannot hide the comment.", file=sys.stderr)
        return

    if not node_id:
        print("Warning: Could not determine the node_id of the content to hide.", file=sys.stderr)
        return

    headers = {
        "Authorization": f"bearer {github_token}",
        "Content-Type": "application/json",
    }
    query = """
    mutation MinimizeComment($input: MinimizeCommentInput!) {
      minimizeComment(input: $input) {
        clientMutationId
      }
    }
    """
    variables = {
        "input": {
            "subjectId": node_id,
            "classifier": "OFF_TOPIC",
        }
    }

    try:
        response = requests.post(
            "https://api.github.com/graphql",
            headers=headers,
            json={"query": query, "variables": variables},
            timeout=30
        )
        response.raise_for_status()
        print(f"Successfully hid comment with node_id: {node_id}")
    except requests.exceptions.RequestException as e:
        print(f"Error calling GitHub GraphQL API: {e}", file=sys.stderr)
    except Exception as e:
        print(f"An unexpected error occurred while hiding the comment: {e}", file=sys.stderr)


def moderate_content():
    """
    Moderates text using OpenAI and hides it on GitHub if inappropriate.
    """
    # Get inputs from environment variables
    openai_api_key = os.getenv("INPUT_OPENAI-API-KEY")
    text_to_moderate = os.getenv("INPUT_TEXT-TO-MODERATE")
    github_token = os.getenv("INPUT_GITHUB-TOKEN")

    if not openai_api_key or not text_to_moderate:
        print("Error: Missing required inputs (openai-api-key or text-to-moderate).", file=sys.stderr)
        sys.exit(1)

    try:
        # Step 1: Moderate content with OpenAI
        response = requests.post(
            "https://api.openai.com/v1/moderations",
            headers={"Authorization": f"Bearer {openai_api_key}", "Content-Type": "application/json"},
            json={"input": text_to_moderate},
            timeout=30
        )
        response.raise_for_status()
        moderation_results = response.json()

        # Step 2: Process moderation results
        results = moderation_results["results"][0]
        category_scores = results["category_scores"]

        thresholds = {
            "hate": float(os.getenv("INPUT_THRESHOLD-HATE", 0.5)),
            "hate/threatening": float(os.getenv("INPUT_THRESHOLD-HATE-THREATENING", 0.5)),
            "sexual": float(os.getenv("INPUT_THRESHOLD-SEXUAL", 0.5)),
            "violence": float(os.getenv("INPUT_THRESHOLD-VIOLENCE", 0.5)),
            "self-harm": float(os.getenv("INPUT_THRESHOLD-SELF-HARM", 0.5)),
        }

        is_inappropriate = False
        flagged_categories = []
        for category, score in category_scores.items():
            if category in thresholds and score > thresholds[category]:
                is_inappropriate = True
                flagged_categories.append(category)

        # Step 3: Set action outputs using the recommended file-based method
        output_file = os.getenv("GITHUB_OUTPUT")
        if output_file:
            with open(output_file, "a") as f:
                f.write(f"is-inappropriate={str(is_inappropriate).lower()}\n")
                f.write(f"flagged-categories={','.join(flagged_categories)}\n")
                f.write(f"moderation-results-json={response.text}\n")
        else:
            # Fallback for local testing or older runners
            print(f"::set-output name=is-inappropriate::{str(is_inappropriate).lower()}")
            print(f"::set-output name=flagged-categories::{','.join(flagged_categories)}")
            print(f"::set-output name=moderation-results-json::{response.text}")


        # Step 4: Hide content if inappropriate
        if is_inappropriate:
            print("Content flagged as inappropriate. Attempting to hide.")
            event_path = os.getenv("GITHUB_EVENT_PATH")
            if event_path and os.path.exists(event_path):
                with open(event_path, "r") as f:
                    event_data = json.load(f)

                # Extract node_id from comment events
                node_id = event_data.get("comment", {}).get("node_id")

                if node_id:
                    hide_github_comment(github_token, node_id)
                else:
                    print("Warning: Hiding content is currently only supported for comments.", file=sys.stderr)
            else:
                print("Warning: GITHUB_EVENT_PATH not found. Cannot determine content to hide.", file=sys.stderr)

    except requests.exceptions.RequestException as e:
        print(f"Error calling an API: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    moderate_content()
