import { useRef, useState, useCallback, useEffect } from 'react'

/**
 * Voice Activity Detection hook using Web Audio API.
 *
 * Analyzes a MediaStream's audio volume via an AnalyserNode.
 * Returns real-time voice activity state, volume level (0–1),
 * and a per-chunk "speechDetected" flag that indicates whether
 * any speech was detected during a recording window.
 *
 * @param {Object} options
 * @param {number} options.threshold   – RMS threshold to consider as speech (0–1, default 0.015)
 * @param {number} options.smoothing   – AnalyserNode smoothing constant (0–1, default 0.8)
 * @param {number} options.silenceMs   – ms of silence before flipping isSpeaking to false (default 400)
 * @param {number} options.pollInterval – ms between volume polls (default 60)
 */
export function useVAD({
  threshold = 0.015,
  smoothing = 0.8,
  silenceMs = 400,
  pollInterval = 60,
} = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [volume, setVolume] = useState(0) // 0–1 normalized

  const ctxRef = useRef(null)          // AudioContext
  const analyserRef = useRef(null)     // AnalyserNode
  const sourceRef = useRef(null)       // MediaStreamAudioSourceNode
  const rafRef = useRef(null)          // requestAnimationFrame / interval ID
  const silenceTimerRef = useRef(null) // setTimeout ID for silence delay

  // Track whether speech was detected in the current chunk window.
  // AudioRecorder reads & resets this between chunk boundaries.
  const speechInChunkRef = useRef(false)

  /**
   * Attach VAD analyser to a MediaStream.
   */
  const startVAD = useCallback((stream) => {
    // Create AudioContext
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    ctxRef.current = ctx

    // Configure AnalyserNode
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = smoothing
    analyserRef.current = analyser

    // Connect mic stream → analyser
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    sourceRef.current = source

    // Float buffer for time-domain data
    const dataArray = new Float32Array(analyser.fftSize)

    // Poll the analyser at a fixed interval
    rafRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(dataArray)

      // Compute RMS (root-mean-square) energy
      let sumSq = 0
      for (let i = 0; i < dataArray.length; i++) {
        sumSq += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sumSq / dataArray.length)

      // Normalize to 0–1 range (clamp at 0.5 RMS as practical max)
      const normalizedVol = Math.min(rms / 0.5, 1)
      setVolume(normalizedVol)

      if (rms >= threshold) {
        // Voice detected
        speechInChunkRef.current = true

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = null
        }
        setIsSpeaking(true)
      } else {
        // Below threshold — start silence countdown
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            setIsSpeaking(false)
            silenceTimerRef.current = null
          }, silenceMs)
        }
      }
    }, pollInterval)
  }, [threshold, smoothing, silenceMs, pollInterval])

  /**
   * Tear down AudioContext and stop polling.
   */
  const stopVAD = useCallback(() => {
    if (rafRef.current) {
      clearInterval(rafRef.current)
      rafRef.current = null
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    sourceRef.current?.disconnect()
    ctxRef.current?.close()
    ctxRef.current = null
    analyserRef.current = null
    sourceRef.current = null
    setIsSpeaking(false)
    setVolume(0)
    speechInChunkRef.current = false
  }, [])

  /**
   * Read whether speech was detected in the current chunk window,
   * then reset the flag for the next window.
   */
  const consumeSpeechFlag = useCallback(() => {
    const had = speechInChunkRef.current
    speechInChunkRef.current = false
    return had
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopVAD()
  }, [stopVAD])

  return {
    isSpeaking,   // boolean — live voice activity
    volume,       // 0–1 normalized volume level
    startVAD,     // (stream: MediaStream) => void
    stopVAD,      // () => void
    consumeSpeechFlag, // () => boolean — was speech in this chunk window?
  }
}
