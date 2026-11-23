/**
 * The Mac's "Resume with less context" offer on the no3y iPhone composer (no3y-mobile-redesign):
 * the offer is client-runtime's compactBeforeSendTokens, applying the Mac's
 * shouldOfferResumeCompaction; Compact sends `/compact` now and send stays a plain send.
 */

// Session-scoped dismissals ("Keep full history"), one per thread and context snapshot.
const dismissedKeys = new Set<string>();
const listeners = new Set<() => void>();

/**
 * The snapshot a dismissal covers. The offer carries only its token count, so a new context
 * snapshot reads as a new count; a snapshot that happens to repeat the count stays dismissed.
 */
export function no3yResumeCompactionKey(threadKey: string, tokens: number): string {
  return `${threadKey}:${tokens}`;
}

/** What the pill shows, or null: no offer, or this thread and snapshot was kept in full. */
export function resolveNo3yResumeCompaction(input: {
  readonly threadKey: string | null;
  readonly tokens: number | null;
  readonly isDismissed: (key: string) => boolean;
}): { readonly key: string; readonly tokens: number } | null {
  if (input.threadKey === null || input.tokens === null) return null;
  const key = no3yResumeCompactionKey(input.threadKey, input.tokens);
  return input.isDismissed(key) ? null : { key, tokens: input.tokens };
}

export function isNo3yResumeCompactionDismissed(key: string): boolean {
  return dismissedKeys.has(key);
}

export function dismissNo3yResumeCompaction(key: string): void {
  dismissedKeys.add(key);
  for (const listener of listeners) listener();
}

/** How many dismissals there are, a stable snapshot for useSyncExternalStore. */
export function no3yResumeCompactionDismissals(): number {
  return dismissedKeys.size;
}

export function subscribeNo3yResumeCompaction(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The standalone command the Compact pill sends. */
export const NO3Y_COMPACT_COMMAND = "/compact";
