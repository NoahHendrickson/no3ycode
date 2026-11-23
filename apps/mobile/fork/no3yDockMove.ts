/**
 * Dock tab switches on no3y iOS are a plain swap — see `.fork/customizations.yaml#no3y-mobile-redesign`:
 * a dock press marks the navigation it causes, and the root stack runs that one without its
 * native push or pop.
 */

/** How long a dock press counts as the cause of the navigation that follows it. */
const SWITCH_WINDOW_MS = 500;

let switchedAt: number | null = null;

export function markNo3yDockSwitch(): void {
  switchedAt = Date.now();
}

/** The root stack's options: no native push or pop for a dock switch. */
export function no3yDockScreenOptions(): { readonly animation?: "none" } {
  return switchedAt !== null && Date.now() - switchedAt <= SWITCH_WINDOW_MS
    ? { animation: "none" }
    : {};
}
