/**
 * A maximized right panel covers the rest of the stage — see
 * `.fork/customizations.yaml#fork-stage-columns`. The terminal and Threads toggles restore it
 * first so what they open shows. `maximized` outlives some closes, so an open panel is required.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useRightPanelStore } from "~/rightPanelStore";

/** Restores `ref`'s right panel if it is open and maximized; true when it did. */
export function restoreMaximizedRightPanel(ref: ScopedThreadRef): boolean {
  const rightPanel = useRightPanelStore.getState();
  const state = rightPanel.byThreadKey[scopedThreadKey(ref)];
  if (state?.isOpen !== true || state.maximized !== true) return false;
  rightPanel.setMaximized(ref, false);
  return true;
}
