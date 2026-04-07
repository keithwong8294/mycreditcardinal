"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4 text-center">
      <div className="text-[40px] leading-none select-none">⚠</div>
      <h1 className="mt-4 text-[18px] font-semibold text-primary">Something went wrong</h1>
      <p className="mt-2 text-[13px] text-secondary max-w-xs">
        An unexpected error occurred. Your data is safe.
      </p>
      <button
        onClick={reset}
        className="mt-6 px-4 py-2 bg-green hover:bg-green/90 text-white text-[13px] font-medium rounded-lg transition-colors duration-150"
      >
        Try again
      </button>
    </div>
  );
}
