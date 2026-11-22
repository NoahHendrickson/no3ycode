/**
 * When the no3y launch sparkle plays and ends — see `.fork/customizations.yaml#no3y-launch-sparkle`.
 * It plays once per process (a cold launch), and never holds the app: it ends as soon as the
 * first screen is ready, after a short floor so a fast launch does not flash it.
 */
/** Shortest time the sparkle shows, so an instant launch still reads as a twinkle, not a flicker. */
export const NO3Y_LAUNCH_MIN_VISIBLE_MS = 320;
/** The closing scale-up and fade. */
export const NO3Y_LAUNCH_OUTRO_MS = 260;

/** Milliseconds after the sparkle mounted at which its outro starts, given when the app was ready. */
export function no3yLaunchOutroAt(readyAtMs: number): number {
  return Math.max(readyAtMs, NO3Y_LAUNCH_MIN_VISIBLE_MS);
}

/** A store for "the first screen is ready", and a once-per-process claim on playing. */
export function createNo3yLaunchGate() {
  let ready = false;
  let claimed = false;
  const listeners = new Set<() => void>();
  return {
    /** True the first time only: the process's cold launch. */
    claim(): boolean {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    ready: () => ready,
    markReady() {
      if (ready) return;
      ready = true;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
