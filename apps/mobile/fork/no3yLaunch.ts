/**
 * When the no3y launch leaf spins and ends — see `.fork/customizations.yaml#no3y-launch-leaf`.
 * It plays once per process (a cold launch) and never holds the app: it fades out as soon as the
 * first screen is ready, and only starts spinning if that takes longer than a moment.
 */
/** A launch ready within this shows the still mark and fades; only a longer wait spins. */
export const NO3Y_LAUNCH_SPIN_DELAY_MS = 180;
/** The leaves sweep clockwise into one stack at the top. */
export const NO3Y_LAUNCH_GATHER_MS = 320;
/** …then fan back out clockwise into the mark. */
export const NO3Y_LAUNCH_FAN_MS = 560;
/** The mark rests whole between spins. */
export const NO3Y_LAUNCH_HOLD_MS = 420;
/** The closing scale-up and fade. */
export const NO3Y_LAUNCH_OUTRO_MS = 260;

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
