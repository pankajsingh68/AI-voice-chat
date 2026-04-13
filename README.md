# AI Voice Chat with VAD

A real-time, browser-based voice chat application powered by OpenAI's Whisper (speech-to-text), GPT-4o (language model), and TTS (text-to-speech) APIs. A browser-native **Voice Activity Detector (VAD)** automatically detects when you start and stop speaking — no push-to-talk required.

---

## Features

- 🎙️ **Automatic VAD** — energy-threshold VAD via the Web Audio API; starts recording when you speak and stops when you fall silent
- 📝 **Speech-to-text** — OpenAI Whisper `whisper-1` model
- 🤖 **AI conversation** — OpenAI GPT-4o with multi-turn context
- 🔊 **Text-to-speech** — OpenAI TTS (`tts-1` / `alloy` voice), streamed back to the browser
- 💬 **Chat history UI** — scrollable conversation bubbles with animated waveform visualizer

---

## Architecture

```
Browser
  └─ Web Audio API (VAD)
       ├─ Speech detected  →  MediaRecorder starts
       └─ Silence detected →  MediaRecorder stops
                                └─ POST /api/transcribe  (Whisper)
                                └─ POST /api/chat        (GPT-4o)
                                └─ POST /api/tts         (TTS) → Audio playback
```

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/pankajsingh68/AI-voice-chat.git
cd AI-voice-chat
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 3. Run the server

```bash
uvicorn main:app --reload
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## Environment Variables

| Variable         | Required | Description                  |
|------------------|----------|------------------------------|
| `OPENAI_API_KEY` | Yes      | Your OpenAI API key          |

---

## API Endpoints

| Method | Path              | Description                          |
|--------|-------------------|--------------------------------------|
| POST   | `/api/transcribe` | Transcribe audio → text (Whisper)    |
| POST   | `/api/chat`       | Multi-turn chat response (GPT-4o)    |
| POST   | `/api/tts`        | Text → speech MP3 stream (TTS)       |

---

## Running Tests

```bash
pip install pytest httpx
pytest tests/ -v
```

---

## VAD Tuning

The VAD lives entirely in `static/app.js`. Key parameters (passed to `new VAD()`):

| Parameter           | Default | Description                                   |
|---------------------|---------|-----------------------------------------------|
| `threshold`         | `0.015` | RMS energy level that counts as "speech"      |
| `silenceDuration`   | `1200`  | Milliseconds of silence before recording ends |
| `minSpeechDuration` | `250`   | Minimum speech duration to process (ms)       |

Raise `threshold` to ignore background noise; lower it for quiet environments.

---

## License

MIT