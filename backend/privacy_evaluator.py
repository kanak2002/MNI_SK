"""
privacy_evaluator.py
────────────────────
Real-time privacy effectiveness module for MNI_SK.
Runs after every task and appends a privacy audit block to the final log.
"""

import re
import json
import time
import hashlib
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
import os


# ── Patterns that signal potential PII / sensitive data exposure ──────────────

PII_PATTERNS = {
    "email":        re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    "phone":        re.compile(r"\b(\+?\d[\d\s\-().]{7,}\d)\b"),
    "national_id":  re.compile(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b"),          # SSN-style
    "credit_card":  re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    "ip_address":   re.compile(r"\b\d{1,3}(\.\d{1,3}){3}\b"),
    "url_with_key": re.compile(r"https?://[^\s]*(?:key|token|secret|auth)[^\s]*", re.I),
    "api_key":      re.compile(r"\b[A-Za-z0-9_\-]{20,}\b"),                    # long opaque tokens
    "name_pattern": re.compile(r"\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\b"),
}

SENSITIVE_KEYWORDS = {
    "password", "passwd", "secret", "private_key", "api_key",
    "token", "credential", "auth", "ssn", "dob", "date_of_birth",
    "passport", "account_number", "pin", "cvv",
}


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class PrivacyCheckResult:
    task_id: str
    timestamp: str
    passed: bool
    score: float                        # 0.0 (fail) → 1.0 (clean)
    violations: list[dict]              # each: {type, severity, location, redacted_snippet}
    warnings: list[str]
    sensitive_keywords_found: list[str]
    input_hash: str                     # SHA-256 of raw input — never store raw PII
    output_hash: str
    evaluation_ms: float
    summary: str

    def to_log_block(self) -> dict:
        """Return the dict that gets appended to the task log."""
        return {
            "privacy_audit": asdict(self)
        }


# ── Main evaluator ────────────────────────────────────────────────────────────

class PrivacyEvaluator:
    """
    Evaluate privacy compliance of a task's input and output.

    Usage
    -----
        evaluator = PrivacyEvaluator()
        result = evaluator.evaluate(task_id, user_input, model_output)
        log_entry = result.to_log_block()
    """

    def __init__(self, strict: bool = True):
        """
        Parameters
        ----------
        strict : bool
            If True, API-key-shaped strings also count as violations.
            Set False to suppress noisy false positives in dev mode.
        """
        self.strict = strict

    # ── Public API ────────────────────────────────────────────────────────────

    def evaluate(
        self,
        task_id: str,
        user_input: str,
        model_output: str,
        context: Optional[dict] = None,
    ) -> PrivacyCheckResult:
        """
        Run a full privacy check on the task's input/output pair.
        Call this immediately after the model responds.
        """
        t0 = time.perf_counter()

        violations: list[dict] = []
        warnings:   list[str]  = []
        found_keywords:  list[str]  = []

        combined_text = f"{user_input}\n{model_output}"

        # 1. PII pattern scan
        for label, pattern in PII_PATTERNS.items():
            if label == "api_key" and not self.strict:
                continue
            for match in pattern.finditer(combined_text):
                origin = "input" if match.start() < len(user_input) else "output"
                snippet = self._redact(match.group())
                severity = self._severity(label)
                violations.append({
                    "type":             label,
                    "severity":         severity,
                    "location":         origin,
                    "redacted_snippet": snippet,
                })

        # 2. Sensitive keyword scan (case-insensitive)
        lower_text = combined_text.lower()
        for kw in SENSITIVE_KEYWORDS:
            if kw in lower_text:
                found_keywords.append(kw)

        # 3. Output-specific checks — did the model echo back raw input data?
        if self._echoes_raw_input(user_input, model_output):
            warnings.append(
                "Model output appears to echo raw user input verbatim — "
                "review for accidental PII passthrough."
            )

        # 4. Check for data minimisation — was unnecessary info requested?
        if context and context.get("fields_requested"):
            excess = self._check_data_minimisation(context["fields_requested"])
            if excess:
                warnings.append(
                    f"Potentially excessive data fields requested: {', '.join(excess)}"
                )

        # 5. Score
        score = self._compute_score(violations, warnings, found_keywords)
        passed = score >= 0.75 and not any(
            v["severity"] == "critical" for v in violations
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000

        return PrivacyCheckResult(
            task_id=task_id,
            timestamp=datetime.now(timezone.utc).isoformat() + "Z",
            passed=passed,
            score=round(score, 3),
            violations=violations,
            warnings=warnings,
            sensitive_keywords_found=found_keywords,
            input_hash=self._sha256(user_input),
            output_hash=self._sha256(model_output),
            evaluation_ms=round(elapsed_ms, 2),
            summary=self._summarise(passed, score, violations, warnings),
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _redact(text: str) -> str:
        """Keep first 2 and last 2 chars; mask the middle."""
        if len(text) <= 4:
            return "****"
        return text[:2] + "*" * (len(text) - 4) + text[-2:]

    @staticmethod
    def _severity(pii_type: str) -> str:
        critical = {"credit_card", "national_id", "api_key", "url_with_key"}
        high     = {"email", "phone", "name_pattern"}
        return "critical" if pii_type in critical else ("high" if pii_type in high else "medium")

    @staticmethod
    def _sha256(text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()

    @staticmethod
    def _echoes_raw_input(inp: str, out: str) -> bool:
        """Flag if >40 consecutive chars of input appear verbatim in output."""
        if len(inp) < 40:
            return False
        chunk = inp[:60].strip()
        return chunk in out

    @staticmethod
    def _check_data_minimisation(fields: list[str]) -> list[str]:
        """Flag fields that are rarely necessary."""
        unnecessary = {"gender", "ethnicity", "religion", "political_view",
                       "sexual_orientation", "mother_maiden_name"}
        return [f for f in fields if f.lower() in unnecessary]

    @staticmethod
    def _compute_score(violations, warnings, keywords) -> float:
        deductions = 0.0
        for v in violations:
            deductions += {"critical": 0.4, "high": 0.2, "medium": 0.1}.get(v["severity"], 0.1)
        deductions += len(warnings) * 0.05
        deductions += len(keywords) * 0.02
        return max(0.0, 1.0 - deductions)

    @staticmethod
    def _summarise(passed, score, violations, warnings) -> str:
        status = "PASS" if passed else "FAIL"
        n_v = len(violations)
        n_w = len(warnings)
        pct = int(score * 100)
        if passed and n_v == 0:
            return f"[{status}] No privacy issues detected. Score: {pct}/100."
        parts = [f"[{status}] Privacy score: {pct}/100."]
        if n_v:
            parts.append(f"{n_v} violation(s) found.")
        if n_w:
            parts.append(f"{n_w} warning(s).")
        return " ".join(parts)


# ── Log writer helper ─────────────────────────────────────────────────────────

def append_privacy_audit_to_log(log_path: str, task_result: dict) -> None:
    """
    Append the privacy audit block to an existing JSON log file.
    """
    audit_block = {"privacy_audit": task_result.get("privacy_audit", {})}
    task_id = task_result.get("task", "unknown")

    # Auto-create the logs directory if it doesn't exist
    os.makedirs(os.path.dirname(log_path), exist_ok=True) if os.path.dirname(log_path) else None

    try:
        with open(log_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = []

    matched = False
    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict) and entry.get("task_id") == task_id:
                entry.update(audit_block)
                matched = True
                break

    if not matched:
        if isinstance(data, list):
            data.append({"task_id": task_id, **audit_block})
        else:
            data[task_id] = audit_block

    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ── Quick smoke-test ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    evaluator = PrivacyEvaluator(strict=True)

    # Simulate a task where the model accidentally echoes an email
    result = evaluator.evaluate(
        task_id="task_001",
        user_input="My email is john.doe@example.com. Book me a meeting.",
        model_output="Sure! I've booked a meeting. Confirmation sent to john.doe@example.com.",
    )

    print(json.dumps(result.to_log_block(), indent=2))
    print("\nSummary:", result.summary)
