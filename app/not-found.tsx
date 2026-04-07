import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4 text-center">
      <div className="text-[64px] font-semibold text-white/10 leading-none select-none">404</div>
      <h1 className="mt-4 text-[20px] font-semibold text-primary">Page not found</h1>
      <p className="mt-2 text-[13px] text-secondary max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/browse"
        className="mt-6 px-4 py-2 bg-green hover:bg-green/90 text-white text-[13px] font-medium rounded-lg transition-colors duration-150"
      >
        Go to Browse Cards
      </Link>
    </div>
  );
}
