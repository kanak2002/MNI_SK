from datetime import datetime


# ---------------------------------------------------------
# Simple Audit Logger
# ---------------------------------------------------------
# Hackathon-friendly version:
# - stores logs in memory while backend is running
# - easy to replace with SQLite later
#
# Purpose:
# keep a record of what the governor decided and why.
# ---------------------------------------------------------


AUDIT_LOGS = []


def log_decision(task_result: dict, receipt: dict = None):
    """
    Stores one full governor evaluation in the audit log.
    """

    log_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "task": task_result.get("task"),
        "persona": task_result.get("persona"),
        "decisions": task_result.get("decisions", []),
        "confirmation_required": task_result.get("confirmation_required", False),
        "task_blocked": task_result.get("task_blocked", False),
        "receipt": receipt
    }

    AUDIT_LOGS.append(log_entry)

    return log_entry


def get_audit_logs():
    """
    Returns all audit logs from current backend session.
    """

    return AUDIT_LOGS


def clear_audit_logs():
    """
    Clears audit logs.
    Useful during testing/demo reset.
    """

    AUDIT_LOGS.clear()

    return {
        "message": "Audit logs cleared"
    }