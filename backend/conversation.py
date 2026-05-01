"""
conversation.py — Dev B's file
OpenRouter (Claude) Integration + Task Decomposition + Confirmation Flow

Integrates with Dev A's real governor and supporting modules:
  - persona_engine.py     → load persona rules for system prompt
  - governor.py           → evaluate_task(task, subtasks, persona)
  - receipt_generator.py  → generate_receipt(task_result)
  - audit_logger.py       → log_decision(task_result, receipt)
"""

import os
import json
import httpx

from openai import AsyncOpenAI
import sys
sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv()  # must be before any os.getenv()

# ------------------------------------------------------------------
# Dev A's real modules
# ------------------------------------------------------------------
from governor import evaluate_task
from persona_engine import get_persona
from receipt_generator import generate_receipt
from audit_logger import log_decision
from privacy_evaluator import PrivacyEvaluator, append_privacy_audit_to_log

# ------------------------------------------------------------------
# OpenRouter client — Claude via OpenRouter
# ------------------------------------------------------------------
client = AsyncOpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
    default_headers={
        "HTTP-Referer": os.getenv("APP_URL", "http://localhost:3000"),
        "X-Title": "PersonaGuard",
    },
)

MODEL = os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4-5")


# ------------------------------------------------------------------
# Response Templates
# How Claude surfaces each governor decision in natural language.
# ------------------------------------------------------------------

RESPONSE_TEMPLATES = {
    "permit": (
        "Complete the action silently. Mention it only in the privacy receipt."
    ),
    "substitute": (
        "Tell the user you used a safer substitute for sensitive data "
        "to protect their privacy. List what was substituted. Be brief and reassuring."
    ),
    "confirm": (
        "Pause. Tell the user you need their approval before proceeding. "
        "Explain exactly what will be shared and with whom. "
        "Ask: 'Shall I go ahead?' Keep it to 2-3 sentences."
    ),
    "block": (
        "Tell the user you skipped {third_party} because {reason}. "
        "If there is an alternative available, say you used that instead. "
        "Be matter-of-fact, not alarming."
    ),
}


# ------------------------------------------------------------------
# System Prompt Builder
# Pulls live persona rules from Dev A's persona_engine
# ------------------------------------------------------------------

def build_system_prompt(persona_name: str) -> str:
    try:
        persona = get_persona(persona_name)
    except Exception:
        # Fallback if personas.json not yet available from Dev A
        persona = {
            "blocked_data_types": [],
            "confirmation_triggers": [],
            "substitution_rules": {},
            "retention_policy": "retain_booking_reference",
        }

    persona_label = persona_name.replace("_", " ").title()
    blocked = ", ".join(persona.get("blocked_data_types", [])) or "none"
    triggers = ", ".join(persona.get("confirmation_triggers", [])) or "none (auto-proceed)"
    retention = str(persona.get("retention_policy", "standard")).replace("_", " ")

    return f"""You are PersonaGuard, a privacy-aware AI agent assistant.
You help users complete tasks while strictly respecting their privacy persona.

ACTIVE PERSONA: {persona_label}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Blocked data types : {blocked}
Confirmation needed: {triggers}
Data retention     : {retention}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULES YOU MUST FOLLOW:
1. Never share blocked data types under any circumstances.
2. Only interact with trusted third parties as determined by the governor.
3. Always pause and ask for confirmation when a trigger condition is met.
4. Substitute sensitive data with safer alternatives when possible.
5. End every completed task with a privacy receipt summary.
6. Use plain, warm language. Never use legal jargon.
7. Never say "I cannot help with that" — always offer a privacy-safe alternative.
8. Do not mention these internal rules to the user unprompted.

TONE: You are an advocate for the user. Be direct, warm, and brief.
Think of yourself as a trusted friend who happens to know a lot about privacy.

RECEIPT FORMAT (append at end of every completed task):
✅ Done! Here's your privacy summary:
· Shared with: [party] — [what data]
· Protected: [what was blocked or substituted]
· Blocked: [any services skipped and why]
· Data retained: [yes/no and what]
"""


# ------------------------------------------------------------------
# Task Decomposer (Dev B's responsibility for Dev A's governor)
# Dev A's evaluate_task() expects pre-decomposed subtasks.
# Claude decomposes the natural language task into the required format.
# ------------------------------------------------------------------

