import { useMemo } from 'react'

export default function FluencyGauge({ score = 0 }) {
  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const percentage = Math.max(0, Math.min(score, 10)) / 10
  const dashOffset = circumference * (1 - percentage)

  // Color based on score
  const color = useMemo(() => {
    if (score >= 8) return { stroke: '#34d399', text: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/5' }
    if (score >= 5) return { stroke: '#fbbf24', text: 'text-amber-400', bg: 'from-amber-500/20 to-amber-500/5' }
    return { stroke: '#f87171', text: 'text-red-400', bg: 'from-red-500/20 to-red-500/5' }
  }, [score])

  const label = useMemo(() => {
    if (score >= 9) return 'Excellent'
    if (score >= 7) return 'Good'
    if (score >= 5) return 'Fair'
    if (score >= 3) return 'Needs Work'
    return 'Poor'
  }, [score])

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease',
              filter: `drop-shadow(0 0 6px ${color.stroke}40)`,
            }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${color.text}`}>{score}</span>
        </div>
      </div>
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${color.text}`}>{label}</span>
    </div>
  )
}
