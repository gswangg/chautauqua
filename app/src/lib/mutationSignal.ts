// DEC-700: a badge computed from a fetch-once effect goes stale the moment
// the action that would have changed its answer succeeds elsewhere in the
// app. Rather than each consumer re-deriving "did something change", every
// successful mutating api.ts call (POST/PATCH/PUT/DELETE) bumps a single
// module-level version counter here; consumers subscribe via
// useSyncExternalStore and re-run their fetch whenever the version changes.
// GET requests must never bump this — a GET-triggered bump would loop
// (fetch -> bump -> refetch -> bump -> ...).
import { useSyncExternalStore } from 'react';

let version = 0;
const subscribers = new Set<() => void>();

export function bumpMutationVersion(): void {
  version += 1;
  for (const notify of subscribers) notify();
}

export function subscribeToMutationVersion(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function getSnapshot(): number {
  return version;
}

export function useMutationVersion(): number {
  return useSyncExternalStore(subscribeToMutationVersion, getSnapshot);
}
