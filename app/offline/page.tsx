export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-paper">
      <div className="text-center">
        <h1 className="font-display text-[44px] leading-none text-ink mb-3">
          You&apos;re offline
        </h1>
        <p className="text-[15px] text-secondary mb-8 max-w-xs mx-auto">
          MyCreditCardinal couldn&apos;t load. Check your internet connection and
          try again.
        </p>
        {/* Full page load on purpose: retries the network instead of client nav. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="inline-block px-6 py-2.5 bg-ink hover:bg-cardinal text-paper text-[14px] font-medium rounded-lg transition-colors duration-200"
        >
          Try again
        </a>
      </div>
    </div>
  );
}
