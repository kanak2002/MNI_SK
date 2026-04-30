"""
governor.py — Mock Governor Engine (Dev B's stub until Dev A ships the real one)

When Dev A's real governor is ready, swap this file out entirely.
The interface (GovernorEngine.evaluate) stays the same — nothing else changes.
"""

import json
import re
from dataclasses import dataclass, field


# ---------- Data Models ----------

@dataclass
class SubtaskDecision:
    action: str
    data_required: list[str]
    third_party: str
    decision: str           # permit | substitute | confirm | block
    reason: str
    substitute_with: str | None = None


@dataclass
class GovernorResult:
    subtasks: list[SubtaskDecision]
    confirmation_required: bool
    confirmation_message: str | None
    blocked_count: int
    substituted_count: int


# ---------- Persona Rules ----------

PERSONA_RULES = {
    "conservative": {
        "blocked_data_types": [
            "precise_location", "behavioral_profile", "travel_history",
            "browsing_history", "full_ssn", "date_of_birth"
        ],
        "trusted_parties": [
            "delta", "marriott", "hilton", "google calendar",
            "outlook", "stripe", "chase"
        ],
        "confirmation_triggers": [
            "payment", "new_third_party", "location_sharing",
            "data_retention", "account_creation"
        ],
        "substitution_rules": {
            "precise_location": "city_only",
            "full_name": "first_name_only",
            "personal_email": "relay_email",
        },
        "retention_policy": "delete_after_task",
    },
    "balanced": {
        "blocked_data_types": [
            "behavioral_profile", "browsing_history", "full_ssn"
        ],
        "trusted_parties": [
            "delta", "united", "marriott", "hilton", "hotels.com",
            "google flights", "google calendar", "outlook",
            "stripe", "chase", "amazon"
        ],
        "confirmation_triggers": [
            "payment", "location_sharing", "account_creation"
        ],
        "substitution_rules": {},
        "retention_policy": "retain_booking_reference",
    },
    "convenience_first": {
        "blocked_data_types": ["full_ssn"],
        "trusted_parties": [],          # empty = trust everyone
        "confirmation_triggers": [],    # empty = never confirm
        "substitution_rules": {},
        "retention_policy": "retain_full_history",
    },
}


# ---------- Third-Party Trust Database (Dev B's mock of Dev A's DB) ----------

THIRD_PARTY_DB = {
    "delta":          {"risk": "low",    "ad_partners": False, "incidents": []},
    "united":         {"risk": "low",    "ad_partners": False, "incidents": []},
    "southwest":      {"risk": "low",    "ad_partners": False, "incidents": []},
    "marriott":       {"risk": "low",    "ad_partners": False, "incidents": []},
    "hilton":         {"risk": "low",    "ad_partners": False, "incidents": []},
    "hotels.com":     {"risk": "high",   "ad_partners": True,  "incidents": ["data sharing 2022"]},
    "booking.com":    {"risk": "medium", "ad_partners": True,  "incidents": []},
    "expedia":        {"risk": "medium", "ad_partners": True,  "incidents": []},
    "kayak":          {"risk": "high",   "ad_partners": True,  "incidents": ["data broker partnership"]},
    "google flights": {"risk": "medium", "ad_partners": False, "incidents": []},
    "google calendar":{"risk": "low",    "ad_partners": False, "incidents": []},
    "amazon":         {"risk": "medium", "ad_partners": True,  "incidents": []},
    "hirevue":        {"risk": "high",   "ad_partners": True,  "incidents": ["FTC scrutiny 2023"]},
    "stripe":         {"risk": "low",    "ad_partners": False, "incidents": []},
    "chase":          {"risk": "low",    "ad_partners": False, "incidents": []},
}


# ---------- Sensitive Data Patterns ----------

