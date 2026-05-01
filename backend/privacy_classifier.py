import json
import os
from backend.persona_engine import get_persona  # edited this for the folder path

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
# Normalize third-party names
# ---------------------------------------------------------

def normalize_party_name(third_party: str):
    """
    Normalizes third-party names so that Netflix, netflix, and NETFLIX
    are treated consistently.
    """
    if not third_party:
        return "unknown"
    return third_party.strip().lower()


# ---------------------------------------------------------
# Check if a third-party service is trusted for a persona
# ---------------------------------------------------------

def is_third_party_trusted(third_party: str, persona_name: str):
    """
    Determines if a service is trusted for a given persona.
    This checks both personas.json and third_party_trust_db.json.
    """

    persona = get_persona(persona_name)
    normalized_party = normalize_party_name(third_party)

    # First check trusted_third_parties from personas.json
    trusted_from_persona = [
        party.lower() for party in persona.get("trusted_third_parties", [])
    ]

    if normalized_party in trusted_from_persona:
        return True, "Trusted third party from persona rules"

    # Then check third_party_trust_db.json if available
    try:
        trust_db = load_trust_db()
        if normalized_party in trust_db:
            trusted_by = trust_db[normalized_party].get("trusted_by", [])
            if persona_name in trusted_by or "*" in trusted_by:
                return True, "Trusted third party from trust database"
    except Exception:
        pass

    return False, "Not trusted for this persona"


# ---------------------------------------------------------
# Main Classifier Function
# ---------------------------------------------------------

def classify_subtask(subtask: dict, persona_name: str):
    """
    Analyzes a subtask and identifies:
    - blocked data
    - data that can be substituted
    - missing or sensitive data
    - whether the third-party is trusted

    This is NOT the final decision — just classification.
    """

    persona = get_persona(persona_name)

    data_required = subtask.get("data_required", [])
    third_party = normalize_party_name(subtask.get("third_party", "unknown"))

    blocked_data = []
    substituted_data = []
    confirmation_data = []

    # -----------------------------------------------------
    # Step 1: Check for blocked data types
    # -----------------------------------------------------
    for data in data_required:
        if data in persona.get("blocked_data_types", []):
            blocked_data.append(data)

    # -----------------------------------------------------
    # Step 2: Check for substitution opportunities
    # Example: precise_location → city
    # -----------------------------------------------------
    for data in data_required:
        if data in persona.get("substitution_rules", {}):
            substituted_data.append({
                "original": data,
                "substitute": persona["substitution_rules"][data]
            })

    # -----------------------------------------------------
    # Step 3: Check confirmation-trigger data
    # Example: payment → ask user first in Balanced mode
    # -----------------------------------------------------
    for data in data_required:
        if data in persona.get("confirmation_triggers", []):
            confirmation_data.append(data)

    # -----------------------------------------------------
    # Step 4: Check third-party trust
    # -----------------------------------------------------
    trusted, trust_reason = is_third_party_trusted(third_party, persona_name)

    return {
        "blocked_data": blocked_data,
        "substitutions": substituted_data,
        "confirmation_data": confirmation_data,
        "third_party_trusted": trusted,
        "trust_reason": trust_reason
    }