from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

CONVERSATION_ID = "test_session_1"


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_start_conversation():
    response = client.post("/api/start", json={
        "conversation_id": CONVERSATION_ID,
        "persona": "balanced"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "started"
    assert response.json()["persona"] == "balanced"


def test_invalid_persona():
    response = client.post("/api/start", json={
        "conversation_id": "test_invalid",
        "persona": "nonexistent_persona"
    })
    assert response.status_code == 400


def test_send_message():
    # Start first
    client.post("/api/start", json={
        "conversation_id": CONVERSATION_ID,
        "persona": "balanced"
    })
    response = client.post("/api/message", json={
        "conversation_id": CONVERSATION_ID,
        "message": "Book me a flight to London"
    })
    assert response.status_code == 200
    assert "type" in response.json()


def test_message_unknown_conversation():
    response = client.post("/api/message", json={
        "conversation_id": "nonexistent_id",
        "message": "hello"
    })
    assert response.status_code == 404


def test_confirm_yes():
    client.post("/api/start", json={
        "conversation_id": CONVERSATION_ID,
        "persona": "balanced"
    })
    response = client.post("/api/confirm", json={
        "conversation_id": CONVERSATION_ID,
        "confirmed": True
    })
    assert response.status_code == 200


def test_confirm_no():
    client.post("/api/start", json={
        "conversation_id": CONVERSATION_ID,
        "persona": "balanced"
    })
    response = client.post("/api/confirm", json={
        "conversation_id": CONVERSATION_ID,
        "confirmed": False
    })
    assert response.status_code == 200