"""
EchoCoach — Real-Time Voice Coaching Backend
FastAPI + WebSocket + OpenAI Whisper-1 (STT) + GPT-4o (Analysis)
"""

import asyncio
import json
import io
import uuid
import os
import struct
import logging
from typing import Dict, List

logger = logging.getLogger("echocoach")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

# ─── App Setup ───────────────────────────────────────────────────────────────

app = FastAPI(title="EchoCoach API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_openai_client = None


def get_openai_client() -> AsyncOpenAI:
    """Lazy-initialize the OpenAI client so the app can start without a key."""
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Copy backend/.env.template to backend/.env and add your key."
            )
        _openai_client = AsyncOpenAI(api_key=api_key)
    return _openai_client

# ─── Session Store ───────────────────────────────────────────────────────────

sessions: Dict[str, dict] = {}


def get_or_create_session(session_id: str) -> dict:
    """Return existing session or create a new one."""
    if session_id not in sessions:
        sessions[session_id] = {
            "id": session_id,
            "mode": "coach",  # "coach" | "conversation"
            "history": [],    # list of {"role": ..., "content": ...}
        }
    return sessions[session_id]


# ─── System Prompts ─────────────────────────────────────────────────────────

COACH_SYSTEM_PROMPT = """Act as a professional communication coach. Analyze the user's spoken input with HIGH DETAIL.
Return ONLY valid JSON with this exact schema — no markdown fences, no explanation:
{
  "original": "the exact words the user spoke",
  "corrected": "grammatically correct version of what they said",
  "mistakes": ["list of specific grammar/pronunciation/word-choice mistakes"],
  "tone_analysis": "description of the speaker's tone (confident, hesitant, aggressive, etc.)",
  "fluency_score": 7,
  "coaching_tip": "one actionable tip to improve their communication",
  "natural_response": "your conversational reply to what the user actually said"
}
fluency_score must be an integer from 1 to 10.
If there are no mistakes, return an empty array for mistakes and set fluency_score to 10.
Always respond in the same language the user spoke."""

CONVERSATION_SYSTEM_PROMPT = """You are a friendly, intelligent conversational partner. The user is practicing their speaking skills.
Respond naturally and fluidly. Only correct critical misunderstandings — do NOT nitpick grammar.
Return ONLY valid JSON with this exact schema — no markdown fences, no explanation:
{
  "original": "the exact words the user spoke",
  "corrected": "same as original unless there was a critical error",
  "mistakes": [],
  "tone_analysis": "brief tone note",
  "fluency_score": 8,
  "coaching_tip": "",
  "natural_response": "your natural, engaging reply continuing the conversation"
}
fluency_score must be an integer from 1 to 10.
Keep coaching_tip empty in conversation mode.
Always respond in the same language the user spoke."""


def get_system_prompt(mode: str) -> str:
    return COACH_SYSTEM_PROMPT if mode == "coach" else CONVERSATION_SYSTEM_PROMPT


# ─── Voice Activity Detection (Server-Side) ─────────────────────────────────

# Minimum RMS energy threshold — chunks below this are treated as silence.
# This is a lightweight fallback; the primary VAD runs client-side.
VAD_ENERGY_THRESHOLD = 0.005


def audio_has_speech(audio_bytes: bytes, threshold: float = VAD_ENERGY_THRESHOLD) -> bool:
    """Quick energy-based VAD on raw audio bytes.

    Interprets the raw bytes as 16-bit signed PCM samples and computes
    RMS energy.  WebM/opus containers carry a small header so we skip
    the first 200 bytes to avoid inflating the estimate.  If the chunk
    is too small to analyse we let it through (fail-open).
    """
    # Skip container header bytes
    data = audio_bytes[200:] if len(audio_bytes) > 400 else audio_bytes

    # Need at least a few samples
    if len(data) < 64:
        return True  # fail-open: let small chunks through

    # Interpret as 16-bit signed LE samples
    n_samples = len(data) // 2
    try:
        samples = struct.unpack(f"<{n_samples}h", data[: n_samples * 2])
    except struct.error:
        return True  # fail-open on decode errors

    # Compute RMS normalised to [-1, 1]
    sum_sq = sum(s * s for s in samples)
    rms = (sum_sq / n_samples) ** 0.5 / 32768.0

    has_speech = rms >= threshold
    logger.debug("VAD energy=%.5f  threshold=%.5f  speech=%s", rms, threshold, has_speech)
    return has_speech


