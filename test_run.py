import json
from backend.app.core.governor import evaluate_task
from backend.app.core.receipt_generator import generate_receipt

# Load scenarios
with open("backend/app/data/test_scenarios.json", "r") as f:
    scenarios = json.load(f)

scenario = scenarios["hotel_booking"]

# Run for all personas
for persona in ["conservative", "balanced", "convenience_first"]:
    print("\n==============================")
    print(f"PERSONA: {persona}")
    print("==============================")

    result = evaluate_task(
        scenario["task"],
        scenario["subtasks"],
        persona
    )

    receipt = generate_receipt(result)

    print("\nDECISIONS:")
    for decision in result["decisions"]:
        print(f"- {decision['action']} → {decision['decision'].upper()}")
        print(f"  Reason: {decision['reason']}")

    print("\nRECEIPT:")
    print(receipt["plain_language_summary"])