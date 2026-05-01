# ---------------------------------------------------------
# Privacy Receipt Generator
# ---------------------------------------------------------
# Converts raw governor decisions into a clean summary that
# Dev B can show in chat and Dev C can render as a receipt card.
# ---------------------------------------------------------


def generate_receipt(task_result: dict):
    """
    Builds a privacy receipt from governor output.
    """

    task = task_result.get("task", "")
    persona = task_result.get("persona", "")
    decisions = task_result.get("decisions", [])
    workflow_outcome = task_result.get("workflow_outcome", "unknown")

    shared = []
    protected = []
    blocked = []
    substitutions = []
    confirmations = []
    stopped_reasons = []

    for decision in decisions:
        action = decision.get("action")
        third_party = decision.get("third_party")
        data_required = decision.get("data_required", [])
        decision_type = decision.get("decision")
        workflow_stage = decision.get("workflow_stage")
        execution_status = decision.get("execution_status")

        if decision_type == "permit":
            shared.append({
                "action": action,
                "third_party": third_party,
                "data": data_required,
                "workflow_stage": workflow_stage,
                "execution_status": execution_status
            })

        elif decision_type == "substitute":
            substitutions.append({
                "action": action,
                "third_party": third_party,
                "substitutions": decision.get("substitutions", []),
                "workflow_stage": workflow_stage,
                "execution_status": execution_status
            })

            for item in decision.get("blocked_data", []):
                protected.append(item)

        elif decision_type == "confirm":
            confirmations.append({
                "action": action,
                "third_party": third_party,
                "data": data_required,
                "reason": decision.get("reason"),
                "workflow_stage": workflow_stage,
                "execution_status": execution_status
            })

        elif decision_type == "block":
            blocked_item = {
                "action": action,
                "third_party": third_party,
                "reason": decision.get("reason"),
                "workflow_stage": workflow_stage,
                "execution_status": execution_status
            }

            blocked.append(blocked_item)
            stopped_reasons.append(decision.get("reason"))

            for item in decision.get("blocked_data", []):
                protected.append(item)

    return {
        "task": task,
        "persona": persona,
        "workflow_outcome": workflow_outcome,
        "summary": {
            "shared": shared,
            "protected": list(set(protected)),
            "blocked": blocked,
            "substitutions": substitutions,
            "confirmations": confirmations,
            "stopped_reasons": stopped_reasons
        },
        "plain_language_summary": build_plain_language_summary(
            shared,
            protected,
            blocked,
            substitutions,
            confirmations,
            workflow_outcome
        )
    }


def build_plain_language_summary(
    shared,
    protected,
    blocked,
    substitutions,
    confirmations,
    workflow_outcome
):
    """
    Creates a short readable summary for chatbot response.
    """

    lines = []

    lines.append("Privacy receipt generated.")

    if workflow_outcome == "completed":
        lines.append("Task was completed with available data.")

    if workflow_outcome == "completed_with_alternative":
        lines.append("Task was completed using safer alternative data.")

    if workflow_outcome == "waiting_for_user":
        lines.append("Task is waiting for user approval.")

    if workflow_outcome == "stopped_with_reason":
        lines.append("Task was stopped because no safe option was available.")

    if shared:
        lines.append(f"{len(shared)} action(s) were permitted.")

    if substitutions:
        lines.append(f"{len(substitutions)} action(s) used safer substitute data.")

    if confirmations:
        lines.append(f"{len(confirmations)} action(s) need user confirmation.")

    if blocked:
        lines.append(f"{len(blocked)} action(s) were blocked for privacy reasons.")

    if protected:
        unique_protected = list(set(protected))
        lines.append(f"Protected data: {', '.join(unique_protected)}.")

    return " ".join(lines)