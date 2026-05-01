from fastapi import FastAPI
from backend.app.api.governor_routes import router as governor_router

app = FastAPI(
    title="PersonaGuard API",
    description="Privacy-aware agentic governor",
    version="1.0"
)

# Attach routes
app.include_router(governor_router)


@app.get("/")
def home():
    return {"message": "PersonaGuard backend running"}