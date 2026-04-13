"""AI Voice Chat with VAD — FastAPI backend."""
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="AI Voice Chat with VAD")

_api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=_api_key) if _api_key else None


def _get_client() -> OpenAI:
    if client is None:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not set.")
    return client


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class TTSRequest(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are a helpful AI assistant in a voice conversation. "
    "Keep your responses concise and natural for speech — "
    "avoid markdown, bullet points, or special formatting."
)


@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio using OpenAI Whisper."""
    oai = _get_client()
    audio_bytes = await audio.read()
    filename = audio.filename or "audio.webm"
    content_type = audio.content_type or "audio/webm"

    transcript = oai.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, audio_bytes, content_type),
    )
    return {"transcript": transcript.text}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Return an AI-generated reply using OpenAI Chat Completions."""
    oai = _get_client()
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Prepend system prompt if not already present
    if not any(m["role"] == "system" for m in messages):
        messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})

    completion = oai.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=512,
    )
    return {"response": completion.choices[0].message.content}


@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using OpenAI TTS and stream the audio."""
    oai = _get_client()
    speech = oai.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=request.text,
    )
    return StreamingResponse(
        speech.iter_bytes(),
        media_type="audio/mpeg",
    )


# ---------------------------------------------------------------------------
# Serve the frontend (must be last so API routes take priority)
# ---------------------------------------------------------------------------

app.mount("/", StaticFiles(directory="static", html=True), name="static")