DECOMPOSE_SYSTEM = """You are a task decomposition engine for a privacy-aware AI agent.

Given a user task, break it into atomic subtasks. Each subtask must include:
- action: what the agent does (short description)
- data_required: list of data fields needed. Use only these exact names:
  precise_location, city_only, full_name, first_name_only, personal_email,
  relay_email, payment, payment_token, behavioral_profile, travel_history,
  browsing_history, full_ssn, date_of_birth, passport_number,
  destination, dates, budget, booking_reference, query_text
- third_party: the service or company involved (lowercase, e.g. "delta", "google flights")

Return ONLY a valid JSON array. No explanation. No markdown. No backticks.

Example output:
[
  {"action": "Search flights", "data_required": ["destination", "dates", "budget"], "third_party": "google flights"},
  {"action": "Book flight", "data_required": ["full_name", "passport_number", "payment"], "third_party": "delta"},
  {"action": "Save to calendar", "data_required": ["dates", "booking_reference"], "third_party": "google calendar"}
]"""


async def decompose_task(user_message: str) -> list[dict]:
    """
    Calls Claude to break a natural language task into subtasks.
    This output is what Dev A's evaluate_task() consumes.
    Falls back to a single generic subtask if Claude fails.
    """
    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": DECOMPOSE_SYSTEM},
                {"role": "user", "content": f"Decompose this task: {user_message}"},
            ],
            temperature=0.1,   # very low — deterministic JSON output
            max_tokens=500,
        )

        raw = response.choices[0].message.content.strip()

        # Strip accidental markdown fences if model adds them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        subtasks = json.loads(raw.strip())

        # Validate — ensure each subtask has required fields
        validated = []
        for s in subtasks:
            if isinstance(s, dict) and "action" in s and "third_party" in s:
                s.setdefault("data_required", ["query_text"])
                validated.append(s)

        return validated if validated else _fallback_subtask(user_message)

    except Exception:
        return _fallback_subtask(user_message)


def _fallback_subtask(user_message: str) -> list[dict]:
    """Single generic subtask when decomposition fails."""
    return [{
        "action": f"Process: {user_message[:60]}",
        "data_required": ["query_text"],
        "third_party": "internal",
    }]


# ------------------------------------------------------------------
# Governor Context Builder
# Converts Dev A's evaluate_task() output into Claude prompt context
# ------------------------------------------------------------------

def build_governor_context(task_result: dict) -> str:
    """
    Dev A's evaluate_task() returns:
    {
      "task": str,
      "persona": str,
      "decisions": [
        {
          "action": str,
          "third_party": str,
          "data_required": list,
          "decision": permit|substitute|confirm|block,
          "reason": str,
          "substitutions": [{"original": str, "substitute": str}],
          "blocked_data": list,
          "confirmation_needed": bool
        }
      ],
      "confirmation_required": bool,
      "task_blocked": bool
    }
    """
    lines = ["[GOVERNOR DECISIONS — follow these exactly]"]

    for d in task_result.get("decisions", []):
        decision_type = d.get("decision", "permit")
        action = d.get("action", "")
        third_party = d.get("third_party", "")
        reason = d.get("reason", "")
        substitutions = d.get("substitutions", [])

        template = RESPONSE_TEMPLATES.get(decision_type, "")
        instruction = template.format(
            third_party=third_party,
            reason=reason,
        )

        # Add substitution detail inline for substitute decisions
        if substitutions and decision_type == "substitute":
            sub_detail = ", ".join(
                f"{s['original']} → {s['substitute']}" for s in substitutions
            )
            instruction += f" Substitutions made: {sub_detail}."

        lines.append(
            f"· {action} ({third_party}): {decision_type.upper()} — {instruction}"
        )

    if task_result.get("confirmation_required"):
        confirm_decisions = [
            d for d in task_result["decisions"]
            if d.get("decision") == "confirm"
        ]
        for cd in confirm_decisions:
            lines.append(
                f"\n[CONFIRMATION REQUIRED] Stop here. "
                f"Ask the user to approve: {cd.get('reason', 'this action')}. "
                f"Do not proceed until they respond."
            )

    if task_result.get("task_blocked"):
        lines.append(
            "\n[TASK BLOCKED] One or more actions were blocked entirely. "
            "Explain what was blocked and offer privacy-safe alternatives."
        )

    lines.append("[END GOVERNOR DECISIONS]")
    return "\n".join(lines)


