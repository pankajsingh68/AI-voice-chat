# 🎙️ EchoCoach — Real-Time AI Voice Coaching

A production-ready web application that provides real-time voice coaching powered by OpenAI Whisper (speech-to-text) and GPT-4o (intelligent analysis). Speak naturally and receive instant feedback on grammar, fluency, tone, and communication skills.

## ✨ Features

- **Real-Time Audio Streaming** — 3-second chunked audio capture via WebSocket
- **Live Transcription** — Instant speech-to-text with OpenAI Whisper-1
- **AI Coaching Analysis** — Grammar correction, tone analysis, fluency scoring, coaching tips
- **Dual Modes** — Coach Mode (detailed feedback) and Conversation Mode (fluid chat)
- **Contextual Memory** — Session-based conversation history for coherent multi-turn interaction
- **Premium Dark UI** — Glassmorphism cards, animated gauges, smooth micro-animations

## 🏗️ Architecture

```
Browser (React + Vite + Tailwind)
  │
  │  WebSocket (binary audio / JSON events)
  │
  ▼
FastAPI Backend (Python)
  │
  ├──▶ OpenAI Whisper-1  (STT)
  └──▶ OpenAI GPT-4o     (Analysis)
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **OpenAI API Key** with access to `whisper-1` and `gpt-4o`

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.template .env
# Edit .env and add your OPENAI_API_KEY

# Start server
uvicorn main:app --reload --port 8000
```

The backend will be running at **http://localhost:8000**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend will be running at **http://localhost:5173**

### 3. Use the App

1. Open **http://localhost:5173** in your browser
2. Click the **microphone button** to start recording
3. Speak naturally — transcripts and coaching feedback appear in real-time
4. Toggle between **Coach** and **Chat** modes in the header

## 📡 API Reference

### WebSocket: `ws://localhost:8000/ws/coaching`

**Client → Server:**
| Message | Type | Description |
|---------|------|-------------|
| Binary data | `bytes` | Audio chunk (webm/opus format) |
| `{"type": "set_mode", "mode": "coach"}` | `text` | Switch coaching mode |
| `{"type": "clear_history"}` | `text` | Clear conversation history |

**Server → Client:**
| Message | Description |
|---------|-------------|
| `{"type": "session_started", "session_id": "..."}` | Session initialized |
| `{"type": "processing"}` | AI is analyzing (show skeleton) |
| `{"type": "transcript", "text": "..."}` | Live transcript result |
| `{"type": "analysis", "data": {...}}` | Full coaching analysis |
| `{"type": "error", "message": "..."}` | Error occurred |

### REST: `POST /api/analyze`

Upload a single audio file for one-shot analysis.

### Health: `GET /health`

Returns `{"status": "ok"}`.

## 🧠 LLM Analysis Schema

```json
{
  "original": "what the user said",
  "corrected": "grammatically correct version",
  "mistakes": ["list of specific errors"],
  "tone_analysis": "confident, hesitant, etc.",
  "fluency_score": 7,
  "coaching_tip": "actionable improvement tip",
  "natural_response": "AI's conversational reply"
}
```

## 📁 Project Structure

```
AIvoice/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket + AI pipeline
│   ├── requirements.txt     # Python dependencies
│   └── .env.template        # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main layout
│   │   ├── main.jsx          # Entry point
│   │   ├── index.css         # Tailwind + custom styles
│   │   ├── context/
│   │   │   └── SessionContext.jsx  # State + WebSocket management
│   │   └── components/
│   │       ├── Header.jsx          # Branding + status
│   │       ├── ModeToggle.jsx      # Coach/Chat mode switch
│   │       ├── AudioRecorder.jsx   # Mic + chunked recording
│   │       ├── LiveTranscript.jsx  # Chat-style transcript
│   │       ├── AnalysisPanel.jsx   # Analysis card container
│   │       ├── AnalysisCard.jsx    # Structured feedback card
│   │       ├── FluencyGauge.jsx    # Radial score indicator
│   │       └── SkeletonCard.jsx    # Loading skeleton
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md
```

## ⚙️ Configuration

| Variable | Location | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | `backend/.env` | Your OpenAI API key |

## 📝 License

MIT
