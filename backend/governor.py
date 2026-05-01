from backend.persona_engine import get_persona
from backend.privacy_classifier import classify_subtask
from backend.privacy_evaluator import PrivacyEvaluator

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
#
# New workflow added:
# data available -> complete
# safer substitute available -> complete alternative
# approval needed -> ask user
# no safe option -> stop and flag reason
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
    confirmation_data = classification["confirmation_data"]
    third_party_trusted = classification["third_party_trusted"]

    # -----------------------------------------------------
    # Rule 1: If blocked data has a safer substitute,
    # complete the action with safer alternative data.
    # Example: precise_location -> city
    # -----------------------------------------------------
    if blocked_data and substitutions:
        return {
            "action": action,
            "third_party": third_party,
            "data_required": data_required,
            "decision": "substitute",
            "workflow_stage": "alternative_available",
            "reason": "Sensitive data was requested, but a safer substitute is available.",
            "substitutions": substitutions,
            "blocked_data": blocked_data,
            "confirmation_needed": False,
            "execution_status": "complete_with_alternative"
        }

    # -----------------------------------------------------
    # Rule 2: If blocked data has no substitute,
    # stop the execution and flag the reason.
    # Example: SSN, full card number, biometric data
    # -----------------------------------------------------
    if blocked_data and not substitutions:
        return {
            "action": action,
            "third_party": third_party,
            "data_required": data_required,
            "decision": "block",
            "workflow_stage": "no_safe_option",
            "reason": f"This action requires blocked data for the {persona_name} persona: {blocked_data}.",
            "substitutions": [],
            "blocked_data": blocked_data,
            "confirmation_needed": False,
            "execution_status": "stopped"
        }

    # -----------------------------------------------------
    # Rule 3: If third party is not trusted, decide based
    # on persona mode instead of blocking everyone equally.
    # -----------------------------------------------------
    if not third_party_trusted:
        if persona_name == "conservative":
            return {
                "action": action,
                "third_party": third_party,
                "data_required": data_required,
                "decision": "block",
                "workflow_stage": "no_safe_option",
                "reason": f"{third_party} is blocked because it is not trusted for the {persona_name} persona.",
                "substitutions": [],
                "blocked_data": blocked_data,
                "confirmation_needed": False,
                "execution_status": "stopped"
            }

        if persona_name == "balanced":
            return {
                "action": action,
                "third_party": third_party,
                "data_required": data_required,
                "decision": "confirm",
                "workflow_stage": "ask_user",
                "reason": f"{third_party} is not on your trusted list, so confirmation is required.",
                "substitutions": [],
                "blocked_data": blocked_data,
                "confirmation_needed": True,
                "execution_status": "waiting_for_user"
            }

        if persona_name == "convenience_first":
            return {
                "action": action,
                "third_party": third_party,
                "data_required": data_required,
                "decision": "permit",
                "workflow_stage": "data_available",
                "reason": f"{third_party} is not trusted, but Convenience-First mode allows it with privacy logging.",
                "substitutions": [],
                "blocked_data": blocked_data,
                "confirmation_needed": False,
                "execution_status": "complete"
            }

    # -----------------------------------------------------
    # Rule 4: If action touches confirmation-trigger data,
    # ask the user before completing.
    # Example: payment, location sharing, identity verification
    # -----------------------------------------------------
    if confirmation_data:
        return {
            "action": action,
            "third_party": third_party,
            "data_required": data_required,
            "decision": "confirm",
            "workflow_stage": "ask_user",
            "reason": f"This action requires confirmation because it involves: {confirmation_data}.",
            "substitutions": [],
            "blocked_data": [],
            "confirmation_needed": True,
            "execution_status": "waiting_for_user"
        }

    # -----------------------------------------------------
    # Rule 5: Otherwise, data is available and allowed.
    # Complete execution.
    # -----------------------------------------------------
    return {
        "action": action,
        "third_party": third_party,
        "data_required": data_required,
        "decision": "permit",
        "workflow_stage": "data_available",
        "reason": f"This action is allowed under the {persona_name} persona.",
        "substitutions": [],
        "blocked_data": [],
        "confirmation_needed": False,
        "execution_status": "complete"
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

    substituted = any(
        decision["decision"] == "substitute" for decision in decisions
    )

    completed = any(
        decision["execution_status"] in ["complete", "complete_with_alternative"]
        for decision in decisions
    )

    # -----------------------------------------------------
    # Workflow summary for frontend and receipt rendering
    # -----------------------------------------------------
    if blocked:
        workflow_outcome = "stopped_with_reason"
    elif confirmation_required:
        workflow_outcome = "waiting_for_user"
    elif substituted:
        workflow_outcome = "completed_with_alternative"
    elif completed:
        workflow_outcome = "completed"
    else:
        workflow_outcome = "unknown"

    # Privacy audit — runs after every task, appended to result
    privacy_result = _privacy_eval.evaluate(
        task_id=task,
        user_input=task,
        model_output=" ".join(d.get("reason", "") for d in decisions),
    )

    return {
        "task": task,
        "persona": persona_name,
        "decisions": decisions,
        "confirmation_required": confirmation_required,
        "task_blocked": blocked,
        "task_substituted": substituted,
        "workflow_outcome": workflow_outcome,
        "privacy_audit": privacy_result.to_log_block()["privacy_audit"],
    }