# ─── AI Pipeline ─────────────────────────────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes) -> str:
    """Send audio to Whisper-1 and get transcript text."""
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "chunk.webm"

    transcript = await get_openai_client().audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format="text",
    )
    return transcript.strip()


async def analyze_with_llm(session: dict, transcript: str) -> dict:
    """Send transcript + history to GPT-4o and parse the JSON result."""
    # Append user message to history
    session["history"].append({"role": "user", "content": transcript})

    # Keep last 20 messages for context window management
    context = session["history"][-20:]

    messages = [
        {"role": "system", "content": get_system_prompt(session["mode"])},
        *context,
    ]

    response = await get_openai_client().chat.completions.create(
        model="gpt-4o",
        messages=messages,
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content
    result = json.loads(raw)

    # Append assistant's natural response to history for continuity
    if result.get("natural_response"):
        session["history"].append({
            "role": "assistant",
            "content": result["natural_response"],
        })

    return result


# ─── WebSocket Endpoint ──────────────────────────────────────────────────────

@app.websocket("/ws/coaching")
async def websocket_coaching(ws: WebSocket):
    await ws.accept()

    # Assign a session
    session_id = str(uuid.uuid4())
    session = get_or_create_session(session_id)

    # Send session info
    await ws.send_json({"type": "session_started", "session_id": session_id})

    try:
        while True:
            message = await ws.receive()

            # ── Binary audio chunk ──
            if "bytes" in message and message["bytes"]:
                audio_bytes = message["bytes"]
                if len(audio_bytes) < 100:
                    continue  # skip tiny/empty chunks

                # ── Server-side VAD gate ──
                if not audio_has_speech(audio_bytes):
                    logger.debug("VAD: skipping silent chunk (%d bytes)", len(audio_bytes))
                    await ws.send_json({
                        "type": "vad_silent",
                        "message": "Chunk skipped — no voice activity detected.",
                    })
                    continue

                # Signal processing state
                await ws.send_json({"type": "processing"})

                try:
                    # Step 1: Transcribe
                    transcript = await transcribe_audio(audio_bytes)

                    if not transcript or len(transcript.strip()) < 2:
                        await ws.send_json({
                            "type": "info",
                            "message": "No speech detected in this chunk.",
                        })
                        continue

                    # Send live transcript
                    await ws.send_json({
                        "type": "transcript",
                        "text": transcript,
                        "session_id": session_id,
                    })

                    # Step 2: Analyze with LLM
                    analysis = await analyze_with_llm(session, transcript)

                    await ws.send_json({
                        "type": "analysis",
                        "data": analysis,
                        "session_id": session_id,
                    })

                except Exception as e:
                    await ws.send_json({
                        "type": "error",
                        "message": f"Processing error: {str(e)}",
                    })

            # ── JSON control message ──
            elif "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type")

                if msg_type == "set_mode":
                    new_mode = data.get("mode", "coach")
                    if new_mode in ("coach", "conversation"):
                        session["mode"] = new_mode
                        await ws.send_json({
                            "type": "mode_changed",
                            "mode": new_mode,
                        })

                elif msg_type == "init":
                    req_id = data.get("session_id", session_id)
                    session = get_or_create_session(req_id)
                    session_id = req_id
                    await ws.send_json({
                        "type": "session_started",
                        "session_id": session_id,
                    })

                elif msg_type == "clear_history":
                    session["history"] = []
                    await ws.send_json({"type": "history_cleared"})

    except WebSocketDisconnect:
        pass


# ─── REST Endpoints ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "echocoach-backend"}


@app.post("/api/analyze")
async def analyze_upload(file: UploadFile = File(...), mode: str = "coach"):
    """Fallback REST endpoint: upload a single audio file for analysis."""
    audio_bytes = await file.read()
    session = get_or_create_session(str(uuid.uuid4()))
    session["mode"] = mode

    transcript = await transcribe_audio(audio_bytes)
    analysis = await analyze_with_llm(session, transcript)

    return {
        "transcript": transcript,
        "analysis": analysis,
    }


# ─── Entrypoint ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
