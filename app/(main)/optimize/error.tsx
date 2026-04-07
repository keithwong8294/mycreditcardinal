"use client";

import { useEffect } from "react";

export default function PageError({
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-[32px] leading-none select-none">⚠</div>
      <p className="mt-3 text-[14px] font-semibold text-primary">Something went wrong</p>
      <p className="mt-1 text-[12px] text-secondary">An unexpected error occurred loading this page.</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-1.5 bg-green hover:bg-green/90 text-white text-[12px] font-medium rounded-lg transition-colors duration-150"
      >
        Try again
      </button>
    </div>
  );
}
