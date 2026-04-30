# PersonaGuard

Privacy-aware agentic governor for autonomous AI assistants.

PersonaGuard sits between a user and an autonomous AI agent. It checks what data the agent wants to access or share, compares it against the user's privacy persona, and decides whether to permit, substitute, confirm, or block the action.

## Team Structure

### Person 1 — Backend + Governor Engine
Owns the privacy decision-making brain.

Main folders:
- `backend/app/core/`
- `backend/app/data/`
- `backend/app/models/`
- `backend/app/api/governor_routes.py`

Responsibilities:
- Persona rules
- Third-party trust database
- Privacy classifier
- Governor decisions
- Audit logger
- Privacy receipt generator

### Person 2 — LLM Integration + Conversation Logic
Owns the AI conversation layer.

Main folders:
- `backend/app/llm/`
- `backend/app/prompts/`
- `backend/app/api/chat_routes.py`

Responsibilities:
- Claude/OpenAI integration
- Task decomposition
- Conversation memory
- Turning governor decisions into natural chat responses
- Confirmation flow handling

### Person 3 — Frontend + User Experience
Owns the user interface.

Main folders:
- `frontend/src/components/`
- `frontend/src/services/`
- `frontend/src/styles/`

Responsibilities:
- Chat UI
- Persona onboarding cards
- Confirmation card
- Privacy receipt card
- Persona badge and polished demo experience

## Folder Meaning

```text
backend/
  FastAPI backend for governor logic, AI routes, data, and audit logging.

backend/app/api/
  API endpoints used by the frontend and LLM layer.

backend/app/core/
  Core privacy system: persona engine, classifier, governor, audit logger, receipt generator.

backend/app/data/
  JSON rule files: personas, third-party trust database, and test scenarios.

backend/app/models/
  Shared request/response schemas.

backend/app/llm/
  LLM client, prompt builder, and conversation manager.

backend/app/prompts/
  Prompt templates and response templates.

backend/app/tests/
  Backend test files.

backend/database/
  Local database files for audit logs.

frontend/
  React frontend for chat, persona selection, confirmation, and privacy receipt UI.

docs/
  Architecture, API contract, demo script, and judging notes.

demo/
  Prepared demo scenarios for hotel, flight, shopping, and calendar tasks.