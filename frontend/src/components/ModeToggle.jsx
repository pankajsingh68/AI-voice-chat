import { GraduationCap, MessageCircle } from 'lucide-react'
import { useSession } from '../context/SessionContext'

export default function ModeToggle() {
  const { mode, setMode } = useSession()

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
      <button
        id="mode-coach"
        onClick={() => setMode('coach')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
          mode === 'coach'
            ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 shadow-lg shadow-teal-500/10 border border-teal-500/30'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <GraduationCap className="w-4 h-4" />
        <span>Coach</span>
      </button>
      <button
        id="mode-conversation"
        onClick={() => setMode('conversation')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
          mode === 'conversation'
            ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 shadow-lg shadow-violet-500/10 border border-violet-500/30'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        <span>Chat</span>
      </button>
    </div>
  )
}
