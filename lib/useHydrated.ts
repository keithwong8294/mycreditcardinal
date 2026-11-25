"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during server render and hydration, true after: gates UI that reads saved state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
