from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from dotenv import load_dotenv
load_dotenv()  # load .env before any module that calls os.getenv() at import time

from conversation import ConversationManager

app = FastAPI(title="PersonaGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

conversations: dict[str, ConversationManager] = {}


# ---------- Request / Response Models ----------

class StartRequest(BaseModel):
    conversation_id: str
    persona: str  # conservative | balanced | convenience_first

class MessageRequest(BaseModel):
    conversation_id: str
    message: str

class ConfirmRequest(BaseModel):
    conversation_id: str
    confirmed: bool  # True = Yes proceed, False = No cancel


# ---------- Endpoints ----------

@app.post("/api/start")
async def start_conversation(req: StartRequest):
    """
    Called by Dev C's persona onboarding screen.
    Creates a new conversation with the chosen persona.
    """
    if req.persona not in ["conservative", "balanced", "convenience_first"]:
        raise HTTPException(status_code=400, detail="Invalid persona")

    conversations[req.conversation_id] = ConversationManager(
        conversation_id=req.conversation_id,
        persona=req.persona,
        # No governor argument — conversation.py calls Dev A's modules directly
    )

    welcome = conversations[req.conversation_id].get_welcome_message()
    return {"status": "started", "persona": req.persona, "message": welcome}


@app.post("/api/message")
async def handle_message(req: MessageRequest):
    """
    Main chat endpoint. Dev C sends every user message here.

    Returns one of:
      · type: "response"      — normal reply, task complete
      · type: "confirmation"  — agent needs user approval before proceeding
      · type: "receipt"       — task done, includes privacy receipt
    """
    conv = conversations.get(req.conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found. Call /api/start first.")

    result = await conv.handle_message(req.message)
    return result


@app.post("/api/confirm")
async def handle_confirmation(req: ConfirmRequest):
    """
    Called by Dev C after user taps Yes / No on a confirmation card.
    Resumes or cancels the pending action.
    """
    conv = conversations.get(req.conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    result = await conv.handle_confirmation(req.confirmed)
    return result


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
