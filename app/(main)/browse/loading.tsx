export default function BrowseLoading() {
  return (
    <div className="p-6 animate-pulse">
      {/* Search / filter bar */}
      <div className="flex gap-3 mb-6">
        <div className="h-9 flex-1 bg-white/5 rounded-lg" />
        <div className="h-9 w-32 bg-white/5 rounded-lg" />
        <div className="h-9 w-32 bg-white/5 rounded-lg" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-white/6">
            {/* Card face */}
            <div className="h-40 bg-white/5" />
            {/* Card info */}
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 bg-white/5 rounded" />
              <div className="h-3 w-1/2 bg-white/5 rounded" />
              <div className="flex gap-2 mt-3">
                <div className="h-5 w-16 bg-white/5 rounded-full" />
                <div className="h-5 w-20 bg-white/5 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
