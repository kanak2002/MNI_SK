import json
import os
from backend.persona_engine import get_persona # edited this for the folder path

# ---------------------------------------------------------
# Load Third-Party Trust Database
# ---------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRUST_DB_FILE = os.path.join(BASE_DIR, "third_party_trust_db.json")

def load_trust_db():
    """
    Loads the third-party trust database from JSON file
    """
    try:
        with open(TRUST_DB_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        raise Exception(f"Error loading trust DB: {str(e)}")


# ---------------------------------------------------------
# Check if a third-party service is trusted for a persona
# ---------------------------------------------------------

def is_third_party_trusted(third_party: str, persona_name: str):
    """
    Determines if a service is trusted for a given persona
    """
    trust_db = load_trust_db()

    # If service not found → treat as untrusted
    if third_party not in trust_db:
        return False, "Unknown third party"

    trusted_by = trust_db[third_party]["trusted_by"]

    # If persona is allowed OR wildcard "*" → trusted
    if persona_name in trusted_by or "*" in trusted_by:
        return True, "Trusted third party"

    return False, "Not trusted for this persona"


# ---------------------------------------------------------
# Main Classifier Function
# ---------------------------------------------------------

def classify_subtask(subtask: dict, persona_name: str):
    """
    Analyzes a subtask and identifies:
    - blocked data (violates persona rules)
    - data that can be substituted (safer alternatives)
    - whether the third-party is trusted

    This is NOT the final decision — just classification.
    """

    # Load persona rules
    persona = get_persona(persona_name)

    data_required = subtask.get("data_required", [])
    third_party = subtask.get("third_party")

    blocked_data = []
    substituted_data = []

    # -----------------------------------------------------
    # Step 1: Check for blocked data types
    # -----------------------------------------------------
    for data in data_required:
        if data in persona["blocked_data_types"]:
            blocked_data.append(data)

    # -----------------------------------------------------
    # Step 2: Check for substitution opportunities
    # Example: precise_location → city
    # -----------------------------------------------------
    for data in data_required:
        if data in persona["substitution_rules"]:
            substituted_data.append({
                "original": data,
                "substitute": persona["substitution_rules"][data]
            })

    # -----------------------------------------------------
    # Step 3: Check third-party trust
    # -----------------------------------------------------
    trusted, trust_reason = is_third_party_trusted(third_party, persona_name)

    # -----------------------------------------------------
    # Return classification result
    # -----------------------------------------------------
    return {
        "blocked_data": blocked_data,
        "substitutions": substituted_data,
        "third_party_trusted": trusted,
        "trust_reason": trust_reason
    }