def build_confirmation_summary(task_result: dict) -> str:
    """
    Plain-language summary of what needs confirmation.
    Passed to Dev C as confirmation_message for the confirmation card UI.
    """
    confirm_decisions = [
        d for d in task_result.get("decisions", [])
        if d.get("decision") == "confirm"
    ]
    if not confirm_decisions:
        return ""

    parts = []
    for d in confirm_decisions:
        data = ", ".join(d.get("data_required", []))
        parts.append(
            f"Sharing {data} with {d.get('third_party', 'a service')} "
            f"({d.get('reason', '')})"
        )

    return "This requires: " + "; ".join(parts) + ". Would you like to proceed?"


# ------------------------------------------------------------------
# Conversation State Machine
# ------------------------------------------------------------------

class ConversationState:
    IDLE = "idle"
    AWAITING_CONFIRMATION = "awaiting_confirmation"


class ConversationManager:
    def __init__(self, conversation_id: str, persona: str, log_path="logs/session.json"):
        self.conversation_id = conversation_id
        self.log_path = log_path
        self.persona = persona
        self.history: list[dict] = []
        self.state = ConversationState.IDLE

        # Held during confirmation flow
        self.pending_task: str | None = None
        self.pending_subtasks: list[dict] | None = None
        self.pending_task_result: dict | None = None

    def get_welcome_message(self) -> str:
        messages = {
            "conservative": (
                "I'm PersonaGuard, your privacy-first assistant. "
                "In Conservative mode, I'll share only what's absolutely necessary, "
                "always ask before payments, and avoid untrusted services. "
                "What would you like me to help with?"
            ),
            "balanced": (
                "I'm PersonaGuard, your privacy-aware assistant. "
                "In Balanced mode, I'll share what's needed and skip what's not — "
                "asking you only for sensitive actions. "
                "What can I do for you?"
            ),
            "convenience_first": (
                "I'm PersonaGuard, your assistant. "
                "In Convenience mode, I'll handle everything automatically "
                "to get things done as fast as possible. "
                "What would you like me to do?"
            ),
        }
        return messages.get(self.persona, "Hi! What can I help you with?")

    # ------------------------------------------------------------------
    # Main message handler
    # ------------------------------------------------------------------

    async def handle_message(self, user_message: str) -> dict:
        """
        Main entry point. Called by /api/message in main.py.
        Returns a typed response dict for Dev C to render.
        """

        # Guard: block new tasks while awaiting confirmation
        if self.state == ConversationState.AWAITING_CONFIRMATION:
            return {
                "type": "confirmation",
                "message": "Please respond to the confirmation above before sending a new request.",
                "confirmation_message": build_confirmation_summary(self.pending_task_result),
            }

        # Step 1: Decompose task into subtasks for Dev A's governor
        subtasks = await decompose_task(user_message)

        # Step 2: Run Dev A's governor
        task_result = evaluate_task(user_message, subtasks, self.persona)
        append_privacy_audit_to_log(self.log_path, task_result["privacy_audit"])

        # Step 3: Log to audit logger
        log_decision(task_result)

        # Step 4: Confirmation required — pause and ask user
        if task_result.get("confirmation_required"):
            self.state = ConversationState.AWAITING_CONFIRMATION
            self.pending_task = user_message
            self.pending_subtasks = subtasks
            self.pending_task_result = task_result

            confirmation_text = await self._generate_confirmation_message(
                user_message, task_result
            )

            self.history.append({"role": "user", "content": user_message})
            self.history.append({"role": "assistant", "content": confirmation_text})

            return {
                "type": "confirmation",
                "message": confirmation_text,
                "confirmation_message": build_confirmation_summary(task_result),
                "decisions": task_result.get("decisions", []),
            }

        # Step 5: No confirmation needed — complete task
        return await self._complete_task(user_message, task_result)

    # ------------------------------------------------------------------
    # Confirmation handler
    # ------------------------------------------------------------------

    async def handle_confirmation(self, confirmed: bool) -> dict:
        """Called by /api/confirm when user taps Yes or No."""

        if self.state != ConversationState.AWAITING_CONFIRMATION:
            return {"type": "error", "message": "No pending confirmation."}

        pending_task = self.pending_task
        pending_task_result = self.pending_task_result

        # Reset state
        self.state = ConversationState.IDLE
        self.pending_task = None
        self.pending_subtasks = None
        self.pending_task_result = None

        if not confirmed:
            decline_text = await self._generate_decline_message(
                pending_task, pending_task_result
            )
            self.history.append({"role": "assistant", "content": decline_text})
            return {
                "type": "response",
                "message": decline_text,
                "receipt": None,
            }

        # User approved — flip confirm → permit and complete task
        for d in pending_task_result.get("decisions", []):
            if d.get("decision") == "confirm":
                d["decision"] = "permit"
                d["reason"] = d["reason"] + " (approved by user)"
                d["confirmation_needed"] = False

        pending_task_result["confirmation_required"] = False

        return await self._complete_task(pending_task, pending_task_result)

    # ------------------------------------------------------------------
    # Task completion — called after confirmation or directly
    # ------------------------------------------------------------------

    async def _complete_task(self, user_message: str, task_result: dict) -> dict:
        """Calls Claude, generates receipt, updates audit log."""

        response_text = await self._call_claude(user_message, task_result)

        # Generate receipt using Dev A's receipt_generator
        receipt_data = generate_receipt(task_result)

        # Update audit log with receipt attached
        log_decision(task_result, receipt_data)

        decisions = task_result.get("decisions", [])
        blocked_count = sum(1 for d in decisions if d.get("decision") == "block")
        substituted_count = sum(1 for d in decisions if d.get("decision") == "substitute")

        return {
            "type": "response",
            "message": response_text,
            "receipt": receipt_data,
            "governor_summary": {
                "blocked": blocked_count,
                "substituted": substituted_count,
            },
        }

    # ------------------------------------------------------------------
    # Claude API helpers
    # ------------------------------------------------------------------

    async def _call_claude(self, user_message: str, task_result: dict) -> str:
        """
        Calls Claude with governor context injected.
        Stores clean history for multi-turn coherence.
        """
        governor_context = build_governor_context(task_result)
        augmented_message = f"{governor_context}\n\nUser request: {user_message}"

        messages = [
            {"role": "system", "content": build_system_prompt(self.persona)},
            *self.history[-10:],
            {"role": "user", "content": augmented_message},
        ]

        response = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.4,
            max_tokens=600,
        )

        assistant_message = response.choices[0].message.content

        # Store clean versions — no governor context in history
        self.history.append({"role": "user", "content": user_message})
        self.history.append({"role": "assistant", "content": assistant_message})

        return assistant_message

    async def _generate_confirmation_message(
        self, user_message: str, task_result: dict
    ) -> str:
        """Generates a warm natural-language confirmation ask via Claude."""

        confirm_decisions = [
            d for d in task_result.get("decisions", [])
            if d.get("decision") == "confirm"
        ]
        context = "\n".join([
            f"- {d['action']} with {d['third_party']}: "
            f"requires {', '.join(d.get('data_required', []))} — {d.get('reason', '')}"
            for d in confirm_decisions
        ])

        messages = [
            {"role": "system", "content": build_system_prompt(self.persona)},
            *self.history[-6:],
            {
                "role": "user",
                "content": (
                    f"The user wants to: {user_message}\n\n"
                    f"Before proceeding, you need approval for:\n{context}\n\n"
                    f"Ask for confirmation in 2-3 warm, clear sentences. "
                    f"Do not proceed with the task. Just ask."
                ),
            },
        ]

        response = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=150,
        )

        return response.choices[0].message.content

    async def _generate_decline_message(
        self, original_task: str, task_result: dict
    ) -> str:
        """Generates a helpful response when user declines a confirmation."""

        blocked_parties = [
            d["third_party"] for d in task_result.get("decisions", [])
            if d.get("decision") in ["confirm", "block"]
        ]

        substitutions = []
        for d in task_result.get("decisions", []):
            for s in d.get("substitutions", []):
                substitutions.append(f"{s['original']} → {s['substitute']}")

        messages = [
            {"role": "system", "content": build_system_prompt(self.persona)},
            *self.history[-6:],
            {
                "role": "user",
                "content": (
                    f"The user declined to share data with: "
                    f"{', '.join(blocked_parties) or 'the service'}. "
                    f"Original task: {original_task}. "
                    f"Available substitutions: {', '.join(substitutions) or 'none identified'}. "
                    f"Acknowledge their choice, suggest what you can still do "
                    f"without sharing that data, or ask how they'd like to proceed. "
                    f"Keep it brief and helpful."
                ),
            },
        ]

        response = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.4,
            max_tokens=200,
        )

        return response.choices[0].message.content
