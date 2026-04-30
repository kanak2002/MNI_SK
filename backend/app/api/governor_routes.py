from fastapi import APIRouter, HTTPException

from backend.app.models.schemas import GovernorRequest
from backend.app.core.governor import evaluate_task
from backend.app.core.receipt_generator import generate_receipt
from backend.app.core.audit_logger import (
    log_decision,
    get_audit_logs,
    clear_audit_logs
)

router = APIRouter(prefix="/governor", tags=["Governor"])


# ---------------------------------------------------------
# MAIN GOVERNOR ENDPOINT
# ---------------------------------------------------------
@router.post("/evaluate")
def evaluate_governor_request(request: GovernorRequest):
    """
    Entry point for the entire system.

    Flow:
    request → governor → receipt → audit log → response
    """

    try:
        # Convert Pydantic models to dict
        subtasks = [subtask.model_dump() for subtask in request.subtasks]

        # Run core decision engine
        task_result = evaluate_task(
            task=request.task,
            subtasks=subtasks,
            persona_name=request.persona
        )

        # Generate privacy receipt
        receipt = generate_receipt(task_result)

        # Attach receipt to response
        task_result["receipt"] = receipt

        # Log decision
        log_decision(task_result, receipt)

        return task_result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------
# AUDIT LOG ENDPOINTS
# ---------------------------------------------------------

@router.get("/audit-logs")
def read_audit_logs():
    return {
        "count": len(get_audit_logs()),
        "logs": get_audit_logs()
    }


@router.delete("/audit-logs")
def reset_audit_logs():
    return clear_audit_logs()