export default function SimulateLoading() {
  return (
    <div className="p-6 animate-pulse max-w-4xl mx-auto">
      {/* Person tabs */}
      <div className="flex gap-2 mb-6">
        <div className="h-8 w-24 bg-white/5 rounded-lg" />
        <div className="h-8 w-24 bg-white/5 rounded-lg" />
        <div className="h-8 w-8 bg-white/5 rounded-lg ml-auto" />
      </div>

      {/* Table header */}
      <div className="grid grid-cols-4 gap-4 mb-3 px-4">
        {["Category", "Monthly $", "Best card", "Est. value"].map((h) => (
          <div key={h} className="h-3 w-3/4 bg-white/5 rounded" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-4 gap-4 px-4 py-3 border-t border-white/5"
        >
          <div className="h-4 w-2/3 bg-white/5 rounded" />
          <div className="h-8 w-full bg-white/5 rounded-lg" />
          <div className="h-4 w-3/4 bg-white/5 rounded" />
          <div className="h-4 w-1/2 bg-white/5 rounded" />
        </div>
      ))}

      {/* Summary bar */}
      <div className="mt-8 p-4 rounded-xl bg-white/3 border border-white/6 flex gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-20 bg-white/5 rounded" />
            <div className="h-5 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
