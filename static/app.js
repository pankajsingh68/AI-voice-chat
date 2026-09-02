/**
 * app.js — AI Voice Chat with VAD
 *
 * Architecture
 * ────────────
 * VAD (Voice Activity Detector)
 *   Uses Web Audio API AnalyserNode to compute RMS energy every animation
 *   frame. When energy exceeds `threshold` the user is speaking; a silence
 *   timeout stops the recording and triggers processing.
 *
 * VoiceChat
 *   Manages the UI, MediaRecorder lifecycle, and API calls
 *   (transcribe → chat → TTS).
 */

'use strict';

/* =========================================================================
   VAD — Voice Activity Detector
   ========================================================================= */

class VAD {
  /**
   * @param {MediaStream} stream
   * @param {object}      opts
   * @param {number}      [opts.threshold=0.015]        RMS energy threshold
   * @param {number}      [opts.silenceDuration=1200]   ms of silence before speech-end fires
   * @param {number}      [opts.minSpeechDuration=250]  ms minimum speech to be valid
   * @param {number}      [opts.fftSize=512]
   */
  constructor(stream, opts = {}) {
    this._threshold       = opts.threshold       ?? 0.015;
    this._silenceDuration = opts.silenceDuration ?? 1200;
    this._minSpeechMs     = opts.minSpeechDuration ?? 250;

    this._ctx      = new AudioContext();
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = opts.fftSize ?? 512;

    const src = this._ctx.createMediaStreamSource(stream);
    src.connect(this._analyser);

    this._buf          = new Float32Array(this._analyser.fftSize);
    this._speaking     = false;
    this._speechStart  = 0;
    this._silenceTimer = null;
    this._running      = false;
    this._rafId        = null;

    /** @type {(() => void) | null} */
    this.onSpeechStart = null;
    /** @type {(() => void) | null} */
    this.onSpeechEnd   = null;
  }

  /** Compute root-mean-square energy of the current audio frame. */
  getRMS() {
    this._analyser.getFloatTimeDomainData(this._buf);
    let sum = 0;
    for (let i = 0; i < this._buf.length; i++) sum += this._buf[i] ** 2;
    return Math.sqrt(sum / this._buf.length);
  }

  start() {
    this._running = true;
    this._poll();
  }

  stop() {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }
    this._speaking = false;
    // Close AudioContext to release the mic ring-buffer
    if (this._ctx.state !== 'closed') this._ctx.close();
  }

  _poll() {
    if (!this._running) return;

    const rms = this.getRMS();

    if (rms > this._threshold) {
      // ── Speech detected ──────────────────────────────────────────────────
      if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }

      if (!this._speaking) {
        this._speaking    = true;
        this._speechStart = Date.now();
        this.onSpeechStart?.();
      }
    } else if (this._speaking && !this._silenceTimer) {
      // ── Possible end of speech — start silence timer ──────────────────────
      this._silenceTimer = setTimeout(() => {
        const duration = Date.now() - this._speechStart;
        this._speaking     = false;
        this._silenceTimer = null;

        if (duration >= this._minSpeechMs) {
          this.onSpeechEnd?.();
        }
      }, this._silenceDuration);
    }

    this._rafId = requestAnimationFrame(() => this._poll());
  }
}

/* =========================================================================
   VoiceChat — main application class
   ========================================================================= */

class VoiceChat {
  constructor() {
    this._vad           = null;
    this._stream        = null;
    this._recorder      = null;
    this._chunks        = [];
    this._isListening   = false;
    this._isProcessing  = false;
    this._messages      = [];   // conversation history for multi-turn chat
    this._rafDraw       = null;

    // DOM refs
    this._micBtn        = document.getElementById('micBtn');
    this._statusEl      = document.getElementById('status');
    this._chatEl        = document.getElementById('chatContainer');
    this._canvas        = document.getElementById('waveform');
    this._ctx2d         = this._canvas.getContext('2d');

    this._micBtn.addEventListener('click', () => this._toggle());
  }

  /* -----------------------------------------------------------------------
     Public: toggle mic on/off
     ----------------------------------------------------------------------- */

  async _toggle() {
    if (this._isListening) {
      this._stopListening();
    } else {
      await this._startListening();
    }
  }

  /* -----------------------------------------------------------------------
     Start / stop listening
     ----------------------------------------------------------------------- */

