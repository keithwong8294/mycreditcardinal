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
      <h1 className="font-display text-[44px] leading-none text-ink">Something went <span className="italic text-cardinal">wrong.</span></h1>
      <p className="mt-3 text-[15px] text-secondary max-w-xs">
        An unexpected error occurred. Your data is safe.
      </p>
      <button
        onClick={reset}
        className="mt-6 px-5 py-2.5 bg-ink hover:bg-cardinal text-paper text-[14px] font-medium rounded-lg transition-colors duration-200"
      >
        Try again
      </button>
    </div>
  );
}
