# PersonaGuard

Privacy-aware agentic governor for autonomous AI assistants.

PersonaGuard sits between a user and an autonomous AI agent. It checks what data the agent wants to access or share, compares it against the user's privacy persona, and decides whether to permit, substitute, confirm, or block the action.

---

## What PersonaGuard Does

Modern AI agents can act autonomously — booking flights, making payments, sharing data — but they often lack **user-aligned privacy control**.

PersonaGuard introduces a **governor layer** that:

- Intercepts AI actions before execution  
- Evaluates privacy risk based on user persona  
- Enforces safe execution policies  
- Keeps the user in control via confirmation flows  
- Generates transparent privacy receipts  

---

## Core Decision System

For every task, PersonaGuard assigns one of four decisions:

- **PERMIT** → Safe to execute  
- **SUBSTITUTE** → Replace sensitive data with safer alternatives  
- **CONFIRM** → Ask user before proceeding  
- **BLOCK** → Stop execution and suggest alternatives  

---

## System Architecture 

User Input
↓
Conversation Manager (LLM Layer)
↓
Task Decomposition (Claude/OpenRouter)
↓
Privacy Classification
↓
Governor Engine
↓
Decision Path (Permit / Substitute / Confirm / Block)
↓
Response Generation (LLM)
↓
Privacy Receipt + Audit Logging
↓
Frontend UI


---

## Team Structure

### Shravani — Backend + Governor Engine  
Owns the privacy decision-making brain.

Responsibilities:
- Persona rules  
- Third-party trust database  
- Privacy classifier  
- Governor decision engine  
- Audit logging  
- Privacy receipt generation  
- Privacy evaluation layer  

---

### Kanak — LLM Integration + Conversation Logic  
Owns the AI conversation layer.

Responsibilities:
- Claude/OpenRouter integration  
- Task decomposition  
- Conversation state management  
- Mapping governor decisions → natural language responses  
- Confirmation flow handling  
- Privacy-aware response generation  
- **Privacy score interpretation and surfacing (translating backend audit signals into user-understandable feedback)**  

---

### Khushi + Vibe Coding — Frontend + User Experience  
Owns the user interface.

Responsibilities:
- Chat UI  
- Persona selection  
- Confirmation card (Yes / No / Safer alternative)  
- Privacy receipt visualization  
- End-to-end demo experience  

---

## Folder Structure


backend/
- init.py
- main.py # FastAPI entry point
- conversation.py # Conversation manager + LLM integration
- governor.py # Core decision engine
- persona_engine.py # Persona rule loader
- privacy_classifier.py # Data + trust classification
- privacy_evaluator.py # Privacy scoring + audit signals
- receipt_generator.py # Privacy receipt builder
- audit_logger.py # Logs all decisions
- requirements.txt
- env.example

data/
- personas.json # Persona definitions
- third_party_trust_db.json # Trust rules for services

frontend/
- index.html
- API_CONTRACT.md

---
## Privacy Personas

PersonaGuard supports:

### Conservative
- Maximum privacy
- Blocks most sensitive data
- Minimal third-party trust

### Balanced
- Moderate privacy
- Allows common actions with confirmation

### Convenience-First
- Minimal friction
- Allows most actions with logging

---

## Privacy Receipt

After every task, PersonaGuard generates a receipt showing:

- ✅ Shared data  
- 🔒 Protected data  
- 🚫 Blocked actions  
- 🔁 Substitutions applied  
- ❓ Confirmations required  

This ensures **full transparency**.

---

## Privacy Score (Concept)

PersonaGuard evaluates each task using a privacy evaluation layer that produces a **privacy score signal** based on:

- Sensitivity of data used  
- Third-party involvement  
- Level of user control (confirmation vs auto)  
- Use of substitutions  

This score is:
- Logged internally for auditing  
- Used to improve decision-making  
- Interpreted and surfaced via the conversation layer  

---

## Audit Logging

Every interaction logs:

- Decisions taken  
- Data accessed  
- Third-party usage  
- Privacy evaluation signals  

This creates a **complete audit trail**.

---

## Example Flow

User:
> "Book me a flight to Boston"

System:
1. Decomposes into subtasks  
2. Classifies data + trust  
3. Runs governor decisions  
4. Requests confirmation  
5. Executes after approval  
6. Generates receipt  

---

## Design Philosophy

> AI should act **with user awareness and consent**, not silently on their behalf.

---

## Why This Matters

- Prevents hidden data sharing  
- Makes AI systems transparent  
- Keeps humans in control  
- Aligns AI autonomy with privacy
