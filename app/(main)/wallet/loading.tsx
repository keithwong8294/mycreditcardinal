export default function WalletLoading() {
  return (
    <div className="p-6 animate-pulse max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-5 w-32 bg-white/5 rounded" />
        <div className="h-9 w-28 bg-white/5 rounded-lg" />
      </div>

      {/* Wallet cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 mb-3 rounded-xl border border-white/6"
        >
          <div className="w-16 h-10 rounded-lg bg-white/5 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 bg-white/5 rounded" />
            <div className="h-3 w-1/3 bg-white/5 rounded" />
          </div>
          <div className="w-6 h-6 rounded bg-white/5 shrink-0" />
        </div>
      ))}
    </div>
  );
}
