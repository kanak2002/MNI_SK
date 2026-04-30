from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel


# ---------------------------------------------------------
# Shared API Schemas for PersonaGuard
# ---------------------------------------------------------
# These models define the JSON format exchanged between:
# - Frontend
# - LLM conversation layer
# - Governor engine
#
# Dev B and Dev C can use this file as the API contract.
# ---------------------------------------------------------


PersonaType = Literal["conservative", "balanced", "convenience_first"]
DecisionType = Literal["permit", "substitute", "confirm", "block"]


class Subtask(BaseModel):
    """
    One small action extracted from a larger user task.
    Example:
    "Search hotels using Hotels.com"
    """

    action: str
    data_required: List[str]
    third_party: str


class GovernorRequest(BaseModel):
    """
    Request sent to the governor endpoint.
    """

    task: str
    persona: PersonaType
    subtasks: List[Subtask]


class Decision(BaseModel):
    """
    One governor decision for one subtask.
    """

    action: str
    third_party: str
    data_required: List[str]
    decision: DecisionType
    reason: str
    substitutions: List[Dict[str, Any]] = []
    blocked_data: List[str] = []
    confirmation_needed: bool = False


class ReceiptSummary(BaseModel):
    """
    Structured privacy receipt summary.
    """

    shared: List[Dict[str, Any]] = []
    protected: List[str] = []
    blocked: List[Dict[str, Any]] = []
    substitutions: List[Dict[str, Any]] = []
    confirmations: List[Dict[str, Any]] = []


class PrivacyReceipt(BaseModel):
    """
    Final receipt object shown to the user after evaluation.
    """

    task: str
    persona: PersonaType
    summary: ReceiptSummary
    plain_language_summary: str


class GovernorResponse(BaseModel):
    """
    Final response returned by /governor/evaluate.
    """

    task: str
    persona: PersonaType
    decisions: List[Decision]
    confirmation_required: bool
    task_blocked: bool
    receipt: Optional[PrivacyReceipt] = None