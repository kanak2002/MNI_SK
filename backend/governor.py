from backend.persona_engine import get_persona
from backend.privacy_classifier import classify_subtask
from backend.privacy_evaluator import PrivacyEvaluator, append_privacy_audit_to_log

_privacy_eval = PrivacyEvaluator(strict=True)


# ---------------------------------------------------------
# PersonaGuard Governor Engine
# ---------------------------------------------------------
# This file is the main privacy decision brain.
#
# It receives:
# - active persona
# - user task
# - list of subtasks
#
# It returns:
# - permit
# - substitute
# - confirm
# - block
# ---------------------------------------------------------


def evaluate_subtask(subtask: dict, persona_name: str):
    """
    Evaluates one subtask and returns the final governor decision.
    """

    persona = get_persona(persona_name)
    classification = classify_subtask(subtask, persona_name)

    action = subtask.get("action", "unknown action")
    third_party = subtask.get("third_party", "unknown third party")
    data_required = subtask.get("data_required", [])

    blocked_data = classification["blocked_data"]
    substitutions = classification["substitutions"]
    third_party_trusted = classification["third_party_trusted"]

    # -----------------------------------------------------
    # Rule 1: If third party is not trusted, block the action
    # -----------------------------------------------------
    if not third_party_trusted:
        return {
            "action": action,
            "third_party": third_party,
            "data_required": data_required,
            "decision": "block",
            "reason": f"{third_party} is blocked because it is not trusted for the {persona_name} persona.",
            "substitutions": [],
            "blocked_data": blocked_data,
            "confirmation_needed": False
        }

    # -----------------------------------------------------
    # Rule 2: If blocked data has a safer substitute, substitute
    # Example: precise_location -> city
    # -----------------------------------------------------
    if blocked_data and substitutions:
        return {
            "action": action,
            "third_party": third_party,
            "data_required": data_required,
            "decision": "substitute",
            "reason": "Sensitive data was requested, but a safer substitute is available.",
            "substitutions": substitutions,
            "blocked_data": blocked_data,
            "confirmation_needed": False
        }

    # -----------------------------------------------------
    # Rule 3: If blocked data has no substitute, block
    # Example: SSN, full card number
    # -----------------------------------------------------
    if blocked_data and not substitutions:
        return {
            "action": action,
            "third_party": third_party,
            "data_required": data_required,
            "decision": "block",
            "reason": f"This action requires blocked data for the {persona_name} persona: {blocked_data}.",
            "substitutions": [],
            "blocked_data": blocked_data,
            "confirmation_needed": False
        }

    # -----------------------------------------------------
    # Rule 4: If action touches a confirmation trigger, ask user
    # Example: payment, location sharing, health information
    # -----------------------------------------------------
    for data in data_required:
        if data in persona["confirmation_triggers"]:
            return {
                "action": action,
                "third_party": third_party,
                "data_required": data_required,
                "decision": "confirm",
                "reason": f"This action requires confirmation because it involves: {data}.",
                "substitutions": [],
                "blocked_data": [],
                "confirmation_needed": True
            }

    # -----------------------------------------------------
    # Rule 5: Otherwise, permit
    # -----------------------------------------------------
    return {
        "action": action,
        "third_party": third_party,
        "data_required": data_required,
        "decision": "permit",
        "reason": f"This action is allowed under the {persona_name} persona.",
        "substitutions": [],
        "blocked_data": [],
        "confirmation_needed": False
    }


def evaluate_task(task: str, subtasks: list, persona_name: str):
    """
    Evaluates the full user task by checking every subtask.
    """

    decisions = []

    for subtask in subtasks:
        decision = evaluate_subtask(subtask, persona_name)
        decisions.append(decision)

    confirmation_required = any(
        decision["decision"] == "confirm" for decision in decisions
    )

    blocked = any(
        decision["decision"] == "block" for decision in decisions
    )

    # Privacy audit — runs after every task, appended to result
    privacy_result = _privacy_eval.evaluate(
        task_id=task,
        user_input=task,
        model_output=" ".join(d.get("reasoning", "") for d in decisions),
    )

    return {
        "task": task,
        "persona": persona_name,
        "decisions": decisions,
        "confirmation_required": confirmation_required,
        "task_blocked": blocked,
        "privacy_audit": privacy_result.to_log_block()["privacy_audit"],
    }