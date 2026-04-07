export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#0f1219" }}
    >
      <div className="text-center">
        <div className="text-[48px] mb-4 select-none">⚡</div>
        <h1 className="text-[22px] font-semibold text-white mb-2">
          You&apos;re offline
        </h1>
        <p className="text-[14px] text-white/40 mb-8 max-w-xs mx-auto">
          MyCreditCardinal couldn&apos;t load. Check your internet connection and
          try again.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-2.5 bg-[#059669] hover:bg-[#059669]/90 text-white text-[13px] font-medium rounded-lg transition-colors duration-150"
        >
          Try again
        </a>
      </div>
    </div>
  );
}
