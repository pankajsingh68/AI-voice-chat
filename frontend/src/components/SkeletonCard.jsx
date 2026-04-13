export default function SkeletonCard() {
  return (
    <div className="animate-fade-in-up flex items-start gap-3 justify-end">
      <div className="glass-card px-4 py-4 w-[70%] space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-xs text-teal-400/80 font-medium">Processing…</span>
        </div>
        <div className="h-3 rounded-full animate-shimmer w-full" />
        <div className="h-3 rounded-full animate-shimmer w-4/5" />
        <div className="h-3 rounded-full animate-shimmer w-3/5" />
        <div className="flex gap-2 mt-3">
          <div className="h-6 w-16 rounded-full animate-shimmer" />
          <div className="h-6 w-20 rounded-full animate-shimmer" />
        </div>
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-teal-400/30 to-cyan-500/30 animate-pulse" />
    </div>
  )
}
