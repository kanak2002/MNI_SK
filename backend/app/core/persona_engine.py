import json
import os

# Get absolute path to data folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONA_FILE = os.path.join(BASE_DIR, "data", "personas.json")


def load_personas():
    """
    Load all persona definitions from JSON file
    """
    try:
        with open(PERSONA_FILE, "r") as f:
            personas = json.load(f)
        return personas
    except Exception as e:
        raise Exception(f"Error loading personas: {str(e)}")


def get_persona(persona_name: str):
    """
    Retrieve a specific persona by name
    """
    personas = load_personas()

    if persona_name not in personas:
        raise ValueError(f"Invalid persona: {persona_name}")

    return personas[persona_name]


def list_personas():
    """
    Return all available persona names
    """
    personas = load_personas()
    return list(personas.keys())