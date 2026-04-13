"""Tests for the AI Voice Chat FastAPI application."""
import io
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers to build a fresh app/client per test so patches are isolated
# ---------------------------------------------------------------------------

def _make_client():
    """Import and patch the OpenAI client, then return a TestClient."""
    import main  # noqa: PLC0415
    return TestClient(main.app)


# ---------------------------------------------------------------------------
# /api/transcribe
# ---------------------------------------------------------------------------

class TestTranscribe:
    def test_returns_transcript(self):
        mock_transcript = MagicMock()
        mock_transcript.text = "Hello world"

        with patch("main.client") as mock_client:
            mock_client.audio.transcriptions.create.return_value = mock_transcript
            client = _make_client()

            audio_file = io.BytesIO(b"fake-audio-data")
            response = client.post(
                "/api/transcribe",
                files={"audio": ("audio.webm", audio_file, "audio/webm")},
            )

        assert response.status_code == 200
        assert response.json() == {"transcript": "Hello world"}

    def test_passes_file_to_whisper(self):
        mock_transcript = MagicMock()
        mock_transcript.text = "Test text"

        with patch("main.client") as mock_client:
            mock_client.audio.transcriptions.create.return_value = mock_transcript
            client = _make_client()

            client.post(
                "/api/transcribe",
                files={"audio": ("speech.webm", io.BytesIO(b"data"), "audio/webm")},
            )

        call_kwargs = mock_client.audio.transcriptions.create.call_args
        assert call_kwargs.kwargs["model"] == "whisper-1"

    def test_missing_audio_returns_422(self):
        with patch("main.client"):
            client = _make_client()
            response = client.post("/api/transcribe")
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# /api/chat
# ---------------------------------------------------------------------------

class TestChat:
    def _mock_completion(self, text: str):
        completion = MagicMock()
        completion.choices[0].message.content = text
        return completion

    def test_returns_response(self):
        with patch("main.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_completion("Hi there!")
            client = _make_client()

            response = client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )

        assert response.status_code == 200
        assert response.json() == {"response": "Hi there!"}

    def test_system_prompt_injected(self):
        with patch("main.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_completion("Reply")
            client = _make_client()

            client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Hey"}]},
            )

        call_kwargs = mock_client.chat.completions.create.call_args
        messages = call_kwargs.kwargs["messages"]
        assert messages[0]["role"] == "system"

    def test_existing_system_prompt_not_duplicated(self):
        with patch("main.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_completion("OK")
            client = _make_client()

            client.post(
                "/api/chat",
                json={
                    "messages": [
                        {"role": "system", "content": "Custom system"},
                        {"role": "user",   "content": "Hello"},
                    ]
                },
            )

        call_kwargs = mock_client.chat.completions.create.call_args
        messages = call_kwargs.kwargs["messages"]
        system_msgs = [m for m in messages if m["role"] == "system"]
        assert len(system_msgs) == 1
        assert system_msgs[0]["content"] == "Custom system"

    def test_invalid_body_returns_422(self):
        with patch("main.client"):
            client = _make_client()
            response = client.post("/api/chat", json={"invalid": "body"})
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# /api/tts
# ---------------------------------------------------------------------------

class TestTTS:
    def test_returns_audio_stream(self):
        fake_audio = b"\xff\xfb\x90\x04" * 32   # fake MP3-ish bytes

        mock_speech = MagicMock()
        mock_speech.iter_bytes.return_value = iter([fake_audio])

        with patch("main.client") as mock_client:
            mock_client.audio.speech.create.return_value = mock_speech
            client = _make_client()

            response = client.post(
                "/api/tts",
                json={"text": "Hello, how are you?"},
            )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("audio/mpeg")

    def test_passes_text_to_openai(self):
        mock_speech = MagicMock()
        mock_speech.iter_bytes.return_value = iter([b"audio"])

        with patch("main.client") as mock_client:
            mock_client.audio.speech.create.return_value = mock_speech
            client = _make_client()

            client.post("/api/tts", json={"text": "Speak this"})

        call_kwargs = mock_client.audio.speech.create.call_args
        assert call_kwargs.kwargs["input"] == "Speak this"
        assert call_kwargs.kwargs["model"] == "tts-1"

    def test_missing_text_returns_422(self):
        with patch("main.client"):
            client = _make_client()
            response = client.post("/api/tts", json={})
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Missing API key
# ---------------------------------------------------------------------------

class TestMissingAPIKey:
    def test_transcribe_raises_500_when_no_key(self):
        with patch("main.client", None):
            client = _make_client()
            response = client.post(
                "/api/transcribe",
                files={"audio": ("a.webm", io.BytesIO(b"x"), "audio/webm")},
            )
        assert response.status_code == 500

    def test_chat_raises_500_when_no_key(self):
        with patch("main.client", None):
            client = _make_client()
            response = client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Hi"}]},
            )
        assert response.status_code == 500

    def test_tts_raises_500_when_no_key(self):
        with patch("main.client", None):
            client = _make_client()
            response = client.post("/api/tts", json={"text": "Hi"})
        assert response.status_code == 500
