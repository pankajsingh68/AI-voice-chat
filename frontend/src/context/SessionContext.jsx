import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'

const SessionContext = createContext(null)

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/coaching'

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null)
  const [mode, setModeState] = useState('coach') // 'coach' | 'conversation'
  const [status, setStatus] = useState('disconnected') // 'disconnected' | 'connecting' | 'connected'
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [entries, setEntries] = useState([]) // {id, type, ...}
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const entryIdRef = useRef(0)

  const nextId = () => ++entryIdRef.current

  // ── WebSocket Management ────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        handleMessage(msg)
      } catch {
        // ignore non-JSON
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      setIsRecording(false)
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(() => connect(), 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
    setStatus('disconnected')
    setIsRecording(false)
  }, [])

  // ── Message Handler ────────────────────────────────────────────────────

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'session_started':
        setSessionId(msg.session_id)
        break

      case 'processing':
        setIsProcessing(true)
        break

      case 'transcript':
        setEntries(prev => [...prev, {
          id: nextId(),
          type: 'transcript',
          text: msg.text,
          timestamp: Date.now(),
        }])
        break

      case 'analysis':
        setIsProcessing(false)
        setEntries(prev => [...prev, {
          id: nextId(),
          type: 'analysis',
          data: msg.data,
          timestamp: Date.now(),
        }])
        break

      case 'mode_changed':
        setModeState(msg.mode)
        break

      case 'info':
      case 'vad_silent':
        setIsProcessing(false)
        break

      case 'error':
        setIsProcessing(false)
        setEntries(prev => [...prev, {
          id: nextId(),
          type: 'error',
          message: msg.message,
          timestamp: Date.now(),
        }])
        break

      case 'history_cleared':
        setEntries([])
        break

      default:
        break
    }
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────

  const sendAudio = useCallback((blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      blob.arrayBuffer().then(buffer => {
        wsRef.current.send(buffer)
      })
    }
  }, [])

  const setMode = useCallback((newMode) => {
    setModeState(newMode)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_mode', mode: newMode }))
    }
  }, [])

  const clearHistory = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear_history' }))
    }
    setEntries([])
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const value = {
    sessionId,
    mode,
    setMode,
    status,
    isRecording,
    setIsRecording,
    isProcessing,
    entries,
    connect,
    disconnect,
    sendAudio,
    clearHistory,
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be inside SessionProvider')
  return ctx
}
