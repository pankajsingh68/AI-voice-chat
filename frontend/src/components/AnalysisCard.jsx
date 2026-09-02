import {
  CheckCircle,
  XCircle,
  Lightbulb,
  Volume2,
  ArrowRight,
} from 'lucide-react'
import FluencyGauge from './FluencyGauge'

export default function AnalysisCard({ data }) {
  if (!data) return null

  const {
    original = '',
    corrected = '',
    mistakes = [],
    tone_analysis = '',
    fluency_score = 0,
    coaching_tip = '',
  } = data

  const hasCorrection = original.trim().toLowerCase() !== corrected.trim().toLowerCase()

  return (
    <div className="glass-card p-5 animate-fade-in-up space-y-4">
      {/* ── Header Row: Gauge + Tone ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <FluencyGauge score={fluency_score} />
          {tone_analysis && (
            <div className="flex items-start gap-2">
              <Volume2 className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-0.5">Tone</p>
                <p className="text-sm text-violet-300">{tone_analysis}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Original → Corrected ── */}
      {hasCorrection && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] text-red-400/80 uppercase tracking-wider font-semibold">Original</span>
            </div>
            <p className="text-sm text-gray-400 line-through leading-relaxed">{original}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-600 mt-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-semibold">Corrected</span>
            </div>
            <p className="text-sm text-emerald-200 leading-relaxed">{corrected}</p>
          </div>
        </div>
      )}

      {/* ── Mistakes ── */}
      {mistakes.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Mistakes</p>
          <div className="flex flex-wrap gap-2">
            {mistakes.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/20"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Coaching Tip ── */}
      {coaching_tip && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/15">
          <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-amber-400/80 uppercase tracking-wider font-semibold mb-0.5">Coaching Tip</p>
            <p className="text-sm text-amber-100/90 leading-relaxed">{coaching_tip}</p>
          </div>
        </div>
      )}
    </div>
  )
}
