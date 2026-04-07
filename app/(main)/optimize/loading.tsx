export default function OptimizeLoading() {
  return (
    <div className="p-6 animate-pulse max-w-3xl mx-auto">
      {/* Preferences row */}
      <div className="flex gap-3 mb-8">
        <div className="h-9 w-36 bg-white/5 rounded-lg" />
        <div className="h-9 w-36 bg-white/5 rounded-lg" />
      </div>

      {/* Recommendation cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="mb-4 rounded-2xl border border-white/6 overflow-hidden"
        >
          <div className="flex items-center gap-4 p-5">
            {/* Rank badge */}
            <div className="w-8 h-8 rounded-full bg-white/5 shrink-0" />
            {/* Card face thumbnail */}
            <div className="w-16 h-10 rounded-lg bg-white/5 shrink-0" />
            {/* Name + stats */}
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-white/5 rounded" />
              <div className="h-3 w-1/3 bg-white/5 rounded" />
            </div>
            {/* Value */}
            <div className="h-6 w-20 bg-white/5 rounded" />
          </div>
          {/* Breakdown bar */}
          <div className="h-px bg-white/5" />
          <div className="px-5 py-3 flex gap-6">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-3 w-24 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
