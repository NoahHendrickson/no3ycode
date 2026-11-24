/**
 * Which input the keyboard is up for on no3y iOS (no3y-mobile-redesign): the composer rides the
 * keyboard only for its own editor. A header search keeps it at rest behind the keyboard, so
 * opening and closing search never moves it. The last owner holds through the keyboard's dismissal.
 */
import { useSyncExternalStore } from "react";

export type No3yKeyboardOwner = "composer" | "other";

let owner: No3yKeyboardOwner = "composer";
const listeners = new Set<() => void>();

export function claimNo3yKeyboard(next: No3yKeyboardOwner): void {
  if (owner === next) return;
  owner = next;
  for (const listener of listeners) listener();
}

export function readNo3yKeyboardOwner(): No3yKeyboardOwner {
  return owner;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNo3yKeyboardOwner(): No3yKeyboardOwner {
  return useSyncExternalStore(subscribe, readNo3yKeyboardOwner);
}

/** The composer follows the keyboard unless the no3y layout has handed it to another input. */
export function no3yComposerFollowsKeyboard(input: {
  readonly no3yLayout: boolean;
  readonly owner: No3yKeyboardOwner;
}): boolean {
  return !input.no3yLayout || input.owner === "composer";
}
