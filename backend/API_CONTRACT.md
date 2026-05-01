# PersonaGuard — API Contract for Dev C
# Every endpoint Dev C needs to call, with exact request/response shapes.

BASE_URL = "http://localhost:8000"


# ─────────────────────────────────────────────
# 1. START A CONVERSATION
# Call this when user picks their persona on the onboarding screen.
# ─────────────────────────────────────────────

POST /api/start

Request:
{
  "conversation_id": "uuid-string",   # generate on frontend with crypto.randomUUID()
  "persona": "conservative"           # conservative | balanced | convenience_first
}

Response:
{
  "status": "started",
  "persona": "conservative",
  "message": "I'm PersonaGuard... What would you like my help with?"
  # Display this message as the first assistant bubble in chat
}


# ─────────────────────────────────────────────
# 2. SEND A USER MESSAGE
# Call this every time the user sends a chat message.
# ─────────────────────────────────────────────

POST /api/message

Request:
{
  "conversation_id": "uuid-string",
  "message": "Book me a hotel in Chicago this Saturday under $200"
}

Response — type: "response" (normal, task complete):
{
  "type": "response",
  "message": "Done! I found a room at Marriott Chicago...",  # display as assistant bubble
  "receipt": {
    "shared": [
      { "action": "Book hotel", "with": "Marriott", "data": ["name", "email", "payment_token"] }
    ],
    "protected": [
      { "original": ["precise_location"], "used_instead": "city_only", "reason": "..." }
    ],
    "blocked": [
      { "service": "Hotels.com", "reason": "ad partner data sharing", "alternative": "Marriott" }
    ],
    "retention": "delete_after_task"
  },
  "governor_summary": { "blocked": 1, "substituted": 1 }
  # Show receipt card below the assistant message bubble
}

Response — type: "confirmation" (agent needs approval before proceeding):
{
  "type": "confirmation",
  "message": "Before I book this, I need to share your payment info with Marriott...",
  # Display as assistant bubble + confirmation card below it
  "confirmation_message": "This requires sharing payment_method with Payment Processor...",
  "subtasks": [
    { "action": "Process payment", "decision": "confirm", "third_party": "Marriott", "reason": "..." }
  ]
  # Lock the input bar until user taps Yes or No on the confirmation card
}


# ─────────────────────────────────────────────
# 3. HANDLE CONFIRMATION RESPONSE
# Call this when user taps Yes or No on a confirmation card.
# ─────────────────────────────────────────────

POST /api/confirm

Request:
{
  "conversation_id": "uuid-string",
  "confirmed": true   # true = Yes proceed, false = No cancel
}

Response (same shape as /api/message response):
{
  "type": "response",
  "message": "Got it! I've booked your room at Marriott...",
  "receipt": { ... },           # show receipt if task completed
  "governor_summary": { ... }
}
# OR if user said No:
{
  "type": "response",
  "message": "No problem. I skipped the payment. Here's what I can still do...",
  "receipt": null
}


# ─────────────────────────────────────────────
# FRONTEND STATE MACHINE (what Dev C needs to track)
# ─────────────────────────────────────────────

States:
  IDLE              → user can type, send button active
  LOADING           → waiting for /api/message response, show typing indicator
  AWAITING_CONFIRM  → confirmation card visible, input bar LOCKED
  CONFIRMED         → waiting for /api/confirm response, show typing indicator

Transitions:
  IDLE → LOADING              on user sends message
  LOADING → IDLE              on response.type === "response"
  LOADING → AWAITING_CONFIRM  on response.type === "confirmation"
  AWAITING_CONFIRM → LOADING  on user taps Yes or No (call /api/confirm)
  LOADING → IDLE              on confirm response received


# ─────────────────────────────────────────────
# ERROR HANDLING
# ─────────────────────────────────────────────

All errors return:
{
  "detail": "Error message string"
}

HTTP 404 → conversation_id not found → call /api/start first
HTTP 400 → invalid persona value
HTTP 500 → OpenAI API error → show "Something went wrong, please try again"
