# updated this file
# Shravani - May 1 - 1:24 AM
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from backend.app.api.governor_routes import router as governor_router
from backend.conversation import ConversationManager


app = FastAPI(
    title="PersonaGuard API",
    description="Privacy-aware agentic governor",
    version="1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(governor_router)

conversations: dict[str, ConversationManager] = {}


class StartRequest(BaseModel):
    conversation_id: str
    persona: str


class MessageRequest(BaseModel):
    conversation_id: str
    message: str


class ConfirmRequest(BaseModel):
    conversation_id: str
    confirmed: bool


@app.get("/")
def home():
    return {"message": "PersonaGuard backend running"}


@app.post("/api/start")
async def start_conversation(req: StartRequest):
    if req.persona not in ["conservative", "balanced", "convenience_first"]:
        raise HTTPException(status_code=400, detail="Invalid persona")

    conversations[req.conversation_id] = ConversationManager(
        conversation_id=req.conversation_id,
        persona=req.persona,
    )

    welcome = conversations[req.conversation_id].get_welcome_message()
    return {"status": "started", "persona": req.persona, "message": welcome}


@app.post("/api/message")
async def handle_message(req: MessageRequest):
    conv = conversations.get(req.conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found. Call /api/start first.")

    return await conv.handle_message(req.message)


@app.post("/api/confirm")
async def handle_confirmation(req: ConfirmRequest):
    conv = conversations.get(req.conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    return await conv.handle_confirmation(req.confirmed)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)