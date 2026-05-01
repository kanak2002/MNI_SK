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

    shared = []
    protected = []
    blocked = []
    substitutions = []
    confirmations = []

    for decision in decisions:
        action = decision.get("action")
        third_party = decision.get("third_party")
        data_required = decision.get("data_required", [])
        decision_type = decision.get("decision")

        if decision_type == "permit":
            shared.append({
                "action": action,
                "third_party": third_party,
                "data": data_required
            })

        elif decision_type == "substitute":
            substitutions.append({
                "action": action,
                "third_party": third_party,
                "substitutions": decision.get("substitutions", [])
            })

            for item in decision.get("blocked_data", []):
                protected.append(item)

        elif decision_type == "confirm":
            confirmations.append({
                "action": action,
                "third_party": third_party,
                "data": data_required,
                "reason": decision.get("reason")
            })

        elif decision_type == "block":
            blocked.append({
                "action": action,
                "third_party": third_party,
                "reason": decision.get("reason")
            })

            for item in decision.get("blocked_data", []):
                protected.append(item)

    return {
        "task": task,
        "persona": persona,
        "summary": {
            "shared": shared,
            "protected": list(set(protected)),
            "blocked": blocked,
            "substitutions": substitutions,
            "confirmations": confirmations
        },
        "plain_language_summary": build_plain_language_summary(
            shared,
            protected,
            blocked,
            substitutions,
            confirmations
        )
    }


def build_plain_language_summary(shared, protected, blocked, substitutions, confirmations):
    """
    Creates a short readable summary for chatbot response.
    """

    lines = []

    lines.append("Privacy receipt generated.")

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