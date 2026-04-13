import { useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useVAD } from '../hooks/useVAD'

export default function AudioRecorder() {
  const { isRecording, setIsRecording, sendAudio, connect, status } = useSession()
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)

  const {
    isSpeaking,
    volume,
    startVAD,
    stopVAD,
    consumeSpeechFlag,
  } = useVAD({ threshold: 0.012, silenceMs: 500 })

  const startRecording = useCallback(async () => {
    try {
      // Connect WebSocket if not already
      if (status !== 'connected') {
        connect()
        await new Promise(r => setTimeout(r, 800))
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })
      streamRef.current = stream

      // Start VAD analyser on the same stream
      startVAD(stream)

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // ── VAD Gate: only send chunks where speech was detected ──
          const hadSpeech = consumeSpeechFlag()
          if (hadSpeech) {
            sendAudio(event.data)
          }
          // Silent chunk → skip sending, save API calls + bandwidth
        }
      }

      // Start recording with 3-second chunks
      mediaRecorder.start(3000)
      setIsRecording(true)
    } catch (err) {
      console.error('Microphone access denied:', err)
    }
  }, [connect, sendAudio, setIsRecording, status, startVAD, consumeSpeechFlag])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    mediaRecorderRef.current = null
    streamRef.current = null
    stopVAD()
    setIsRecording(false)
  }, [setIsRecording, stopVAD])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop()
      }
      streamRef.current?.getTracks().forEach(t => t.stop())
      stopVAD()
    }
  }, [stopVAD])

  const toggle = () => {
    isRecording ? stopRecording() : startRecording()
  }

  // Build volume bar heights for the real-time waveform
  const bars = 16
  const barHeights = Array.from({ length: bars }, (_, i) => {
    // Create a varied pattern based on volume + positional offset
    const phase = (i / bars) * Math.PI * 2
    const wave = Math.sin(phase + Date.now() / 200) * 0.3 + 0.7
    return Math.max(4, volume * wave * 32)
  })

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ── VAD Status Badge ── */}
      {isRecording && (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
          isSpeaking
            ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
            : 'bg-white/5 text-gray-500 border border-white/10'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
            isSpeaking ? 'bg-teal-400 shadow-sm shadow-teal-400/50' : 'bg-gray-600'
          }`} />
          {isSpeaking ? 'Voice Detected' : 'Silence — waiting for speech…'}
        </div>
      )}

      {/* ── Mic Button ── */}
      <div className="relative">
        {/* Pulse rings when speaking (not just recording) */}
        {isRecording && isSpeaking && (
          <>
            <div className="absolute inset-0 rounded-full bg-teal-400/30 animate-pulse-ring" />
            <div className="absolute inset-0 rounded-full bg-teal-400/20 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
          </>
        )}

        {/* Volume ring — subtle glow that scales with volume */}
        {isRecording && (
          <div
            className="absolute inset-0 rounded-full transition-all duration-100"
            style={{
              boxShadow: isSpeaking
                ? `0 0 ${20 + volume * 40}px ${volume * 15}px rgba(45, 212, 191, ${0.1 + volume * 0.3})`
                : 'none',
            }}
          />
        )}

        <button
          id="audio-toggle"
          onClick={toggle}
          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer ${
            isRecording
              ? isSpeaking
                ? 'bg-gradient-to-br from-teal-400 to-cyan-500 shadow-2xl shadow-teal-500/40 scale-110'
                : 'bg-gradient-to-br from-gray-600 to-gray-700 shadow-xl shadow-gray-500/20 scale-105'
              : 'bg-white/10 border-2 border-white/20 hover:border-teal-400/50 hover:bg-white/15 hover:shadow-lg hover:shadow-teal-500/10'
          }`}
        >
          {isRecording ? (
            <MicOff className={`w-8 h-8 ${isSpeaking ? 'text-gray-950' : 'text-gray-400'}`} strokeWidth={2} />
          ) : (
            <Mic className="w-8 h-8 text-gray-300" strokeWidth={2} />
          )}
        </button>
      </div>

      {/* ── Live Volume Meter ── */}
      {isRecording && (
        <div className="flex items-end justify-center gap-[3px] h-10 animate-fade-in">
          {barHeights.map((h, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-75"
              style={{
                width: 3,
                height: `${h}px`,
                background: isSpeaking
                  ? `linear-gradient(to top, #14b8a6, #06b6d4)`
                  : `linear-gradient(to top, #374151, #4b5563)`,
                opacity: isSpeaking ? 0.9 : 0.4,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Label ── */}
      <p className={`text-sm font-medium transition-colors ${
        isRecording
          ? isSpeaking ? 'text-teal-400' : 'text-gray-500'
          : 'text-gray-500'
      }`}>
        {isRecording
          ? isSpeaking
            ? 'Listening… Tap to stop'
            : 'Waiting for your voice…'
          : 'Tap to start speaking'
        }
      </p>
    </div>
  )
}
