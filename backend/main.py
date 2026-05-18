from pathlib import Path
from typing import Any

import ollama
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from config import OLLAMA_HOST, OLLAMA_MODEL

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"
from services.conversation_service import handle_chat
from services.gemma_service import extract_from_text
from services.legal_service import analyze_legal_situation
from services.scheme_service import find_eligible_schemes, load_schemes

app = FastAPI(title="Sahaj API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class LegalQueryRequest(BaseModel):
    """Text and/or structured fields from prior extraction."""

    text: str | None = Field(None, description="Hindi/English user message")
    category: str | None = None
    details: dict[str, Any] | None = None


class ExtractRequest(BaseModel):
    text: str


class ChatRequest(BaseModel):
    text: str
    session_profile: dict[str, Any] | None = None
    session_context: dict[str, Any] | None = None


class VoiceTextRequest(BaseModel):
    """Client sends transcript from browser speech recognition."""
    text: str
    session_profile: dict[str, Any] | None = None
    session_context: dict[str, Any] | None = None


class FindSchemesRequest(BaseModel):
    profile: dict[str, Any]


@app.get("/api/health")
async def health():
    try:
        listed = ollama.list()
        names = [m.model for m in listed.models]
        sahaj_ok = any(OLLAMA_MODEL in n for n in names)
    except Exception as exc:
        return {
            "status": "degraded",
            "ollama": False,
            "model": OLLAMA_MODEL,
            "error": str(exc),
        }
    return {
        "status": "ok" if sahaj_ok else "degraded",
        "ollama": True,
        "ollama_host": OLLAMA_HOST,
        "model": OLLAMA_MODEL,
        "model_loaded": sahaj_ok,
        "pipeline_version": "2026-05-18-agent-v2",
    }


@app.post("/api/find-schemes")
async def find_schemes(body: FindSchemesRequest):
    schemes = find_eligible_schemes(body.profile)
    from services.scheme_service import total_annual_benefit_inr

    return {
        "schemes": schemes,
        "total_benefit_inr": total_annual_benefit_inr(schemes),
        "count": len(schemes),
    }


@app.get("/api/scheme/{scheme_id}")
async def get_scheme(scheme_id: str):
    for s in load_schemes():
        if s["id"] == scheme_id:
            return s
    raise HTTPException(status_code=404, detail="Scheme not found")


@app.post("/api/chat")
async def chat(body: ChatRequest):
    """Conversational turn: extract → Hindi reply (legal / scheme / follow-up)."""
    try:
        return handle_chat(
            body.text,
            session_profile=body.session_profile,
            session_context=body.session_context,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Ollama error: {exc}") from exc


@app.post("/api/process-voice")
async def process_voice(body: VoiceTextRequest):
    """Voice: browser records Hindi → text; same pipeline as chat."""
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty transcript")
    try:
        result = handle_chat(
            body.text.strip(),
            session_profile=body.session_profile,
            session_context=body.session_context,
        )
        result["heard_text"] = body.text.strip()
        return result
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Ollama error: {exc}") from exc


@app.post("/api/extract")
async def extract(body: ExtractRequest):
    try:
        return extract_from_text(body.text)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Ollama error: {exc}") from exc


@app.post("/api/legal-query")
async def legal_query(body: LegalQueryRequest):
    """
    Legal aid: optional Gemma extraction → match legal_rights.json → Hindi reply.
    """
    extraction: dict[str, Any] | None = None
    category = body.category
    details = dict(body.details or {})

    if body.text:
        try:
            extraction = extract_from_text(body.text)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Ollama error: {exc}") from exc

        if extraction.get("intent") == "legal_aid":
            category = category or extraction.get("category")
            details = {**details, **(extraction.get("details") or {})}
        elif extraction.get("intent") != "legal_aid" and not category:
            # Still try keyword routing from raw text
            pass

    if not body.text and not category and not details:
        raise HTTPException(
            status_code=400,
            detail="Provide text and/or category and details",
        )

    result = analyze_legal_situation(
        situation=body.text,
        category=category,
        details=details,
        extraction=extraction,
    )
    return {
        "extraction": extraction,
        "legal": result,
        "reply_hindi": result["reply_hindi"],
        "actions": result["actions"],
        "emergency": result["emergency"],
    }


# Serve built React app (tunnel / public URL must open the UI, not JSON 404)
def _register_frontend() -> None:
    if not FRONTEND_INDEX.is_file():
        return
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    @app.get("/")
    async def spa_root():
        return FileResponse(FRONTEND_INDEX)

    @app.get("/{spa_path:path}")
    async def spa_fallback(spa_path: str):
        if spa_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = FRONTEND_DIST / spa_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_INDEX)


_register_frontend()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
