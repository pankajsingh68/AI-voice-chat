import { useSession } from '../context/SessionContext'
import AnalysisCard from './AnalysisCard'
import { BarChart3 } from 'lucide-react'

export default function AnalysisPanel() {
  const { entries, mode } = useSession()

  // Get only analysis entries
  const analyses = entries.filter(e => e.type === 'analysis')
  const latest = analyses[analyses.length - 1]

  if (mode === 'conversation') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-50">
        <p className="text-sm text-gray-500">
          Analysis cards are hidden in Chat mode.
          <br />
          Switch to <span className="text-teal-400">Coach Mode</span> for detailed feedback.
        </p>
      </div>
    )
  }

  if (analyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-50">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
          <BarChart3 className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-500">
          Speak something to see your analysis here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
      <h2 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
        Latest Analysis
      </h2>
      {latest && <AnalysisCard data={latest.data} />}

      {analyses.length > 1 && (
        <>
          <h2 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-6 mb-2">
            History ({analyses.length - 1})
          </h2>
          <div className="space-y-3">
            {analyses.slice(0, -1).reverse().map(entry => (
              <AnalysisCard key={entry.id} data={entry.data} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
