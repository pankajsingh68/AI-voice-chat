import { useEffect, useRef } from 'react'
import { User, Bot, AlertTriangle } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import SkeletonCard from './SkeletonCard'

export default function LiveTranscript() {
  const { entries, isProcessing } = useSession()
  const bottomRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, isProcessing])

  if (entries.length === 0 && !isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16 opacity-60">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Bot className="w-8 h-8 text-gray-500" />
        </div>
        <p className="text-gray-500 text-sm max-w-xs">
          Start speaking and your live transcript will appear here along with AI coaching feedback.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-4 overflow-y-auto max-h-[calc(100vh-320px)] px-1">
      {entries.map((entry, idx) => {
        if (entry.type === 'transcript') {
          return (
            <div
              key={entry.id}
              className="animate-fade-in-up flex items-start gap-3"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="glass-card px-4 py-3 max-w-[85%]">
                <p className="text-sm text-gray-200 leading-relaxed">{entry.text}</p>
                <span className="text-[10px] text-gray-600 mt-1 block">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )
        }

        if (entry.type === 'analysis' && entry.data?.natural_response) {
          return (
            <div
              key={entry.id}
              className="animate-fade-in-up flex items-start gap-3 justify-end"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="glass-card px-4 py-3 max-w-[85%] border-teal-500/20">
                <p className="text-sm text-teal-100 leading-relaxed">{entry.data.natural_response}</p>
                <span className="text-[10px] text-gray-600 mt-1 block text-right">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Bot className="w-4 h-4 text-gray-950" />
              </div>
            </div>
          )
        }

        if (entry.type === 'error') {
          return (
            <div
              key={entry.id}
              className="animate-fade-in flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{entry.message}</span>
            </div>
          )
        }

        return null
      })}

      {isProcessing && <SkeletonCard />}

      <div ref={bottomRef} />
    </div>
  )
}