  async _startListening() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      this._setStatus('Error: microphone access denied.');
      return;
    }

    this._vad = new VAD(this._stream, {
      threshold:       0.015,
      silenceDuration: 1200,
      minSpeechDuration: 250,
    });
    this._vad.onSpeechStart = () => this._onSpeechStart();
    this._vad.onSpeechEnd   = () => this._onSpeechEnd();
    this._vad.start();

    this._isListening = true;
    this._micBtn.classList.add('active');
    this._setStatus('Listening… speak to chat');
    this._startWaveform();
  }

  _stopListening() {
    this._vad?.stop();
    this._vad = null;

    if (this._recorder?.state !== 'inactive') this._recorder?.stop();
    this._recorder = null;

    this._stream?.getTracks().forEach(t => t.stop());
    this._stream = null;

    this._isListening = false;
    this._micBtn.classList.remove('active', 'recording');
    this._setStatus('Click to start');
    this._stopWaveform();
  }

  /* -----------------------------------------------------------------------
     Speech start / end handlers
     ----------------------------------------------------------------------- */

  _onSpeechStart() {
    if (this._isProcessing) return;

    this._chunks   = [];
    const mimeType = this._getSupportedMimeType();
    this._recorder = new MediaRecorder(this._stream, mimeType ? { mimeType } : {});

    this._recorder.ondataavailable = e => {
      if (e.data.size > 0) this._chunks.push(e.data);
    };

    this._recorder.start(100);   // collect in 100 ms slices
    this._micBtn.classList.add('recording');
    this._setStatus('Recording…');
  }

  async _onSpeechEnd() {
    if (!this._recorder || this._recorder.state === 'inactive') return;
    if (this._isProcessing) return;

    this._isProcessing = true;
    this._micBtn.classList.remove('recording');

    // Wait for the recorder to flush its final chunk
    const stopPromise = new Promise(res => { this._recorder.onstop = res; });
    this._recorder.stop();
    await stopPromise;

    const mimeType  = this._recorder.mimeType || 'audio/webm';
    const audioBlob = new Blob(this._chunks, { type: mimeType });

    try {
      this._setStatus('Transcribing…');
      const transcript = await this._transcribe(audioBlob, mimeType);

      if (!transcript?.trim()) {
        this._setStatus('Listening… speak to chat');
        return;
      }

      this._addMessage('user', transcript);

      this._setStatus('Thinking…');
      const reply = await this._chat(transcript);
      this._addMessage('assistant', reply);

      this._setStatus('Speaking…');
      await this._playTTS(reply);

    } catch (err) {
      console.error('[VoiceChat]', err);
      this._setStatus('Error — please try again.');
    } finally {
      this._isProcessing = false;
      if (this._isListening) this._setStatus('Listening… speak to chat');
    }
  }

  /* -----------------------------------------------------------------------
     API helpers
     ----------------------------------------------------------------------- */

  async _transcribe(blob, mimeType) {
    const ext      = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('audio', blob, `audio.${ext}`);

    const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Transcription error ${res.status}`);
    return (await res.json()).transcript;
  }

  async _chat(userMessage) {
    this._messages.push({ role: 'user', content: userMessage });

    // Keep the window to the last 20 messages to avoid huge payloads
    if (this._messages.length > 20) this._messages = this._messages.slice(-20);

    const res = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: this._messages }),
    });
    if (!res.ok) throw new Error(`Chat error ${res.status}`);

    const reply = (await res.json()).response;
    this._messages.push({ role: 'assistant', content: reply });
    return reply;
  }

  async _playTTS(text) {
    const res = await fetch('/api/tts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS error ${res.status}`);

    const url   = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);

    await new Promise((resolve, reject) => {
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });

    URL.revokeObjectURL(url);
  }

  /* -----------------------------------------------------------------------
     UI helpers
     ----------------------------------------------------------------------- */

  _addMessage(role, content) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;

    const bubble = document.createElement('div');
    bubble.className   = 'bubble';
    bubble.textContent = content;

    wrapper.appendChild(bubble);
    this._chatEl.appendChild(wrapper);
    this._chatEl.scrollTop = this._chatEl.scrollHeight;
  }

  _setStatus(text) {
    this._statusEl.textContent = text;
  }

  /* -----------------------------------------------------------------------
     Waveform visualizer
     ----------------------------------------------------------------------- */

  _startWaveform() {
    const canvas = this._canvas;
    const ctx    = this._ctx2d;
    const BARS   = 32;

    const draw = () => {
      if (!this._isListening) return;

      const rms      = this._vad?.getRMS() ?? 0;
      const speaking = this._vad?._speaking ?? false;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barW = canvas.width / BARS;

      for (let i = 0; i < BARS; i++) {
        // Add per-bar randomness to make it look lively
        const noise  = (Math.random() - 0.5) * rms * 2;
        const energy = Math.max(0.04, rms + noise);
        const h      = Math.min(canvas.height * 0.9, energy * canvas.height * 12);
        const x      = i * barW + barW * 0.15;
        const y      = (canvas.height - h) / 2;
        const alpha  = speaking ? Math.min(1, 0.5 + rms * 15) : Math.min(1, 0.35 + rms * 8);

        ctx.fillStyle = speaking
          ? `rgba(74, 222, 128, ${alpha})`
          : `rgba(99, 179, 237, ${alpha})`;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barW * 0.7, h, 2);
        } else {
          ctx.rect(x, y, barW * 0.7, h);
        }
        ctx.fill();
      }

      this._rafDraw = requestAnimationFrame(draw);
    };

    draw();
  }

  _stopWaveform() {
    if (this._rafDraw) { cancelAnimationFrame(this._rafDraw); this._rafDraw = null; }
    this._ctx2d.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /* -----------------------------------------------------------------------
     Utility
     ----------------------------------------------------------------------- */

  _getSupportedMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
  }
}

/* =========================================================================
   Bootstrap
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => { new VoiceChat(); });
