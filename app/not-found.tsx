import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4 text-center">
      <div className="font-mono text-[13px] tracking-[0.2em] text-cardinal select-none">404</div>
      <h1 className="font-display mt-3 text-[44px] leading-none text-ink">Page not found</h1>
      <p className="mt-3 text-[15px] text-secondary max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/browse"
        className="mt-6 px-5 py-2.5 bg-ink hover:bg-cardinal text-paper text-[14px] font-medium rounded-lg transition-colors duration-200"
      >
        Go to Browse Cards
      </Link>
    </div>
  );
}
