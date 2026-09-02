import { Activity, Wifi, WifiOff, Loader, Trash2 } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import ModeToggle from './ModeToggle'

export default function Header() {
  const { status, clearHistory, sessionId } = useSession()

  const statusConfig = {
    connected:    { color: 'bg-emerald-400', shadow: 'shadow-emerald-400/50', label: 'Connected',    Icon: Wifi },
    connecting:   { color: 'bg-amber-400',   shadow: 'shadow-amber-400/50',   label: 'Connecting…',  Icon: Loader },
    disconnected: { color: 'bg-red-400',     shadow: 'shadow-red-400/50',     label: 'Disconnected', Icon: WifiOff },
  }

  const { color, shadow, label, Icon } = statusConfig[status]

  return (
    <header className="glass sticky top-0 z-50 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* ── Brand ── */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Activity className="w-5 h-5 text-gray-950" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-teal-300 to-cyan-400 bg-clip-text text-transparent">
              EchoCoach
            </h1>
            <p className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              AI Voice Coach
            </p>
          </div>
        </div>

        {/* ── Center: Mode Toggle ── */}
        <ModeToggle />

        {/* ── Right: Status + Actions ── */}
        <div className="flex items-center gap-4">
          <button
            onClick={clearHistory}
            title="Clear conversation"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className={`w-2 h-2 rounded-full ${color} shadow-md ${shadow}`} />
            <Icon className={`w-3.5 h-3.5 text-gray-400 ${status === 'connecting' ? 'animate-spin' : ''}`} />
            <span className="text-xs text-gray-400 font-medium">{label}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