SENSITIVE_DATA_KEYWORDS = {
    "precise_location":  ["gps", "coordinates", "exact address", "precise location", "current location", "workplace", "frequent stops"],
    "behavioral_profile":["behavior", "browsing", "preferences profile", "ad profile", "tracking", "traits", "sexual orientattion"],
    "travel_history":    ["past trips", "travel history", "previous bookings", "visa status", "passport number", "immigration", "flight details"],
    "payment":           ["credit card", "payment", "card number", "billing", "charge", "CVV", "pin", "purchase history"],
    "full_name":         ["full name", "complete name", "legal name"],
    "personal_email":    ["personal email", "home email", "recovery email"],
    "account_creation":  ["create account", "sign up", "register", "password"],
    "data_retention":    ["save data", "store information", "keep history"],
}


# ---------- Governor Engine ----------

class GovernorEngine:
    """
    Mock governor that enforces persona rules.
    Replace with Dev A's real implementation when ready —
    the evaluate() signature does not change.
    """

    def evaluate(self, task: str, persona: str) -> GovernorResult:
        rules = PERSONA_RULES.get(persona, PERSONA_RULES["balanced"])
        subtasks = self._decompose_task(task, persona, rules)

        confirmation_required = any(
            s.decision == "confirm" for s in subtasks
        )
        blocked = [s for s in subtasks if s.decision == "block"]
        substituted = [s for s in subtasks if s.decision == "substitute"]

        confirmation_message = None
        if confirmation_required:
            confirm_subtask = next(s for s in subtasks if s.decision == "confirm")
            confirmation_message = self._build_confirmation_message(
                confirm_subtask, rules
            )

        return GovernorResult(
            subtasks=subtasks,
            confirmation_required=confirmation_required,
            confirmation_message=confirmation_message,
            blocked_count=len(blocked),
            substituted_count=len(substituted),
        )

    def _decompose_task(
        self, task: str, persona: str, rules: dict
    ) -> list[SubtaskDecision]:
        task_lower = task.lower()
        subtasks = []

        # --- Search / lookup subtask ---
        if any(kw in task_lower for kw in ["find", "search", "look", "book", "get", "buy", "schedule"]):
            third_party = self._detect_third_party(task_lower, rules)
            trust = THIRD_PARTY_DB.get(third_party, {"risk": "unknown", "ad_partners": False})

            if trust["risk"] == "high" and self._is_untrusted(third_party, rules):
                alt = self._find_alternative(third_party, rules)
                subtasks.append(SubtaskDecision(
                    action=f"Search via {third_party.title()}",
                    data_required=["destination", "dates", "budget"],
                    third_party=third_party.title(),
                    decision="block",
                    reason=f"{third_party.title()} shares data with advertising partners",
                    substitute_with=alt,
                ))
            else:
                subtasks.append(SubtaskDecision(
                    action=f"Search via {third_party.title()}",
                    data_required=["destination", "dates", "budget"],
                    third_party=third_party.title(),
                    decision="permit",
                    reason="Trusted party, minimal data required",
                ))

        # --- Location subtask ---
        if any(kw in task_lower for kw in ["near", "nearby", "location", "around me", "close to"]):
            if "precise_location" in rules["blocked_data_types"]:
                subtasks.append(SubtaskDecision(
                    action="Share location for search",
                    data_required=["precise_location"],
                    third_party="Search Service",
                    decision="substitute",
                    reason="Precise location blocked by your persona",
                    substitute_with="city_only",
                ))
            elif "location_sharing" in rules["confirmation_triggers"]:
                subtasks.append(SubtaskDecision(
                    action="Share location for search",
                    data_required=["precise_location"],
                    third_party="Search Service",
                    decision="confirm",
                    reason="Location sharing requires your approval",
                ))

        # --- Payment subtask ---
        if any(kw in task_lower for kw in ["book", "buy", "purchase", "order", "pay", "reserve"]):
            if "payment" in rules["confirmation_triggers"]:
                subtasks.append(SubtaskDecision(
                    action="Process payment",
                    data_required=["payment_method", "billing_details"],
                    third_party="Payment Processor",
                    decision="confirm",
                    reason="Payment requires your explicit approval",
                ))
            else:
                subtasks.append(SubtaskDecision(
                    action="Process payment",
                    data_required=["payment_method"],
                    third_party="Payment Processor",
                    decision="permit",
                    reason="Auto-payment enabled in your persona",
                ))

        # --- Behavioral profile subtask ---
        if any(kw in task_lower for kw in ["recommend", "suggestion", "personali", "based on my"]):
            if "behavioral_profile" in rules["blocked_data_types"]:
                subtasks.append(SubtaskDecision(
                    action="Access behavioral profile for personalization",
                    data_required=["behavioral_profile", "travel_history"],
                    third_party="Personalization Service",
                    decision="block",
                    reason="Behavioral profiling blocked by your persona",
                ))

        # --- Data retention subtask ---
        if any(kw in task_lower for kw in ["save", "remember", "store", "keep"]):
            if "data_retention" in rules["confirmation_triggers"]:
                subtasks.append(SubtaskDecision(
                    action="Save task data for future use",
                    data_required=["task_history"],
                    third_party="Internal Storage",
                    decision="confirm",
                    reason="Data retention requires your approval",
                ))

        # Fallback — generic permitted subtask
        if not subtasks:
            subtasks.append(SubtaskDecision(
                action="Process your request",
                data_required=["query_text"],
                third_party="Internal",
                decision="permit",
                reason="No sensitive data required",
            ))

        return subtasks

    def _detect_third_party(self, task: str, rules: dict) -> str:
        for party in THIRD_PARTY_DB:
            if party in task:
                return party
        # Infer from task type
        if any(kw in task for kw in ["flight", "fly", "airline"]):
            trusted = [p for p in ["delta", "united", "southwest"]
                       if p in rules.get("trusted_parties", [])]
            return trusted[0] if trusted else "kayak"
        if any(kw in task for kw in ["hotel", "stay", "room", "accommodation"]):
            trusted = [p for p in ["marriott", "hilton"]
                       if p in rules.get("trusted_parties", [])]
            return trusted[0] if trusted else "hotels.com"
        if any(kw in task for kw in ["schedule", "meeting", "calendar", "appointment"]):
            return "google calendar"
        return "google flights"

    def _is_untrusted(self, third_party: str, rules: dict) -> bool:
        trusted = rules.get("trusted_parties", [])
        if not trusted:   # convenience_first trusts everyone
            return False
        return third_party.lower() not in [t.lower() for t in trusted]

    def _find_alternative(self, blocked_party: str, rules: dict) -> str | None:
        trusted = rules.get("trusted_parties", [])
        alternatives = {
            "kayak":      ["google flights", "delta"],
            "hotels.com": ["marriott", "hilton"],
            "expedia":    ["marriott", "delta"],
            "booking.com":["marriott", "hilton"],
        }
        for alt in alternatives.get(blocked_party, []):
            if alt in trusted:
                return alt.title()
        return trusted[0].title() if trusted else None

    def _build_confirmation_message(
        self, subtask: SubtaskDecision, rules: dict
    ) -> str:
        third_party = subtask.third_party
        trust_info = THIRD_PARTY_DB.get(third_party.lower(), {})
        trusted = third_party.lower() in [
            t.lower() for t in rules.get("trusted_parties", [])
        ]
        trust_label = "✓ on your trusted list" if trusted else "⚠ not on your trusted list"

        return (
            f"This requires sharing your {', '.join(subtask.data_required)} "
            f"with {third_party} ({trust_label}). "
            f"Would you like to proceed?"
        )

    def build_receipt(
        self, subtasks: list[SubtaskDecision], persona: str
    ) -> dict:
        rules = PERSONA_RULES.get(persona, {})
        shared, protected, blocked = [], [], []

        for s in subtasks:
            if s.decision == "permit":
                shared.append({
                    "action": s.action,
                    "with": s.third_party,
                    "data": s.data_required,
                })
            elif s.decision == "substitute":
                protected.append({
                    "original": s.data_required,
                    "used_instead": s.substitute_with,
                    "reason": s.reason,
                })
            elif s.decision == "block":
                blocked.append({
                    "service": s.third_party,
                    "reason": s.reason,
                    "alternative": s.substitute_with,
                })

        return {
            "shared": shared,
            "protected": protected,
            "blocked": blocked,
            "retention": rules.get("retention_policy", "unknown"),
        }
