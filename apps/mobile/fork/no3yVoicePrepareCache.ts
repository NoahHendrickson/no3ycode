/**
 * Caches a voice destination's prepare result (the environment's speech status, resolved to a
 * locale) so a dictation tap skips the round trip to the environment — see
 * `.fork/customizations.yaml#no3y-voice-prepare-cache`. Errors are never cached.
 */
export const VOICE_PREPARE_TTL_MS = 5 * 60_000;

export interface VoicePrepareCache<T> {
  /**
   * The fresh value for this connection and destination, else one shared fetch of it. Callers
   * with a signal keep the fetch alive; when the last of them aborts, the fetch is cancelled so
   * a hung one cannot hold up the next tap. A read without a signal (a prefetch) holds nothing.
   */
  readonly read: (
    connection: object,
    destination: string,
    fetch: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ) => Promise<T>;
}

export function createVoicePrepareCache<T>(
  options: { readonly ttlMs?: number; readonly now?: () => number } = {},
): VoicePrepareCache<T> {
  const ttlMs = options.ttlMs ?? VOICE_PREPARE_TTL_MS;
  const now = options.now ?? Date.now;
  type Slot = { readonly connection: object; readonly destination: string };
  let entry: (Slot & { readonly value: T; readonly at: number }) | null = null;
  let pending:
    | (Slot & {
        readonly promise: Promise<T>;
        readonly controller: AbortController;
        waiters: number;
      })
    | null = null;
  const same = (slot: Slot | null, connection: object, destination: string) =>
    slot !== null && slot.connection === connection && slot.destination === destination;
  return {
    read(connection, destination, fetch, signal) {
      if (same(entry, connection, destination) && now() - entry!.at < ttlMs) {
        return Promise.resolve(entry!.value);
      }
      if (!same(pending, connection, destination)) {
        const controller = new AbortController();
        const promise = fetch(controller.signal).then(
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
        pending = { connection, destination, promise, controller, waiters: 0 };
      }
      const shared = pending!;
      if (!signal) return shared.promise;
      if (signal.aborted) return Promise.reject(signal.reason);
      shared.waiters += 1;
      return new Promise<T>((resolve, reject) => {
        const leave = () => {
          shared.waiters -= 1;
          signal.removeEventListener("abort", abort);
        };
        const abort = () => {
          leave();
          reject(signal.reason);
          if (shared.waiters === 0 && pending === shared) {
            pending = null;
            shared.controller.abort(signal.reason);
          }
        };
        signal.addEventListener("abort", abort, { once: true });
        shared.promise.then(
          (value) => {
            leave();
            resolve(value);
          },
          (error: unknown) => {
            leave();
            reject(error);
          },
        );
      });
    },
  };
}
