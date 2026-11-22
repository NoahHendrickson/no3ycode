/**
 * Caches a voice destination's prepare result (the environment's speech status, resolved to a
 * locale) so a dictation tap skips the round trip to the environment — see
 * `.fork/customizations.yaml#no3y-voice-prepare-cache`. Errors are never cached.
 */
export const VOICE_PREPARE_TTL_MS = 5 * 60_000;

export interface VoicePrepareCache<T> {
  /** The fresh value for this connection and destination, else one shared fetch of it. */
  readonly read: (
    connection: object,
    destination: string,
    fetch: () => Promise<T>,
    signal?: AbortSignal,
  ) => Promise<T>;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

export function createVoicePrepareCache<T>(
  options: { readonly ttlMs?: number; readonly now?: () => number } = {},
): VoicePrepareCache<T> {
  const ttlMs = options.ttlMs ?? VOICE_PREPARE_TTL_MS;
  const now = options.now ?? Date.now;
  type Slot = { readonly connection: object; readonly destination: string };
  let entry: (Slot & { readonly value: T; readonly at: number }) | null = null;
  let pending: (Slot & { readonly promise: Promise<T> }) | null = null;
  const same = (slot: Slot | null, connection: object, destination: string) =>
    slot !== null && slot.connection === connection && slot.destination === destination;
  return {
    read(connection, destination, fetch, signal) {
      if (same(entry, connection, destination) && now() - entry!.at < ttlMs) {
        return Promise.resolve(entry!.value);
      }
      if (!same(pending, connection, destination)) {
        const promise = fetch().then(
          (value) => {
            if (pending?.promise === promise) pending = null;
            entry = { connection, destination, value, at: now() };
            return value;
          },
          (error: unknown) => {
            if (pending?.promise === promise) pending = null;
            throw error;
          },
        );
        pending = { connection, destination, promise };
      }
      // A caller giving up does not cancel the shared fetch another caller may be waiting on.
      return abortable(pending!.promise, signal);
    },
  };
}
